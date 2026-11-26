import { ICON_CLASS, NOTIFY_MS, NOTIFY_HIDDEN_MS } from "../constants.js";
import { ls } from "../util.js";

const NF_KEEP = 40; // entries kept in the activity list
const NF_BURST = 3; // more popups than this at once collapse into a single summary

export class NotificationsMethods {
	/* ---------- notifications: activity list, in-app popups and the background check ---------- */

	/* settings */

	notifyOn() {
		return this.settings.notifyEnabled !== false;
	}

	// What group messages notify: only @mentions (default), every message, or nothing. DMs always notify.
	notifyGroupMode() {
		const m = this.settings.notifyGroups;
		return m === "all" || m === "off" ? m : "mentions";
	}

	notifySettings() {
		const on = this.notifyOn();
		const labels = { mentions: "Mentions only", all: "Every message", off: "Off" };
		return [
			{ key: "notifyEnabled", text: "Message notifications", info: "Show a notification when someone messages or @mentions you while Acode is open.", checkbox: on, value: on },
			{
				key: "notifyGroups",
				text: "Group notifications",
				info: "Which group messages notify you. Direct messages always do.",
				select: [["mentions", labels.mentions], ["all", labels.all], ["off", labels.off]],
				value: this.notifyGroupMode(),
				valueText: (v) => labels[v] || labels.mentions,
			},
		];
	}

	// Called from the settings page. Returns true when the key was one of ours.
	notifyChanged(key, value) {
		if (key === "notifyEnabled") {
			const on = !!value;
			this.settings.notifyEnabled = on;
			this.appSettings.update();
			this.nfRestart(on); // turning it back on starts fresh, with no pile of old alerts
			return true;
		}
		if (key === "notifyGroups") {
			this.settings.notifyGroups = String(value);
			this.appSettings.update();
			return true;
		}
		return false;
	}

	/* the background check: runs from startup, whether or not the chat is open */

	nfStart() {
		this.nfRun = true;
		if (!this.nfVis) {
			// Coming back to Acode: catch up straight away.
			this.nfVis = () => {
				if (!document.hidden && this.nfRun) this.nfSoon(1500);
			};
			document.addEventListener("visibilitychange", this.nfVis);
		}
		this.nfSoon(6000);
	}

	nfStop() {
		this.nfRun = false;
		clearTimeout(this.nfT);
		if (this.nfVis) document.removeEventListener("visibilitychange", this.nfVis);
		this.nfVis = null;
	}

	nfRestart(reset) {
		this.nfStop();
		if (reset) {
			const nf = this.nfEnsure();
			if (nf) {
				nf.init = false;
				this.nfSave();
			}
		}
		this.nfFail = 0;
		this.nfStart();
	}

	nfSoon(ms) {
		clearTimeout(this.nfT);
		if (this.nfRun) this.nfT = setTimeout(() => this.nfTick(), ms);
	}

	async nfTick() {
		if (!this.nfRun) return;
		if (this.nfBusy) return this.nfSoon(NOTIFY_MS);
		this.nfBusy = true;
		try {
			if (this.notifyOn()) await this.nfPoll();
			this.nfFail = 0;
		} catch {
			// Server unreachable, or not updated yet: wait longer each time, up to 5 minutes.
			this.nfFail = Math.min((this.nfFail || 0) + 1, 4);
		}
		this.nfBusy = false;
		const base = !this.notifyOn() ? 60000 : document.hidden ? NOTIFY_HIDDEN_MS : NOTIFY_MS;
		this.nfSoon(Math.min(base * 2 ** (this.nfFail || 0), 300000));
	}

	async nfPoll() {
		const nf = this.nfEnsure();
		if (!nf) return; // not signed in
		if (!this.state.user) this.state.user = this.cachedUser();
		const d = await this.api(`notify?since=${nf.init ? nf.cursor : 0}`);
		if (this.nf !== nf) return; // switched accounts while waiting
		await this.nfIngest(d, !nf.init);
	}

	// Turns what the server sent into list entries and popups. The first run only sets the starting point.
	async nfIngest(d, baseline) {
		const nf = this.nf;
		const mode = this.notifyGroupMode();
		const fresh = new Map(); // key -> { e, n } for this round's popups
		if (!baseline) {
			for (const m of d.items || []) {
				const id = Number(m.id);
				if (!(id > nf.cursor)) continue;
				const dm = m.channel_kind === "dm";
				if (!dm && mode === "off") continue;
				if (this.nfLooking(m.slug)) continue; // you're reading it right now
				const kind = m.kind || "text";
				let text;
				if (kind !== "text") text = kind === "image" ? "📷 Photo" : kind === "voice" ? "🎤 Voice message" : dm ? "📎 File" : `📎 ${m.content || "File"}`;
				else if (dm) text = await this.nfDecrypt(m);
				else text = String(m.content || "");
				const mention = !dm && kind === "text" && this.nfMentions(text);
				if (!dm && mode === "mentions" && !mention) continue;
				const type = dm ? "dm" : mention ? "mention" : "message";
				const key = `${type}:${m.slug}`;
				const old = nf.items.find((x) => x.key === key);
				const unread = old && old.id > nf.readId ? old.n : 0;
				nf.items = nf.items.filter((x) => x !== old);
				const e = {
					key,
					type,
					id,
					slug: m.slug,
					name: m.name,
					avatar_url: m.avatar_url,
					user_id: m.user_id,
					group_id: m.group_id,
					group_name: m.group_name,
					channel_name: m.channel_name,
					text,
					n: unread + 1,
					at: Date.parse(m.created_at) || Date.now(),
				};
				nf.items.unshift(e);
				fresh.set(key, { e, n: (fresh.get(key)?.n || 0) + 1 });
			}
			nf.items = nf.items.slice(0, NF_KEEP);
		}
		// Friend requests that weren't there last time.
		const reqs = Array.isArray(d.requests) ? d.requests : [];
		const newReqs = baseline ? [] : reqs.filter((r) => !nf.reqSeen.includes(String(r.id)));
		nf.reqSeen = reqs.map((r) => String(r.id));
		if (Number.isFinite(Number(d.latest))) nf.cursor = Number(d.latest);
		nf.init = true;
		this.nfSave();
		this.nfPaint();
		this.nfPopups(fresh, newReqs);
	}

	async nfDecrypt(m) {
		const c = m.content;
		if (typeof c !== "string" || !c) return null;
		if (!c.startsWith("e2e1:")) return c; // older plain-text DMs
		if (!this.e2eSupported()) return null;
		try {
			return await this.e2eRead(m.user_id, c, 600000);
		} catch {
			return null;
		}
	}

	// Same rule the chat uses to highlight a mention.
	nfMentions(text) {
		const n = this.me?.name;
		return !!n && String(text || "").toLowerCase().includes(`@${n.toLowerCase()}`);
	}

	// True while that chat is open and on screen, so it doesn't alert you about what you're reading.
	nfLooking(slug) {
		return !!this.$page && this.view === "chat" && this.state.channel?.slug === slug && !document.hidden && this.tabOn !== false;
	}

	nfPreview(text) {
		return this.plainPreview(text || "").replace(/\s+/g, " ").trim().slice(0, 100);
	}

	/* popups: Acode's own notification (acode.pushNotification, Acode 1.10.6+), a toast on older versions */

	nfPopups(fresh, reqs) {
		const jobs = [];
		for (const { e, n } of fresh.values()) {
			const pv = this.nfPreview(e.text);
			let title;
			let body;
			let quiet = false;
			if (e.type === "dm") {
				title = e.name;
				body = n > 1 ? `${n} new messages` : pv || "New message";
			} else if (e.type === "mention") {
				title = `${e.name} mentioned you`;
				body = `#${e.channel_name} · ${e.group_name}${pv ? `: ${pv}` : ""}`;
			} else {
				title = `#${e.channel_name} · ${e.group_name}`;
				body = n > 1 ? `${n} new messages` : `${e.name}${pv ? `: ${pv}` : ""}`;
				quiet = true; // ordinary group chatter goes away on its own
			}
			jobs.push({ title, body, quiet, action: () => this.nfOpen(e) });
		}
		for (const r of reqs) jobs.push({ title: "Friend request", body: `${r.name} wants to be your friend`, quiet: false, action: () => this.nfOpenBell() });
		const total = jobs.length;
		if (!total) return;
		if (total > NF_BURST) {
			this.nfShow({ title: "Acode Messages", body: `${total} new notifications`, quiet: false, action: () => this.nfOpenBell() });
			return;
		}
		for (const j of jobs) this.nfShow(j);
	}

	nfShow({ title, body, quiet, action }) {
		try {
			if (typeof acode.pushNotification === "function") {
				acode.pushNotification(title, body, { icon: ICON_CLASS, autoClose: !!quiet, type: "info", action });
				return;
			}
		} catch {}
		try {
			const toast = acode.require("toast") || window.toast;
			if (typeof toast === "function") toast(`${title}: ${body}`, 4000);
		} catch {}
	}

	// Tapping a popup or a row: open Acode Messages (or bring its tab forward) and go to that chat.
	async nfOpen(e) {
		try {
			await this.open();
		} catch {
			return;
		}
		if (!this.$page) return;
		this.closeSheet();
		this.openChannel(
			e.type === "dm"
				? { slug: e.slug, name: e.name, kind: "dm", peer: { id: String(e.user_id), name: e.name, avatar_url: e.avatar_url } }
				: { slug: e.slug, name: e.channel_name, kind: "text", group_id: e.group_id },
		);
	}

	// Open Acode Messages on the notifications page.
	async nfOpenBell() {
		try {
			await this.open();
		} catch {
			return;
		}
		if (!this.$page) return;
		// A sheet can't open in the first instant after the page appears.
		const wait = 800 - (Date.now() - (this.openedAt || 0));
		if (wait > 0) await new Promise((r) => setTimeout(r, wait));
		if (this.$page) this.notifications();
	}

	/* the list on the notifications page */

	nfEnsure() {
		const u = this.state.user || this.cachedUser();
		if (!u?.id) return null;
		const uid = String(u.id);
		if (!this.nf || this.nf.uid !== uid) {
			const s = ls.get(`am-nf:${uid}`) || {};
			this.nf = {
				uid,
				init: !!s.init,
				cursor: Number(s.cursor) || 0,
				readId: Number(s.readId) || 0,
				items: Array.isArray(s.items) ? s.items : [],
				reqSeen: Array.isArray(s.reqSeen) ? s.reqSeen.map(String) : [],
			};
		}
		return this.nf;
	}

	nfSave() {
		const nf = this.nf;
		if (!nf) return;
		// Decrypted DM text is never written to storage, same as the chats themselves.
		const items = nf.items.map((i) => (i.type === "dm" ? { ...i, text: null } : i));
		ls.set(`am-nf:${nf.uid}`, { init: nf.init, cursor: nf.cursor, readId: nf.readId, reqSeen: nf.reqSeen, items });
	}

	nfItems() {
		return this.nfEnsure()?.items || [];
	}

	nfReadId() {
		return this.nfEnsure()?.readId || 0;
	}

	// How many list entries you haven't looked at yet (added to the bell's badge).
	nfUnread() {
		const nf = this.nfEnsure();
		return nf ? nf.items.filter((i) => i.id > nf.readId).length : 0;
	}

	nfPaint() {
		if (this.$page && this.$me) this.paintMe();
	}

	nfMarkRead() {
		const nf = this.nfEnsure();
		if (!nf || nf.readId >= nf.cursor) return;
		nf.readId = nf.cursor;
		this.nfSave();
		this.nfPaint();
	}

	nfClear() {
		const nf = this.nfEnsure();
		if (!nf) return;
		nf.items = [];
		nf.readId = nf.cursor;
		this.nfSave();
		this.nfPaint();
	}

	// You opened that chat, so its entries are done.
	nfSeen(slug) {
		const nf = this.nf;
		if (!nf || !nf.items.some((i) => i.slug === slug)) return;
		nf.items = nf.items.filter((i) => i.slug !== slug);
		this.nfSave();
		this.nfPaint();
	}

	activityRow(n, since) {
		const el = this.el.bind(this);
		const pv = this.nfPreview(n.text);
		let title;
		let line;
		if (n.type === "dm") {
			title = n.name;
			line = n.n > 1 ? `${n.n} new messages${pv ? ` · ${pv}` : ""}` : pv || "New message";
		} else if (n.type === "mention") {
			title = `${n.name} mentioned you`;
			line = `${n.n > 1 ? `${n.n} mentions · ` : ""}#${n.channel_name} · ${n.group_name}${pv ? ` · ${pv}` : ""}`;
		} else {
			title = `#${n.channel_name} · ${n.group_name}`;
			line = n.n > 1 ? `${n.n} new messages` : `${n.name}${pv ? `: ${pv}` : ""}`;
		}
		return el(
			"div",
			{
				class: `am-dm am-act${n.id > since ? " unread" : ""}`,
				onclick: () => {
					this.closeSheet();
					this.nfOpen(n);
				},
			},
			this.avw({ name: n.name, avatar_url: n.avatar_url }, 46),
			el("div", { class: "bd" }, el("b", { text: title }), el("small", { text: line })),
			el("time", { text: this.shortTime(new Date(n.at)) }),
		);
	}
}
