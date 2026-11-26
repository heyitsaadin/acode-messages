import { ls } from "../util.js";

// Direct messages are end-to-end encrypted. The server stores 'e2e1:<base64(iv + ciphertext)>' and never sees the text.
//   keys:    each device makes a P-256 key pair; the public half is published at /api/keys, the private half stays on the device
//   secret:  ECDH(my private, their public) -> HKDF-SHA256 -> AES-256-GCM key (the same key on both sides)
// Group chats are unchanged.
const E2E_PREFIX = "e2e1:";
const E2E_KEY_MS = 30000; // how long a fetched public key is trusted before asking the server again
const E2E_LOCKED = "🔒 This message can't be decrypted on this device";

const e2eToB64 = (u8) => {
	let s = "";
	for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
	return btoa(s);
};
const e2eFromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export class EncryptionMethods {
	/* ---------- end-to-end encrypted direct messages ---------- */

	e2eSupported() {
		return !!(window.crypto?.subtle && typeof crypto.getRandomValues === "function");
	}

	dmPeerId(ch) {
		return ch?.peer?.id ?? ch?.peer_id ?? null;
	}

	// My key pair, made once per account on this device. create=false only looks at what already exists.
	async e2eIdentity(create = true) {
		const uid = String(this.me?.id ?? this.state.user?.id ?? "");
		if (!uid) throw new Error("not signed in");
		if (this._e2e && this._e2e.uid === uid) return this._e2e;
		if (!create && !ls.get(`am-e2e:${uid}`)) return null;
		if (!this._e2eP || this._e2eP.uid !== uid) {
			const p = (async () => {
				const s = crypto.subtle;
				const alg = { name: "ECDH", namedCurve: "P-256" };
				let priv = null;
				let pub = null;
				const rec = ls.get(`am-e2e:${uid}`);
				if (rec?.jwk && rec?.pub) {
					try {
						priv = await s.importKey("jwk", rec.jwk, alg, false, ["deriveBits"]);
						pub = rec.pub;
					} catch {
						priv = null;
					}
				}
				if (!priv) {
					const kp = await s.generateKey(alg, true, ["deriveBits"]);
					const jwk = await s.exportKey("jwk", kp.privateKey);
					pub = e2eToB64(new Uint8Array(await s.exportKey("raw", kp.publicKey)));
					ls.set(`am-e2e:${uid}`, { jwk, pub });
					// If the key can't be saved, a new one would be made every launch and old chats would be lost.
					if (!ls.get(`am-e2e:${uid}`)) throw new Error("couldn't save your encryption key on this device");
					priv = await s.importKey("jwk", jwk, alg, false, ["deriveBits"]);
				}
				return (this._e2e = { uid, priv, pub });
			})();
			p.uid = uid;
			p.catch(() => {
				if (this._e2eP === p) this._e2eP = null;
			});
			this._e2eP = p;
		}
		return this._e2eP;
	}

	// Makes sure the server has my current public key, so people can write to me.
	async e2ePublish() {
		const id = await this.e2eIdentity();
		if (this._e2eSent === `${id.uid}:${id.pub}`) return;
		const r = await this.api(`keys?user=${encodeURIComponent(id.uid)}`);
		if (r?.public_key !== id.pub) await this.api("keys", { method: "POST", body: JSON.stringify({ public_key: id.pub }) });
		this._e2eSent = `${id.uid}:${id.pub}`;
	}

	async e2eDerive(pubB64) {
		const s = crypto.subtle;
		const id = await this.e2eIdentity(false);
		if (!id) throw new Error("no key on this device");
		const pk = await s.importKey("raw", e2eFromB64(pubB64), { name: "ECDH", namedCurve: "P-256" }, false, []);
		const bits = await s.deriveBits({ name: "ECDH", public: pk }, id.priv, 256);
		const base = await s.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
		return s.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode("acode-messages e2e1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
	}

	// The shared AES key with one person, or null if they haven't published a key (they need to update the plugin).
	async peerKey(peerId, force = false, maxAge = E2E_KEY_MS) {
		const id = String(peerId);
		if (!this._pk) this._pk = {};
		const c = this._pk[id];
		const age = c ? Date.now() - c.at : Infinity;
		if (c && (age < maxAge || (force && age < 10000))) return c.aes;
		const r = await this.api(`keys?user=${encodeURIComponent(id)}`);
		const pub = r?.public_key;
		if (!pub) {
			delete this._pk[id];
			return null;
		}
		if (c && c.pub === pub) {
			c.at = Date.now();
			return c.aes;
		}
		const aes = await this.e2eDerive(pub);
		this._pk[id] = { pub, aes, at: Date.now() };
		return aes;
	}

	// What goes over the wire: the text itself for groups, an encrypted envelope for DMs.
	async e2eWire(ch, text) {
		if (ch?.kind !== "dm" || !text) return text;
		if (!this.e2eSupported()) throw new Error("this device can't do encryption");
		await this.e2ePublish();
		const aes = await this.peerKey(this.dmPeerId(ch));
		if (!aes) throw new Error(`${ch.name || "They"} needs to update Acode Messages first`);
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(text)));
		const out = new Uint8Array(12 + ct.length);
		out.set(iv);
		out.set(ct, 12);
		return E2E_PREFIX + e2eToB64(out);
	}

	// Text of one envelope. Plain text (older messages) passes through. null means it can't be read.
	async e2eRead(peerId, content, maxAge) {
		if (typeof content !== "string" || !content.startsWith(E2E_PREFIX)) return content;
		let raw;
		try {
			raw = e2eFromB64(content.slice(E2E_PREFIX.length));
		} catch {
			return null;
		}
		if (raw.length < 29) return null;
		const iv = raw.slice(0, 12);
		const ct = raw.slice(12);
		for (const force of [false, true]) {
			try {
				const aes = await this.peerKey(peerId, force, maxAge);
				if (!aes) return null;
				return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes, ct));
			} catch {}
		}
		return null;
	}

	// Decrypts a batch of messages from a DM in place. Groups are left alone.
	async decryptMessages(ch, list) {
		if (ch?.kind !== "dm" || !Array.isArray(list) || !this.e2eSupported()) return list;
		const pid = this.dmPeerId(ch);
		if (pid == null) return list;
		try {
			await this.e2eIdentity();
		} catch {}
		for (const m of list) {
			if (typeof m?.content !== "string" || !m.content.startsWith(E2E_PREFIX)) continue;
			const t = await this.e2eRead(pid, m.content);
			m.enc = true;
			if (t == null) {
				m.content = E2E_LOCKED;
				m.locked = true;
			} else m.content = t;
		}
		return list;
	}
}
