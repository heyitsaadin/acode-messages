import { ls, peerOf } from "../util.js";

export class HomeMethods {
	/* ---------- home (Discord style) ---------- */

	pickTab(initial) {
		const { groups } = this.state.home;
		let t = this.state.tab;
		if (initial) t = ls.get("am-tab", null) ?? (groups.length ? groups[0].id : "dm");
		if (t !== "dm" && t !== "add" && !groups.some((g) => g.id === t)) t = groups.length ? groups[0].id : "dm";
		this.state.tab = t;
	}

	// After you change something yourself (join, leave, banner), call this: any refresh that was
	// already on its way carries old data, so it is dropped and a fresh one is fetched.
	refreshHome() {
		this.homeEpoch = (this.homeEpoch || 0) + 1;
		return this.loadHome(true, true);
	}

	loadHome(silent, force) {
		if (this.homeBusy) return force ? this.homeBusy.then(() => this.loadHome(silent)) : this.homeBusy;
		const epoch = this.homeEpoch || 0;
		this.homeBusy = (async () => {
			try {
				const { me, ...next } = await this.api("home");
				// Keep the official default community at the top of the server rail.
				// The server marks it with is_default; other groups retain their relative order.
				if (Array.isArray(next.groups)) next.groups.sort((a, b) => Number(!!b.is_default) - Number(!!a.is_default));
				if (epoch !== (this.homeEpoch || 0)) return;
				if (me) this.state.user = this.withMine({ ...this.state.user, ...me });
				// Publish my encryption key right away so people can DM me without me opening a DM first.
				// Cheap after the first success; retried on the next refresh if it fails.
				if (this.e2eSupported() && this.state.user?.id) this.e2ePublish().catch(() => {});
				ls.set("am-home", { uid: this.state.user?.id, home: next, at: Date.now() });
				const sig = JSON.stringify(next);
				if (!this.$page) return;
				if (silent && sig === this.homeSig && this.homeSeen) return;
				this.homeSig = sig;
				this.state.home = { friends: [], requests: [], ...next };
				this.pickTab(!this.homeSeen);
				this.homeSeen = true;
				this.paintHome();
				this.afterHome();
			} catch (e) {
				// With something already on screen, stay quiet and keep showing it.
				if (!this.homeSeen && this.$page) this.homeNote(`Could not reach the server (${e.message}).`, () => this.start());
			} finally {
				this.homeBusy = null;
			}
		})();
		return this.homeBusy;
	}

	homeNote(text, retry) {
		const el = this.el.bind(this);
		// Always show a way out: back arrow at the top and a Close button under the message.
		this.put(this.$rail);
		this.put(
			this.$ph,
			el(
				"div",
				{ class: "am-phead", style: "display:flex;align-items:center;gap:8px" },
				el("button", { class: "am-btn", onclick: () => this.close() }, this.ico("back", 26)),
				el("div", { class: "tt", style: "font-weight:700;font-size:18px", text: "Acode Messages" }),
			),
		);
		this.put(
			this.$plist,
			el("div", { class: "am-note", text }),
			retry ? el("button", { class: "am-go", text: "Try again", onclick: retry }) : null,
			el("button", { class: "am-go", style: "background:rgba(127,127,127,.25);color:inherit", text: "Close", onclick: () => this.close() }),
		);
	}

	paintHomeSkeleton() {
		const el = this.el.bind(this);
		this.put(this.$rail, this.sk(50, 50, 25), this.sk(32, 2, 2), this.sk(50, 50, 25), this.sk(50, 50, 25), this.sk(50, 50, 25));
		this.put(this.$ph, el("div", { class: "am-phead" }, el("div", { class: "tt" }, this.sk("55%", 20, 6), el("div", { style: "height:7px" }), this.sk("30%", 12, 6))));
		this.put(
			this.$plist,
			...[0, 1, 2, 3, 4, 5].map((i) =>
				el("div", { class: "am-dm" }, this.sk(46, 46, 23), el("div", { class: "bd" }, this.sk(`${48 + ((i * 13) % 30)}%`, 14, 6), el("div", { style: "height:7px" }), this.sk(`${72 - ((i * 9) % 25)}%`, 11, 6))),
			),
		);
	}

	setTab(t) {
		const old = this.state.tab;
		if (t === old && this.$rail?.querySelector("[data-t]")) return;
		const order = (x) => (x === "dm" ? 0 : this.state.home.groups.findIndex((g) => g.id === x) + 1);
		this.animDir = order(t) >= order(old) ? "d" : "u";
		this.state.tab = t;
		ls.set("am-tab", t);
		if (this.$rail?.querySelector("[data-t]")) this.markRail(t);
		else this.paintRail();
		this.paintPanel();
		if (this.$plist) this.$plist.scrollTop = 0;
	}

	// Move the highlight on the existing server icons instead of rebuilding them, so it animates.
	markRail(t) {
		this.$rail.querySelectorAll(".am-srv[data-t]").forEach(($n) => {
			const on = $n.dataset.t === String(t);
			$n.classList.toggle("on", on);
			if ($n.dataset.g) $n.style.background = on ? "" : `hsl(${$n.dataset.h} 40% 38%)`;
		});
	}

	// Slide the header and list in from above/below, matching the direction you moved on the rail.
	playIn(dir) {
		const cls = dir === "d" ? "in-d" : "in-u";
		for (const $e of [this.$ph, this.$plist]) {
			if (!$e) continue;
			$e.classList.remove("in-d", "in-u");
			void $e.offsetWidth;
			$e.classList.add(cls);
		}
		clearTimeout(this.inT);
		this.inT = setTimeout(() => {
			for (const $e of [this.$ph, this.$plist]) $e?.classList.remove("in-d", "in-u");
		}, 700);
	}

	paintHome() {
		this.paintRail();
		this.paintPanel();
		this.paintMe();
	}

	paintRail() {
		const { groups } = this.state.home;
		const t = this.state.tab;
		this.put(
			this.$rail,
			this.el("div", { class: `am-srv${t === "dm" ? " on" : ""}`, "data-t": "dm", onclick: () => this.setTab("dm") }, this.ico("chat", 26)),
			groups.length ? this.el("div", { class: "am-sep" }) : null,
			...groups.map((g) => {
				const $s = this.el("div", { class: `am-srv${g.id === t ? " on" : ""}`, text: this.initial(g.name), "data-t": String(g.id), "data-g": "1", "data-h": String(this.hue(g.name)), onclick: () => this.setTab(g.id) });
				if (g.id !== t) $s.style.background = `hsl(${this.hue(g.name)} 40% 38%)`;
				if (g.icon) {
					const $i = document.createElement("img");
					$i.alt = "";
					$i.onerror = () => $i.remove();
					$i.src = this.bannerSrc(g.icon);
					$s.append($i);
				}
				return $s;
			}),
			this.el("div", { class: "am-srv add", onclick: () => this.addMenu() }, this.ico("plus", 26)),
		);
	}

	paintPanel() {
		this.paintPanelNow();
		if (this.animDir) {
			const d = this.animDir;
			this.animDir = null;
			this.playIn(d);
		}
	}

	paintPanelNow() {
		const { groups, dms } = this.state.home;
		const t = this.state.tab;
		const el = this.el.bind(this);
		const close = el("button", { class: "am-btn", onclick: () => this.close() }, this.ico("close", 22));
		if (t === "dm") {
			this.put(
				this.$ph,
				el(
					"div",
					{ class: "am-phead" },
					el("div", { class: "tt" }, el("b", { text: "Direct Messages" }), el("small", { text: dms.length ? `${dms.length} conversation${dms.length > 1 ? "s" : ""}` : "Private chats" })),
					el("button", { class: "am-btn", "aria-label": "Find people", onclick: () => this.findPeople() }, this.ico("search", 22)),
					el("button", { class: "am-btn", "aria-label": "New message", onclick: () => this.newDm() }, this.ico("edit", 22)),
					close,
				),
			);
			// Friends you have not started a chat with yet sit under the conversations.
			const talking = new Set(dms.map((d) => String(d.peer_id)));
			const friends = (this.state.home.friends || []).filter((f) => !talking.has(String(f.peer_id)));
			const empty = !dms.length && !friends.length;
			this.put(
				this.$plist,
				...dms.map((d) => this.dmRow(d)),
				friends.length ? el("div", { class: "am-lbl", text: `Friends · ${friends.length}` }) : null,
				...friends.map((f) => this.friendRow(f)),
				empty ? el("div", { class: "am-note", text: groups.length ? "No conversations yet. Tap the pencil to message someone, or the magnifier to find friends." : "No conversations yet. Tap the pencil to message someone, the magnifier to find friends, or tap + on the left to create or join a group." }) : null,
			);
			return;
		}
		const g = groups.find((x) => x.id === t);
		if (!g) {
			this.state.tab = "dm";
			return this.paintPanelNow();
		}
		const sub = `${g.member_count} member${g.member_count === 1 ? "" : "s"}`;
		if (g.banner) {
			const h = this.hue(g.name);
			const $hero = el("div", { class: "am-hero" });
			$hero.style.background = `linear-gradient(135deg,hsl(${h} 45% 36%),hsl(${(h + 50) % 360} 50% 24%))`;
			const $img = document.createElement("img");
			$img.alt = "";
			$img.onerror = () => $img.remove();
			$img.src = this.bannerSrc(g.banner);
			$hero.append(
				$img,
				el("div", { class: "tt" }, el("b", { text: g.name }), el("small", { text: sub })),
				el(
					"div",
					{ class: "acts" },
					el("button", { class: "am-btn", onclick: () => this.showMembers(g) }, this.ico("users", 20)),
					el("button", { class: "am-btn", onclick: () => this.groupMenu(g) }, this.ico("more", 20)),
					el("button", { class: "am-btn", onclick: () => this.close() }, this.ico("close", 20)),
				),
			);
			this.put(this.$ph, $hero);
		} else {
			this.put(
				this.$ph,
				el(
					"div",
					{ class: "am-phead" },
					el("div", { class: "tt" }, el("b", { text: g.name }), el("small", { text: sub })),
					el("button", { class: "am-btn", onclick: () => this.showMembers(g) }, this.ico("users", 22)),
					el("button", { class: "am-btn", onclick: () => this.groupMenu(g) }, this.ico("more", 22)),
					close,
				),
			);
		}
		this.put(
			this.$plist,
			el("div", { class: "am-lbl", style: "display:flex;align-items:center;justify-content:space-between;padding-right:2px" }, el("span", { text: "Text channels" }), this.can(g, "manage_channels") ? el("button", { class: "am-btn", style: "width:30px;height:30px", onclick: () => this.channelForm(g) }, this.ico("plus", 18)) : null),
			...g.channels.map((c) =>
				el(
					"div",
					{ class: "am-ch", onclick: () => this.openChannel({ slug: c.slug, name: c.name, kind: "text", group_id: g.id }) },
					this.ico(c.private ? "lock" : "hash", 20),
					el("span", { text: c.name }),
					this.can(g, "manage_channels") ? el("button", { class: "am-btn", style: "margin-left:auto;width:32px;height:32px", onclick: (e) => (e.stopPropagation(), this.channelSettings(g, c)) }, this.ico("sliders", 18)) : null,
				),
			),
		);
	}

	dmRow(d) {
		const t = d.last_at ? new Date(d.last_at) : null;
		const enc = typeof d.last_content === "string" && d.last_content.startsWith("e2e1:");
		const $sm = this.el("small", { text: enc ? "🔒 Encrypted message" : this.plainPreview(d.last_content) || "Say hi 👋" });
		if (enc && this.e2eSupported()) {
			// The list only has ciphertext; swap in the real text once it's decrypted (only if this device has a key).
			this.e2eRead(d.peer_id ?? d.id, d.last_content, 600000)
				.then((txt) => {
					if (txt != null) $sm.textContent = this.plainPreview(txt) || "🔒 Encrypted message";
				})
				.catch(() => {});
		}
		return this.el(
			"div",
			{ class: "am-dm", onclick: () => this.openChannel({ slug: d.slug, name: d.name, kind: "dm", peer: peerOf(d) }) },
			this.avw(d, 46, !!d.online),
			this.el("div", { class: "bd" }, this.el("b", { text: d.name }), $sm),
			t ? this.el("time", { text: this.shortTime(t) }) : null,
		);
	}

	friendRow(f) {
		const u = peerOf(f);
		return this.el(
			"div",
			{ class: "am-dm", onclick: () => this.openDm(u) },
			this.avw(u, 46, !!u.online),
			this.el("div", { class: "bd" }, this.el("b", {}, u.name, ...this.badges(u)), this.el("small", { text: u.online ? "Online · tap to message" : "Offline · tap to message" })),
		);
	}

	// The profile bar under the whole home screen.
	paintMe() {
		if (!this.$me) return;
		const u = this.state.user;
		if (!u) {
			this.$me.onclick = null;
			this.put(this.$me, this.sk(36, 36, 18), this.el("div", { class: "bd" }, this.sk("45%", 15, 6), this.el("div", { style: "height:6px" }), this.sk("25%", 11, 6)));
			return;
		}
		this.$me.onclick = () => this.profile(u, true);
		const n = (this.state.home.requests || []).length;
		const $bell = this.el(
			"button",
			{
				class: "am-btn am-bell",
				"aria-label": n ? `Notifications, ${n} new` : "Notifications",
				onclick: (e) => {
					e.stopPropagation();
					this.notifications();
				},
			},
			this.ico("bell", 24),
			n ? this.el("span", { class: "nb", text: n > 9 ? "9+" : String(n) }) : null,
		);
		this.put(this.$me, this.avw(u, 60, true), this.el("div", { class: "bd" }, this.el("b", {}, u.name || "You", this.ico("down", 16)), this.el("small", { text: "Online" })), $bell);
	}
}
