// Pop-up alerts: a small squircle card that slides in at the top when somebody writes to you in a DM, or @mentions
// you or replies to you in a group. Other group messages never pop up. The server side is GET /api/home?alerts=1&since=<id>
// (a light call, no home queries), asked every few seconds while the chat is open.
// The card lives in its own shadow root on the page itself, so it shows over the editor too, not only inside the chat tab.
const ALERT_MS = 4000; // how often to ask
const SHOW_MS = 5500; // how long a card stays
const STALE_MS = 120000; // a message older than this is not worth a pop-up any more

const TOAST_CSS = `
.t{position:absolute;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);max-width:420px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:11px 14px 11px 11px;border-radius:26px;background:var(--secondary-color,#2b2d31);color:var(--primary-text-color,#fff);box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 0 1px rgba(127,127,127,.25);pointer-events:auto;transform:translateY(-150%);opacity:0;transition:transform .4s cubic-bezier(.2,.9,.25,1.08),opacity .25s ease;touch-action:none;font:15px/1.3 system-ui,-apple-system,Roboto,sans-serif;-webkit-user-select:none;user-select:none}
@supports (corner-shape:squircle){.t{corner-shape:squircle;border-radius:40px}.av{corner-shape:squircle;border-radius:22px}}
.t.in{transform:none;opacity:1}
.t.out{transform:translateY(-150%);opacity:0}
.av{position:relative;width:44px;height:44px;border-radius:15px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#fff;overflow:hidden}
.av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.bd{flex:1;min-width:0}
.bd b{display:block;font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bd i{display:block;font-style:normal;font-size:12px;font-weight:600;color:#ff6b6e;margin-top:1px}
.bd small{display:block;margin-top:1px;font-size:14px;opacity:.82;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.t{transition:opacity .2s ease}}
`;

export class AlertMethods {
	/* ---------- pop-up alerts ---------- */

	// Called when the chat opens: from here on, ask the server for new messages that deserve a pop-up.
	alertStart() {
		this.alertStop();
		this.alertOff = false;
		this.alertCursor = null; // the first answer only says where "now" is, so old messages are never replayed
		this.alertSeen = new Set();
		this.alertT = setTimeout(() => this.alertPoll(), 2000);
	}

	alertStop() {
		clearTimeout(this.alertT);
		this.alertT = null;
		this.toastQ = [];
		this.toastHide(true);
		this.$toastHost?.remove();
		this.$toastHost = this.$toastRoot = null;
	}

	async alertPoll() {
		if (!this.$page) return;
		let more = false;
		try {
			if (!document.hidden && this.state.user) {
				const d = await this.api(`home?alerts=1&since=${this.alertCursor || 0}`);
				if (!this.$page) return;
				if (typeof d?.cursor !== "number") {
					this.alertOff = true; // an older server answers with the whole home screen: don't keep asking
					return;
				}
				const first = this.alertCursor == null;
				this.alertCursor = Math.max(this.alertCursor || 0, d.cursor);
				if (!first) {
					for (const it of d.items || []) await this.alertItem(it);
					more = (d.items || []).length >= 10;
				}
			}
		} catch {}
		if (this.$page && !this.alertOff) this.alertT = setTimeout(() => this.alertPoll(), more ? 300 : ALERT_MS);
	}

	async alertItem(it) {
		if (!it || this.alertSeen.has(it.id)) return;
		this.alertSeen.add(it.id);
		if (Date.now() - new Date(it.at) > STALE_MS) return;
		if (this.watching() && this.state.channel?.slug === it.slug) return; // you are reading that chat right now
		const u = it.user || {};
		let text = it.content || "";
		if (it.dm) {
			try {
				const t = await this.e2eRead(u.id, text);
				text = t == null ? "🔒 New message" : t;
			} catch {
				text = "🔒 New message";
			}
		}
		this.toastPush({
			slug: it.slug,
			user: u,
			title: it.dm ? u.name : `${u.name} · #${it.channel_name}`,
			label: it.dm ? "" : it.reply ? "Replied to you" : "Mentioned you",
			text: this.previewText({ kind: it.kind, content: text }),
			open: () => this.alertOpen(it),
		});
		this.playReceiveSound?.();
		// Bring the badges up to date right away instead of waiting for the next home refresh.
		if (Date.now() - (this.alertHomeAt || 0) > 3000) {
			this.alertHomeAt = Date.now();
			this.loadHome(true);
		}
	}

	// Tapping a card: bring the chat to the front and open that conversation.
	alertOpen(it) {
		if (!this.$page) return;
		try {
			this.tab?.makeActive?.();
		} catch {}
		const u = it.user || {};
		if (it.dm) {
			const peer = { id: u.id, name: u.name, avatar_url: u.avatar_url, verified: u.verified, acode_pro: u.acode_pro, is_admin: u.is_admin, is_plugin_admin: u.is_plugin_admin };
			this.openChannel({ slug: it.slug, name: u.name, kind: "dm", peer });
		} else this.openChannel({ slug: it.slug, name: it.channel_name, kind: "text", group_id: it.group_id });
	}

	toastHost() {
		if (this.$toastHost?.isConnected) return this.$toastRoot;
		const host = document.createElement("div");
		host.style.cssText = "position:fixed;left:0;right:0;top:0;height:0;z-index:2147483000;pointer-events:none";
		const root = host.attachShadow({ mode: "open" });
		const st = document.createElement("style");
		st.textContent = TOAST_CSS;
		root.append(st);
		document.body.append(host);
		this.$toastHost = host;
		this.$toastRoot = root;
		return root;
	}

	// One card at a time. A new message from the chat that is on screen replaces it; others wait their turn.
	toastPush(n) {
		this.toastQ = this.toastQ || [];
		const cur = this.toastCur;
		if (cur && cur.n.slug === n.slug) {
			this.toastQ.unshift(n);
			this.toastHide();
			return;
		}
		const at = this.toastQ.findIndex((x) => x.slug === n.slug);
		if (at >= 0) this.toastQ[at] = n;
		else this.toastQ.push(n);
		if (this.toastQ.length > 3) this.toastQ.shift();
		if (!cur) this.toastNext();
	}

	toastNext() {
		const n = this.toastQ.shift();
		if (!n) return;
		const root = this.toastHost();
		const u = n.user || {};
		const $av = this.el("div", { class: "av", text: this.initial(u.name) });
		$av.style.background = `hsl(${this.hue(u.name)} 42% 40%)`;
		if (u.avatar_url) {
			const $i = document.createElement("img");
			$i.onerror = () => $i.remove();
			$i.src = this.bannerSrc(u.avatar_url);
			$av.append($i);
		}
		const $t = this.el("div", { class: "t", role: "alert" }, $av, this.el("div", { class: "bd" }, this.el("b", { text: n.title }), n.label ? this.el("i", { text: n.label }) : null, this.el("small", { text: n.text || "" })));
		root.append($t);
		const cur = (this.toastCur = { n, $t, timer: null });
		void $t.offsetWidth; // so the slide-in animates
		$t.classList.add("in");
		const arm = () => {
			clearTimeout(cur.timer);
			cur.timer = setTimeout(() => this.toastHide(), SHOW_MS);
		};
		arm();
		// Tap opens the chat; drag up throws the card away.
		let y0 = null;
		let dy = 0;
		$t.addEventListener("pointerdown", (e) => {
			y0 = e.clientY;
			dy = 0;
			clearTimeout(cur.timer);
			$t.style.transition = "none";
			try {
				$t.setPointerCapture(e.pointerId);
			} catch {}
		});
		$t.addEventListener("pointermove", (e) => {
			if (y0 == null) return;
			dy = Math.min(0, e.clientY - y0);
			$t.style.transform = `translateY(${dy}px)`;
		});
		$t.addEventListener("pointerup", () => {
			if (y0 == null) return;
			const moved = dy;
			y0 = null;
			$t.style.transition = "";
			if (moved < -28) {
				$t.style.transform = "translateY(-150%)";
				$t.style.opacity = "0";
				this.toastHide();
				return;
			}
			$t.style.transform = "";
			if (moved > -8) {
				this.toastHide();
				n.open();
			} else arm();
		});
		$t.addEventListener("pointercancel", () => {
			if (y0 == null) return;
			y0 = null;
			$t.style.transition = "";
			$t.style.transform = "";
			arm();
		});
	}

	toastHide(now) {
		const cur = this.toastCur;
		if (!cur) return;
		clearTimeout(cur.timer);
		this.toastCur = null;
		if (now) {
			cur.$t.remove();
			return;
		}
		cur.$t.classList.remove("in");
		cur.$t.classList.add("out");
		setTimeout(() => {
			cur.$t.remove();
			if (!this.toastCur && this.toastQ?.length) this.toastNext();
		}, 340);
	}
}
