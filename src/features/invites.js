import { peerOf } from "../util.js";

// Links to this server's invite page: https://<server>/invite/<code>. The host has to match the server the plugin
// is set to, so a link to some other site never makes the plugin call anything.
const INVITE_RE = /https?:\/\/([^\s/]+)\/invite\/([a-z0-9]{4,20})(?![a-z0-9])/gi;
const INVITE_MS = 60000; // how long a loaded invite is reused before the server is asked again
const INVITE_CARDS = 2; // invite cards shown under one message

export class InvitesMethods {
	/* ---------- invite links ---------- */

	inviteLink(g) {
		return `${this.base}/invite/${g.invite_code}`;
	}

	// "jh9gby", "JH9GBY" or a whole invite link -> the code. Anything else comes back as typed, so the server can say it's invalid.
	inviteCodeFrom(text) {
		const s = String(text || "").trim();
		const m = /\/invite\/([a-z0-9]+)/i.exec(s);
		return (m ? m[1] : s).toLowerCase();
	}

	// Codes of the invite links to this server inside a message, in order, without repeats.
	inviteCodesIn(text) {
		let host = "";
		try {
			host = new URL(this.base).host.toLowerCase();
		} catch {}
		if (!host) return [];
		const out = [];
		for (const m of String(text || "").matchAll(INVITE_RE)) {
			const code = m[2].toLowerCase();
			if (m[1].toLowerCase() === host && !out.includes(code)) out.push(code);
		}
		return out;
	}

	/* ---------- the card in a message ---------- */

	// Message text, with a Join card under it for every invite link to this server.
	richText(text) {
		const codes = text.includes("/invite/") ? this.inviteCodesIn(text) : [];
		const body = this.richBlocks(text);
		if (!codes.length) return body;
		const f = document.createDocumentFragment();
		f.append(body, ...codes.slice(0, INVITE_CARDS).map((c) => this.inviteCard(c)));
		return f;
	}

	inviteLoad(code) {
		const cache = (this.invCache = this.invCache || new Map());
		const hit = cache.get(code);
		if (hit && Date.now() - hit.at < INVITE_MS) return hit.p;
		const p = this.api(`groups?invite=${encodeURIComponent(code)}`).then((r) => {
			if (!r?.invite) throw new Error("invalid invite");
			return r.invite;
		});
		const rec = { at: Date.now(), p };
		cache.set(code, rec);
		// Only a real "no such invite" is remembered; a network hiccup is retried the next time the card is drawn.
		p.catch((e) => {
			if (!/invalid invite/i.test(e?.message || "") && cache.get(code) === rec) cache.delete(code);
		});
		return p;
	}

	inviteCard(code) {
		const $box = this.el("div", { class: "am-invite" }, this.sk("100%", 200, 16));
		const settle = () => {
			// The card grows once it has loaded; keep the chat pinned to the bottom if it was there.
			const L = this.$list;
			if (L && L.scrollHeight - L.scrollTop - L.clientHeight < 500) L.scrollTop = L.scrollHeight;
		};
		const load = () => {
			this.put($box, this.sk("100%", 200, 16));
			this.inviteLoad(code).then(
				(inv) => {
					this.inviteFill($box, code, inv);
					settle();
				},
				(e) => {
					this.inviteFail($box, e, load);
					settle();
				},
			);
		};
		load();
		return $box;
	}

	inviteFail($box, e, retry) {
		const msg = e?.message || "";
		// An older server doesn't know invites yet: leave just the link, no card.
		if (/HTTP (404|405|501)/.test(msg)) return $box.remove();
		const el = this.el.bind(this);
		const bad = /invalid invite/i.test(msg);
		const $x = el("div", { class: "am-inv-x" }, this.ico("link", 22), el("div", {}, el("b", { text: bad ? "Invite invalid" : "Couldn't load this invite" }), el("small", { text: bad ? "This invite link doesn't work anymore." : `${msg || "Network error"}. Tap to try again.` })));
		if (!bad) $x.onclick = retry;
		this.put($box, $x);
	}

	inviteFill($box, code, inv) {
		const el = this.el.bind(this);
		const c = this.commNorm({ id: inv.group_id, name: inv.name, description: inv.description, icon: inv.icon, banner: inv.banner, member_count: inv.member_count, online_count: inv.online_count, verified: inv.verified });
		const $card = this.commCard(c);
		const $go = el("button", { class: "am-go ok" });
		const $e = el("div", { class: "am-ferr" });
		const mine = () => (this.state.home?.groups || []).some((g) => String(g.id) === String(inv.group_id));
		// Called again for every card on screen after you join, so they all flip to "Go to Server".
		$box._repaint = () => {
			$go.disabled = false;
			$go.textContent = mine() ? "Go to Server" : "Join";
		};
		$box._repaint();
		$go.onclick = async (ev) => {
			ev.stopPropagation();
			if ($go.disabled) return;
			$e.textContent = "";
			if (mine()) {
				this.showHome();
				this.setTab(inv.group_id);
				return;
			}
			$go.disabled = true;
			$go.textContent = "Joining…";
			try {
				await this.api("groups", { method: "POST", body: JSON.stringify({ action: "join", code }) });
				await this.refreshHome();
				this.flash(`Joined ${inv.name}`);
				this.$list?.querySelectorAll(".am-invite").forEach(($b) => $b._repaint?.());
			} catch (e) {
				$e.textContent = e.message;
			}
			$box._repaint();
		};
		$card.querySelector(".bd").append($go, $e);
		this.put($box, $card);
	}

	/* ---------- the Invite people sheet ---------- */

	inviteSheet(g) {
		g = this.fresh(g);
		const link = this.inviteLink(g);
		this.sheet(
			"Invite people",
			this.el("div", { class: "am-sub", style: "margin:0 14px 8px", text: "Send this link in any chat and it turns into a Join card. You can also open it in a browser." }),
			this.el("div", { class: "am-invlink", text: link }),
			this.item("send", "Send to a friend", () => this.inviteSend(g), "", "Message the link straight to someone"),
			this.copyItem("link", "Copy invite link", link),
			this.copyItem("copy", `Invite code: ${g.invite_code}`, g.invite_code),
			this.item("close", "Back", () => this.groupMenu(g)),
		);
	}

	// Everyone you already chat with, then friends you haven't messaged yet. Tap Send and the link goes out as a message.
	inviteSend(g) {
		g = this.fresh(g);
		const el = this.el.bind(this);
		const home = this.state.home || {};
		const dms = home.dms || [];
		const talking = new Set(dms.map((d) => String(d.peer_id)));
		const friends = (home.friends || []).filter((f) => !talking.has(String(f.peer_id)));
		const rows = [...dms, ...friends].map((r) => this.inviteRow(g, r));
		this.sheet(
			`Invite to ${g.name}`,
			el("div", { class: "am-sub", style: "margin:0 14px 8px", text: "The link arrives as a normal message. In a direct message it is end-to-end encrypted like the rest." }),
			...(rows.length ? rows : [el("div", { class: "am-note", text: "No chats or friends yet. Copy the link instead, or add friends from the Direct Messages tab." })]),
			this.item("close", "Back", () => this.inviteSheet(g)),
		);
	}

	inviteRow(g, r) {
		const el = this.el.bind(this);
		const u = peerOf(r);
		const $btn = el("button", { class: "am-pillb pri", text: "Send" });
		const $sub = el("small", { text: u.online ? "Online" : "Offline" });
		$btn.onclick = async (e) => {
			e.stopPropagation();
			if ($btn.disabled) return;
			$btn.disabled = true;
			$btn.textContent = "…";
			try {
				await this.inviteSendTo(g, r);
				$btn.textContent = "Sent ✓";
				$btn.classList.remove("pri");
			} catch (err) {
				$btn.disabled = false;
				$btn.textContent = "Send";
				$sub.textContent = err.message || "Couldn't send";
			}
		};
		return el("div", { class: "am-dm" }, this.avw(u, 42, !!u.online), el("div", { class: "bd" }, el("b", {}, u.name, ...this.badges(u)), $sub), $btn);
	}

	// Posts the link to a DM without touching the message box, so a half-written message or reply isn't lost.
	async inviteSendTo(g, r) {
		let ch;
		if (r.slug) ch = { slug: r.slug, name: r.name, kind: "dm", peer: peerOf(r) };
		else {
			const { dm } = await this.api("dms", { method: "POST", body: JSON.stringify({ user_id: Number(r.peer_id ?? r.id) }) });
			ch = { slug: dm.slug, name: dm.name, kind: "dm", peer: peerOf(dm) };
		}
		const wire = await this.e2eWire(ch, this.inviteLink(g)); // DMs only accept encrypted text
		const { message } = await this.api("messages", { method: "POST", body: JSON.stringify({ channel: ch.slug, content: wire }) });
		// If that DM is the chat on screen, show the message right away instead of waiting for the next poll.
		if (this.view === "chat" && this.state.channel?.slug === ch.slug) {
			await this.decryptMessages(ch, [message]);
			if (Number(message.id) > this.lastId) this.append([message], true);
		}
		this.loadHome(true);
	}
}
