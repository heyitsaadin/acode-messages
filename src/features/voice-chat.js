export class VoiceChatMethods {
	/* ---------- live voice chat (WebRTC, peer to peer; the server only passes setup messages) ---------- */

	// Polls who is in this chat's voice room, so the green strip can show before you join.
	vStatus() {
		clearTimeout(this.vStatusT);
		const c = this.state.channel;
		if (this.view !== "chat" || !c || !this.$page) return;
		if (!(this.voice && this.voice.slug === c.slug)) {
			this.api(`voice?channel=${encodeURIComponent(c.slug)}`)
				.then((r) => {
					if (this.state.channel === c) {
						this.vPeers = r.peers || [];
						this.vPaint();
					}
				})
				.catch(() => {});
		}
		this.vStatusT = setTimeout(() => this.vStatus(), 8000);
	}

	vPaint() {
		const c = this.state.channel;
		const v = this.voice;
		const inHere = !!v && !!c && v.slug === c.slug;
		const peers = inHere ? v.roster : this.vPeers || [];
		if (this.$vbar) {
			const show = this.view === "chat" && (inHere || peers.length > 0);
			this.$vbar.classList.toggle("show", show);
			const b = this.$vbar.querySelector("b");
			if (show && b) b.textContent = inHere ? `You're in voice · ${peers.length} connected` : `${peers.length} in voice chat · tap to join`;
		}
		if (this.$vchip) {
			const show = !!v && this.view === "home";
			this.$vchip.classList.toggle("show", show);
			const b = this.$vchip.querySelector("b");
			if (show && b) b.textContent = `Voice connected · ${v.channel.kind === "dm" ? v.channel.name : `#${v.channel.name}`}`;
		}
		this.$vbtn?.classList.toggle("live", inHere);
		if (this.$sheet?.dataset.vp === "1") this.vPaintPanel();
	}

	voicePanel() {
		const c = this.state.channel;
		if (!c) return;
		const el = this.el.bind(this);
		this.vUi = { grid: el("div", { class: "am-vp" }), foot: el("div"), rings: new Map(), sig: "" };
		this.sheet(c.kind === "dm" ? `Voice · ${c.name}` : `Voice · #${c.name}`, this.vUi.grid, this.vUi.foot);
		if (this.$sheet.classList.contains("open")) this.$sheet.dataset.vp = "1";
		this.vPaintPanel();
	}

	vPaintPanel() {
		const ui = this.vUi;
		const c = this.state.channel;
		if (!ui || !c) return;
		const el = this.el.bind(this);
		const v = this.voice;
		const inHere = !!v && v.slug === c.slug;
		const peers = inHere ? v.roster : this.vPeers || [];
		const mine = String(this.me.id);
		const now = Date.now();
		let stuck = false;
		const stateOf = (id) => {
			if (id === mine) return v?.muted ? "Muted" : "";
			if (!inHere) return "";
			const p = v.pcs.get(id);
			const st = p?.pc.connectionState;
			if (st === "connected") return "";
			if (st === "failed" || now - (p?.since || v.since) > 15000) {
				stuck = true;
				return "can't connect";
			}
			return "connecting…";
		};
		const states = peers.map((p) => stateOf(String(p.id)));
		const sig = [inHere, v?.slug, v?.muted, stuck, peers.map((p, i) => `${p.id}:${states[i]}`).join(",")].join("|");
		if (sig === ui.sig) return;
		ui.sig = sig;
		ui.rings = new Map();
		const tiles = peers.map((p, i) => {
			const id = String(p.id);
			const tile = el("div", { class: `am-vpp${v?.speaking?.has(id) ? " speaking" : ""}` }, el("div", { class: "ring" }, this.avatar(p, 58)), el("b", { text: id === mine ? "You" : p.name }), el("small", { text: states[i] }));
			ui.rings.set(id, tile);
			return tile;
		});
		this.put(ui.grid, ...(tiles.length ? tiles : [el("div", { class: "am-note", text: "Nobody is in voice right now." })]));
		const btns = [];
		if (!v) btns.push(el("button", { class: "am-go", text: peers.length ? "Join voice" : "Start voice chat", onclick: () => this.voiceJoin(c) }));
		else if (inHere) btns.push(el("button", { class: "am-pillb", text: v.muted ? "Unmute" : "Mute", onclick: () => this.voiceMute() }), el("button", { class: "am-pillb danger", text: "Leave", onclick: () => this.voiceLeave() }));
		else btns.push(el("button", { class: "am-pillb danger", text: `Leave voice in ${v.channel.kind === "dm" ? v.channel.name : `#${v.channel.name}`}`, onclick: () => this.voiceLeave() }));
		this.put(
			ui.foot,
			stuck ? el("div", { class: "am-sub", style: "padding:0 14px 8px", text: "Some people can't connect. On mobile data this usually needs a TURN server (see the server readme)." }) : null,
			el("div", { class: "am-vact" }, ...btns),
		);
	}

	vPaintSpeaking() {
		const v = this.voice;
		if (!this.vUi) return;
		for (const [id, tile] of this.vUi.rings) tile.classList.toggle("speaking", !!v?.speaking.has(id));
	}

	async voiceJoin(c) {
		if (this.vBusy || this.voice) return;
		if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return this.flash("Voice chat isn't supported on this device");
		if (c.kind !== "dm" && this.isMuted(this.group)) return this.flash(`You're muted ${this.untilText(this.group.muted_until)}`);
		if (this.rec) this.recStop(false);
		this.vBusy = true;
		try {
			let stream;
			try {
				stream = await this.getMic();
			} catch (e) {
				return this.flash(this.micError(e));
			}
			let r;
			try {
				r = await this.api("voice", { method: "POST", body: JSON.stringify({ channel: c.slug, action: "join" }) });
			} catch (e) {
				stream.getTracks().forEach((t) => t.stop());
				return this.flash(`Couldn't join voice (${e.message})`);
			}
			const v = {
				slug: c.slug,
				channel: c,
				stream,
				pcs: new Map(),
				after: 0,
				ice: r.ice,
				roster: r.peers || [],
				muted: false,
				queue: [],
				fails: 0,
				speaking: new Set(),
				meters: new Map(),
				since: Date.now(),
				dead: false,
			};
			this.voice = v;
			this.vMeterInit(v);
			this.vSyncPeers(v, true);
			this.vPaint();
			this.vPoll(v);
		} finally {
			this.vBusy = false;
		}
	}

	voiceMute() {
		const v = this.voice;
		if (!v) return;
		v.muted = !v.muted;
		v.stream.getAudioTracks().forEach((t) => (t.enabled = !v.muted));
		this.vPaint();
	}

	voiceLeave() {
		const v = this.voice;
		if (!v) return;
		this.voice = null;
		v.dead = true;
		clearTimeout(v.timer);
		clearTimeout(v.flushT);
		clearInterval(v.meterT);
		for (const id of [...v.pcs.keys()]) this.vDrop(v, id);
		v.stream.getTracks().forEach((t) => t.stop());
		try {
			v.ac?.close();
		} catch {}
		this.api("voice", { method: "POST", body: JSON.stringify({ channel: v.slug, action: "leave" }) }).catch(() => {});
		this.vPeers = [];
		if (this.$sheet?.dataset.vp === "1") this.closeSheet();
		this.vPaint();
		this.vStatus();
	}

	// Only the person who just joined sends offers; everyone already in the room waits for them.
	vSyncPeers(v, initial) {
		const mine = String(this.me.id);
		const ids = new Set(v.roster.map((p) => String(p.id)).filter((id) => id !== mine));
		if (initial) for (const id of ids) this.vConnect(v, id, true);
		for (const id of [...v.pcs.keys()]) if (!ids.has(id)) this.vDrop(v, id);
	}

	vConnect(v, id, initiator) {
		this.vDrop(v, id);
		const pc = new RTCPeerConnection({ iceServers: v.ice });
		const peer = { id, pc, audio: null, pending: [], since: Date.now() };
		v.pcs.set(id, peer);
		v.stream.getTracks().forEach((t) => pc.addTrack(t, v.stream));
		pc.onicecandidate = (e) => e.candidate && this.vQueue(v, id, "ice", JSON.stringify(e.candidate));
		pc.ontrack = (e) => this.vAttach(v, peer, e.streams[0] || new MediaStream([e.track]));
		pc.onconnectionstatechange = () => {
			if (pc.connectionState === "failed" && !v.dead) this.vRetry(v, peer);
			this.vPaint();
		};
		if (initiator) this.vOffer(v, peer);
		return peer;
	}

	async vOffer(v, peer) {
		try {
			await peer.pc.setLocalDescription(await peer.pc.createOffer());
			this.vQueue(v, peer.id, "offer", JSON.stringify(peer.pc.localDescription));
		} catch {}
	}

	// A broken link is rebuilt by whichever side has the lower id, so the two never offer at once.
	vRetry(v, peer) {
		if (Number(this.me.id) > Number(peer.id)) return;
		setTimeout(() => {
			if (!v.dead && v.pcs.get(peer.id) === peer && v.roster.some((p) => String(p.id) === peer.id)) this.vConnect(v, peer.id, true);
		}, 1000);
	}

	vDrop(v, id) {
		const p = v.pcs.get(id);
		if (!p) return;
		v.pcs.delete(id);
		try {
			p.pc.onconnectionstatechange = null;
			p.pc.onicecandidate = null;
			p.pc.ontrack = null;
			p.pc.close();
		} catch {}
		if (p.audio) {
			p.audio.srcObject = null;
			p.audio = null;
		}
		const m = v.meters.get(id);
		if (m) {
			try {
				m.src.disconnect();
			} catch {}
			v.meters.delete(id);
		}
		v.speaking.delete(id);
	}

	vAttach(v, peer, stream) {
		const a = new Audio();
		a.autoplay = true;
		a.srcObject = stream;
		peer.audio = a;
		a.play?.().catch(() => {});
		this.vMeterAdd(v, peer.id, stream);
	}

	vQueue(v, to, kind, payload) {
		v.queue.push({ to: Number(to), kind, payload });
		if (!v.flushT) v.flushT = setTimeout(() => this.vFlush(v), 200);
	}

	async vFlush(v) {
		v.flushT = null;
		while (v.queue.length && !v.dead) {
			const batch = v.queue.splice(0, 30);
			try {
				await this.api("voice", { method: "POST", body: JSON.stringify({ channel: v.slug, action: "signal", signals: batch }) });
			} catch {}
		}
	}

	async vPoll(v) {
		if (v.dead) return;
		try {
			const r = await this.api(`voice?channel=${encodeURIComponent(v.slug)}&after=${v.after}`);
			if (v.dead) return;
			v.fails = 0;
			if (!r.joined) {
				// Dropped for being silent too long (bad signal). Everyone else has let go of us, so start over.
				const j = await this.api("voice", { method: "POST", body: JSON.stringify({ channel: v.slug, action: "join" }) });
				if (v.dead) return;
				for (const id of [...v.pcs.keys()]) this.vDrop(v, id);
				v.after = 0;
				v.roster = j.peers || [];
				v.ice = j.ice || v.ice;
				v.since = Date.now();
				this.vSyncPeers(v, true);
			} else {
				v.roster = r.peers;
				for (const sg of r.signals) {
					v.after = Math.max(v.after, Number(sg.id));
					await this.vSignal(v, sg);
				}
				this.vSyncPeers(v, false);
				for (const p of v.pcs.values()) if (p.audio?.paused) p.audio.play().catch(() => {});
			}
			this.vPaint();
		} catch {
			if (++v.fails >= 6) {
				this.flash("Voice connection lost");
				return this.voiceLeave();
			}
		}
		if (v.dead) return;
		const settled = v.pcs.size > 0 && [...v.pcs.values()].every((p) => p.pc.connectionState === "connected");
		v.timer = setTimeout(() => this.vPoll(v), settled ? 2500 : 1200);
	}

	async vSignal(v, sg) {
		const id = String(sg.from_user);
		let data;
		try {
			data = JSON.parse(sg.payload);
		} catch {
			return;
		}
		try {
			if (sg.kind === "offer") {
				// If we both offered at once, the lower id keeps its own offer and the higher id answers.
				const have = v.pcs.get(id);
				if (have && have.pc.signalingState === "have-local-offer" && Number(this.me.id) < Number(id)) return;
				const peer = this.vConnect(v, id, false);
				await peer.pc.setRemoteDescription(data);
				await this.vFlushIce(peer);
				await peer.pc.setLocalDescription(await peer.pc.createAnswer());
				this.vQueue(v, id, "answer", JSON.stringify(peer.pc.localDescription));
			} else if (sg.kind === "answer") {
				const peer = v.pcs.get(id);
				if (!peer || peer.pc.signalingState !== "have-local-offer") return;
				await peer.pc.setRemoteDescription(data);
				await this.vFlushIce(peer);
			} else if (sg.kind === "ice") {
				const peer = v.pcs.get(id);
				if (!peer) return;
				if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data).catch(() => {});
				else peer.pending.push(data);
			}
		} catch {}
	}

	async vFlushIce(peer) {
		for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
	}

	// Green ring around whoever is talking: a small level meter per stream, nothing leaves the device.
	vMeterInit(v) {
		try {
			v.ac = new (window.AudioContext || window.webkitAudioContext)();
			v.ac.resume?.();
		} catch {
			v.ac = null;
		}
		if (!v.ac) return;
		this.vMeterAdd(v, String(this.me.id), v.stream);
		v.meterT = setInterval(() => this.vMeterTick(v), 160);
	}

	vMeterAdd(v, id, stream) {
		if (!v.ac) return;
		try {
			const an = v.ac.createAnalyser();
			an.fftSize = 512;
			const src = v.ac.createMediaStreamSource(stream);
			src.connect(an);
			v.meters.set(id, { an, src, buf: new Uint8Array(an.fftSize), hold: 0 });
		} catch {}
	}

	vMeterTick(v) {
		if (v.dead) return;
		let changed = false;
		for (const [id, m] of v.meters) {
			m.an.getByteTimeDomainData(m.buf);
			let sum = 0;
			for (let i = 0; i < m.buf.length; i++) {
				const d = (m.buf[i] - 128) / 128;
				sum += d * d;
			}
			m.hold = Math.sqrt(sum / m.buf.length) > 0.035 ? 4 : Math.max(0, m.hold - 1);
			const on = m.hold > 0;
			if (on !== v.speaking.has(id)) {
				if (on) v.speaking.add(id);
				else v.speaking.delete(id);
				changed = true;
			}
		}
		if (changed) this.vPaintSpeaking();
	}
}
