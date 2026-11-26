import { ls } from "../util.js";

export class ChatMethods {
	/* ---------- chat (Signal style) ---------- */

	openChannel(c) {
		clearTimeout(this.pollTimer);
		this.state.channel = c;
		this.nfSeen(c.slug);
		this.view = "chat";
		this.$root.classList.add("chat");
		this.lastId = 0;
		this.lastAuthor = null;
		this.lastDay = null;
		this.msgBuf = [];
		this.clearCtx();
		this.syncN = 0;
		this.$emo.classList.remove("show");
		this.recStop(false);
		this.stopVoiceMsg();
		this.pend = null;
		this.$pend?.classList.remove("show");
		this.$ta.value = "";
		this.$ta.style.height = "48px";
		this.syncFab();
		this.syncMute();
		this.paintChatHead();
		this.vPeers = [];
		this.vStatus();
		this.refreshOnline();
		this.resetList();
		// Show the last conversation straight away; only fetch what's new.
		const cache = c.kind === "dm" ? null : ls.get(`am-msgs:${c.slug}`);
		const fresh = cache?.list?.length && Date.now() - cache.at < 864e5;
		if (fresh) this.append(cache.list, true);
		else this.chatSkeleton();
		if (c.kind === "dm" && this.e2eSupported()) {
			// Make sure the other person can write to me, and fetch their key before the first message.
			this.e2ePublish().then(() => this.peerKey(this.dmPeerId(c), true)).catch(() => {});
		}
		this.pushBack();
		this.poll(true);
	}

	showHome() {
		clearTimeout(this.pollTimer);
		clearTimeout(this.vStatusT);
		this.recStop(false);
		this.stopVoiceMsg();
		this.closeSheet();
		this.view = "home";
		this.state.channel = null;
		this.$root?.classList.remove("chat");
		this.vPaint();
		this.loadHome(true);
	}

	// Discord-style header: back, "# channel >" with a live online count, and a members / profile button.
	paintChatHead() {
		const c = this.state.channel;
		if (!c) return;
		const g = this.group;
		const el = this.el.bind(this);
		this.$vbtn = el("button", { class: "am-btn", onclick: () => this.voicePanel() }, this.ico("headset", 22));
		let lead = null;
		let title;
		let sub;
		let right;
		if (c.kind === "dm") {
			lead = this.avw(c.peer, 38, !!c.peer.online);
			title = c.name;
			sub = [el("span", { text: c.peer.online ? "Online" : "Offline" })]; // the avatar already carries the presence dot
			right = el("div", { class: "am-hr" }, this.$vbtn, el("button", { class: "am-btn", onclick: () => this.profile(c.peer) }, this.ico("user", 22)));
		} else {
			title = `# ${c.name}`;
			const d = g ? this.gdata[g.id] : null;
			if (d?.members) sub = [el("span", { class: "am-pdot" }), el("span", { text: `${d.members.filter((m) => m.online).length} Online` })];
			else sub = [el("span", { text: g ? `${g.member_count} member${g.member_count === 1 ? "" : "s"}` : "" })];
			right = el("div", { class: "am-hr" }, this.$vbtn, el("button", { class: "am-btn", onclick: () => g && this.showMembers(g) }, this.ico("users", 22)));
		}
		this.put(
			this.$chead,
			el("button", { class: "am-btn", onclick: () => this.onBack() }, this.ico("back", 26)),
			lead,
			el("div", { class: "tt", onclick: () => this.channelMenu() }, el("b", {}, el("span", { class: "nm", text: title }), this.ico("chev", 18)), el("small", {}, ...sub)),
			right,
		);
		this.vPaint();
	}

	// Keeps the "N Online" count fresh while a group channel is open.
	refreshOnline() {
		const c = this.state.channel;
		if (this.view !== "chat" || !c || c.kind === "dm" || !this.group) return;
		this.loadGroup(this.group)
			.then(() => {
				if (this.state.channel === c && this.view === "chat") this.paintChatHead();
			})
			.catch(() => {});
	}

	// How every conversation starts, Discord style: big icon, "Welcome to #channel!" and a line of context.
	intro() {
		const c = this.state.channel;
		const el = this.el.bind(this);
		if (c.kind === "dm") {
			const p = c.peer;
			return el("div", { class: "am-intro" }, this.avatar(p), el("h2", {}, p.name, ...this.badges(p)), el("p", { class: "at", text: `@${p.name}` }), el("p", { text: `This is the beginning of your direct message history with @${p.name}.` }), el("p", { text: "🔒 Messages here are end-to-end encrypted." }));
		}
		return el("div", { class: "am-intro" }, el("div", { class: "ic" }, this.ico("hash", 40)), el("h2", { text: `Welcome to #${c.name}!` }), el("p", { text: this.chanInfo()?.topic || `This is the start of the #${c.name} channel.` }));
	}

	resetList() {
		this.put(this.$list, this.intro());
		this.lastAuthor = null;
		this.lastDay = null;
	}

	chatSkeleton() {
		const inGroup = this.state.channel.kind !== "dm";
		const rows = [["them", "62%"], ["them", "38%"], ["me", "50%"], ["them", "72%"], ["me", "34%"]];
		this.$list.append(
			this.el(
				"div",
				{ class: "am-skwrap" },
				...rows.map(([who, w], i) => {
					const $r = this.el("div", { class: "am-row first", style: "display:flex;gap:10px" }, this.sk(40, 40, 20), this.el("div", { style: "flex:1" }, this.sk(w, 14, 7), this.el("div", { style: "height:6px" }), this.sk("90%", 16, 7)));
					return $r;
				}),
			),
		);
	}

	chatNote(text) {
		this.$list.querySelectorAll(".am-note,.am-skwrap").forEach((n) => n.remove());
		this.$list.append(this.el("div", { class: "am-note", text }));
	}

	// The blue send button grows in only while there is something to send.
	syncFab() {
		const has = !!this.$ta?.value.trim() || !!this.pend;
		this.$send?.classList.toggle("on", has);
		this.$mic?.classList.toggle("off", has);
		if (!this.$ta?.value) this.hideSug();
	}
}
