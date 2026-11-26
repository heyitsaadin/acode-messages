import { peerOf } from "../util.js";

export class FriendsMethods {
	/* ---------- friends ---------- */

	friendErr(e) {
		return /404|500/.test(e?.message || "") ? "The server needs the friends update first." : e?.message || "Something went wrong";
	}

	async friendAct(action, u) {
		const r = await this.api("friends", { method: "POST", body: JSON.stringify({ action, user_id: Number(u.id ?? u.peer_id) }) });
		this.refreshHome();
		return r;
	}

	// Search people who use the plugin and send them a friend request.
	// Before you type anything it lists everyone whose profile is public (online first), a page at a time.
	findPeople() {
		const el = this.el.bind(this);
		const $in = el("input", { class: "am-inp", placeholder: "Search people by username", autocapitalize: "off" });
		const $res = el("div", {});
		const b = { people: [], more: false, loaded: false, busy: false, error: "", unavailable: false };
		const paintBrowse = () => {
			if (!b.loaded && !b.error) {
				return this.put($res, el("div", { class: "am-lbl", text: "People on Acode Messages" }), ...[0, 1, 2, 3].map(() => el("div", { class: "am-dm" }, this.sk(42, 42, 21), el("div", { class: "bd" }, this.sk("45%", 14, 6), el("div", { style: "height:7px" }), this.sk("25%", 11, 6)))));
			}
			if (b.error) return this.put($res, el("div", { class: "am-note", text: `Couldn't load people. ${b.error}` }), el("button", { class: "am-people-more", text: "Try again", onclick: () => loadBrowse() }));
			if (b.unavailable || !b.people.length) {
				return this.put($res, el("div", { class: "am-note", text: b.unavailable ? "Find people who use Acode Messages and send them a friend request." : "Nobody has a public profile yet. Search a username to find someone." }));
			}
			this.put(
				$res,
				el("div", { class: "am-lbl", text: "People on Acode Messages" }),
				...b.people.map((u) => this.personRow(u)),
				b.more ? Object.assign(el("button", { class: "am-people-more", text: b.busy ? "Loading…" : "Show more", onclick: () => loadBrowse(true) }), { disabled: b.busy }) : null,
			);
		};
		const loadBrowse = async (next) => {
			if (b.busy) return;
			b.busy = true;
			b.error = "";
			if (next) paintBrowse();
			try {
				const r = await this.api(`friends?browse=1&offset=${next ? b.people.length : 0}`);
				const seen = new Set(next ? b.people.map((p) => String(p.id)) : []);
				const add = (r.people || []).filter((p) => !seen.has(String(p.id)));
				b.people = next ? [...b.people, ...add] : add;
				b.more = !!r.more;
				b.unavailable = !!r.unavailable;
				b.loaded = true;
			} catch (e) {
				b.error = this.friendErr(e);
			}
			b.busy = false;
			if (!$in.value.trim()) paintBrowse();
		};
		paintBrowse();
		loadBrowse();
		let timer;
		let seq = 0;
		$in.addEventListener("input", () => {
			clearTimeout(timer);
			const q = $in.value.trim();
			const mine = ++seq;
			if (!q) return paintBrowse();
			timer = setTimeout(async () => {
				try {
					const { members } = await this.api(`friends?q=${encodeURIComponent(q)}`);
					if (mine !== seq) return;
					this.put($res, ...(members.length ? members.map((u) => this.personRow(u)) : [el("div", { class: "am-note", text: "No one found." })]));
				} catch (e) {
					if (mine === seq) this.put($res, el("div", { class: "am-note", text: `Search failed. ${this.friendErr(e)}` }));
				}
			}, 300);
		});
		this.sheet("Find people", $in, $res);
		setTimeout(() => $in.focus(), 250);
	}

	// A search result: Add / Requested (tap to cancel) / Accept / Friends.
	personRow(u) {
		const el = this.el.bind(this);
		let rel = u.rel || "none";
		const $btn = el("button", { class: "am-pillb" });
		const $sub = el("small");
		const paint = (err) => {
			$btn.disabled = false;
			$btn.className = "am-pillb";
			let sub = u.online ? "Online" : "Offline";
			if (rel === "friends") {
				$btn.textContent = "Friends ✓";
				$btn.disabled = true;
			} else if (rel === "sent") {
				$btn.textContent = "Requested";
				sub = "Request sent · tap to cancel";
			} else if (rel === "received") {
				$btn.textContent = "Accept";
				$btn.classList.add("ok");
				sub = "Wants to be your friend";
			} else {
				$btn.textContent = "Add";
				$btn.classList.add("pri");
			}
			$sub.textContent = err || sub;
		};
		$btn.onclick = async (e) => {
			e.stopPropagation();
			const action = { none: "request", sent: "cancel", received: "accept" }[rel];
			if (!action) return;
			$btn.disabled = true;
			try {
				rel = (await this.friendAct(action, u)).rel;
				paint();
			} catch (err) {
				paint(this.friendErr(err));
			}
		};
		paint();
		return el(
			"div",
			{ class: "am-dm", onclick: () => this.profile(u, false) },
			this.avw(u, 42, !!u.online),
			el("div", { class: "bd" }, el("b", {}, u.name, ...this.badges(u)), $sub),
			$btn,
		);
	}

	// Notification page: friend requests waiting for you.
	notifications() {
		const el = this.el.bind(this);
		const $box = el("div", { class: "am-nbody" });
		const draw = () => {
			const reqs = this.state.home.requests || [];
			if (!reqs.length) {
				this.put(
					$box,
					el(
						"div",
						{ class: "am-empty" },
						el("div", { class: "ring" }, this.ico("bell", 38)),
						el("b", { text: "You're all caught up" }),
						el("span", { class: "t", text: "When someone sends you a friend request, it will show up here." }),
						el("button", { class: "am-pillb pri", text: "Find people", onclick: () => this.findPeople() }),
					),
				);
				return;
			}
			this.put($box, el("div", { class: "am-lbl", text: `Friend requests · ${reqs.length}` }), ...reqs.map((r) => this.requestRow(r, draw)));
		};
		draw();
		this.openSheet(true, "Notifications", [$box]);
		// Pull the newest requests right away instead of waiting for the next refresh.
		this.refreshHome().then(() => $box.isConnected && draw());
	}

	requestRow(r, redraw) {
		const el = this.el.bind(this);
		const u = peerOf(r);
		const $yes = el("button", { class: "am-pillb ok", text: "Accept" });
		const $no = el("button", { class: "am-pillb", text: "Decline" });
		const $msg = el("small", { text: `Wants to be your friend${r.at ? ` · ${this.ago(r.at)}` : ""}` });
		const act = async (action) => {
			$yes.disabled = $no.disabled = true;
			try {
				await this.friendAct(action, u);
				const h = this.state.home;
				h.requests = (h.requests || []).filter((x) => String(x.peer_id) !== String(u.id));
				if (action === "accept") h.friends = [r, ...(h.friends || []).filter((x) => String(x.peer_id) !== String(u.id))];
				this.paintMe();
				if (this.state.tab === "dm") this.paintPanelNow();
				redraw();
			} catch (e) {
				$yes.disabled = $no.disabled = false;
				$msg.textContent = this.friendErr(e);
			}
		};
		$yes.onclick = () => act("accept");
		$no.onclick = () => act("decline");
		return el(
			"div",
			{ class: "am-rq" },
			el("div", { onclick: () => this.profile(u, false) }, this.avw(u, 46, !!u.online)),
			el("div", { class: "bd" }, el("b", { onclick: () => this.profile(u, false) }, u.name, ...this.badges(u)), $msg, el("div", { class: "acts" }, $yes, $no)),
		);
	}

	async openDm(u) {
		try {
			const { dm } = await this.api("dms", { method: "POST", body: JSON.stringify({ user_id: Number(u.id) }) });
			this.closeSheet();
			this.loadHome(true);
			this.openChannel({ slug: dm.slug, name: dm.name, kind: "dm", peer: peerOf(dm) });
		} catch (e) {
			this.flash(e.message);
		}
	}
}
