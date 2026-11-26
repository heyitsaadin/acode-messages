// The page behind the + button on the server rail: start a group, join with an invite code,
// or browse the groups owners have made public.

const FRESH_MS = 60000;

export class DiscoverMethods {
	/* ---------- add a group page ---------- */

	paintAdd($close) {
		const el = this.el.bind(this);
		this.put(this.$ph, el("div", { class: "am-phead" }, el("div", { class: "tt" }, el("b", { text: "Groups" }), el("small", { text: "Start one, join one or browse" })), $close));
		// Build the page once per home screen; later refreshes only repaint the group list.
		if (!this.addEl || this.addFor !== this.$plist) {
			this.addEl = this.buildAdd();
			this.addFor = this.$plist;
		}
		if (this.$plist.firstElementChild !== this.addEl) this.put(this.$plist, this.addEl);
		this.paintComms();
		this.loadDiscover();
	}

	buildAdd() {
		const el = this.el.bind(this);
		this.$comms = el("div", { class: "am-comms" });
		return el(
			"div",
			{ class: "am-add" },
			el("div", { class: "am-mg act" }, this.item("plus", "Create a group", () => this.groupForm("create"), "", "Your own space with channels and roles"), this.item("link", "Join with an invite code", () => this.groupForm("join"), "", "Got a code from a friend? Paste it here")),
			el("div", { class: "am-lbl", text: "Public groups" }),
			el("div", { class: "am-sub", style: "margin:0 10px 12px", text: "Open to everyone. No invite code needed." }),
			this.$comms,
		);
	}

	/* ---------- public group list ---------- */

	// Public groups you have not joined, from GET /api/groups?discover=1 (server migration 013).
	loadDiscover(force) {
		const d = (this.disc = this.disc || { list: null, error: "", at: 0, busy: null });
		if (d.busy) return d.busy;
		if (!force && d.list && Date.now() - d.at < FRESH_MS) return null;
		d.busy = (async () => {
			try {
				const r = await this.api("groups?discover=1");
				d.list = (Array.isArray(r?.groups) ? r.groups : []).map((x) => this.commNorm(x)).filter((x) => x.name);
				d.error = "";
				d.at = Date.now();
			} catch (e) {
				d.error = e.message || "network error";
			} finally {
				d.busy = null;
				if (this.state.tab === "add") this.paintComms();
			}
		})();
		return d.busy;
	}

	commNorm(x) {
		const n = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
		return {
			id: x.id,
			name: String(x.name || ""),
			description: String(x.description || ""),
			icon: x.icon || "",
			banner: x.banner || "",
			members: n(x.member_count),
			online: n(x.online_count),
			verified: !!x.verified,
		};
	}

	paintComms() {
		if (!this.$comms) return;
		const el = this.el.bind(this);
		const d = this.disc;
		if (!d || (!d.list && !d.error)) {
			this.put(this.$comms, this.commSkeleton(), this.commSkeleton(), this.commSkeleton());
			return;
		}
		if (!d.list) {
			this.put(
				this.$comms,
				el("div", { class: "am-note", text: `Couldn't load public groups (${d.error}).` }),
				el("button", {
					class: "am-go alt",
					text: "Try again",
					onclick: () => {
						d.error = "";
						this.paintComms();
						this.loadDiscover(true);
					},
				}),
			);
			return;
		}
		// Anything you have joined since the list was fetched drops out right away.
		const mine = new Set(this.state.home.groups.map((g) => String(g.id)));
		const left = d.list.filter((c) => !mine.has(String(c.id)));
		if (!left.length) {
			this.put(this.$comms, el("div", { class: "am-note", text: "No public groups yet. Group owners can list theirs from the group's settings." }));
			return;
		}
		this.put(this.$comms, ...left.map((c) => this.commRow(c)));
	}

	commSkeleton() {
		const el = this.el.bind(this);
		return el("div", { class: "am-cr" }, this.sk(52, 52, 16), el("div", { class: "bd" }, this.sk("50%", 16, 6), el("div", { style: "height:8px" }), this.sk("85%", 12, 6)));
	}

	commCount(v) {
		return v >= 10000 ? `${Math.round(v / 1000)}K` : v.toLocaleString();
	}

	// Round-square group picture, or the first letter on the same colour the server rail uses.
	commIcon(c) {
		const $ic = this.el("div", { class: "ic", text: this.initial(c.name) });
		$ic.style.background = `hsl(${this.hue(c.name)} 40% 38%)`;
		if (c.icon) {
			const $i = document.createElement("img");
			$i.alt = "";
			$i.onerror = () => $i.remove();
			$i.src = this.bannerSrc(c.icon);
			$ic.append($i);
		}
		return $ic;
	}

	commName(c) {
		return this.el("div", { class: "nm" }, this.el("span", { text: c.name }), c.verified ? this.el("span", { class: "vf", "aria-label": "Verified" }, this.ico("check", 14)) : null);
	}

	// One compact row in the list: picture, name, short blurb, counts. Tap for the full preview.
	commRow(c) {
		const el = this.el.bind(this);
		const bits = [];
		if (c.members != null) bits.push(`${this.commCount(c.members)} member${c.members === 1 ? "" : "s"}`);
		if (c.online) bits.push(`${this.commCount(c.online)} online`);
		return el(
			"div",
			{ class: "am-cr", onclick: () => this.commPreview(c) },
			this.commIcon(c),
			el("div", { class: "bd" }, this.commName(c), c.description ? el("div", { class: "ds", text: c.description }) : null, bits.length ? el("div", { class: "st", text: bits.join(" · ") }) : null),
			el("button", { class: "am-pillb pri", text: "View", onclick: (e) => (e.stopPropagation(), this.commPreview(c)) }),
		);
	}

	// The preview card: banner, picture, name with a verified tick, the full blurb and counts.
	commCard(c) {
		const el = this.el.bind(this);
		const h = this.hue(c.name);
		const $ban = el("div", { class: "ban" });
		$ban.style.background = `linear-gradient(135deg,hsl(${h} 45% 36%),hsl(${(h + 50) % 360} 50% 24%))`;
		if (c.banner) {
			const $b = document.createElement("img");
			$b.alt = "";
			$b.onerror = () => $b.remove();
			$b.src = this.bannerSrc(c.banner);
			$ban.append($b);
		}
		$ban.append(this.commIcon(c));
		const bits = [];
		if (c.online != null) bits.push(el("span", {}, el("i"), `${this.commCount(c.online)} Online`));
		if (c.members != null) bits.push(el("span", {}, el("i", { class: "g" }), `${this.commCount(c.members)} Members`));
		return el("div", { class: "am-comm prev" }, $ban, el("div", { class: "bd" }, this.commName(c), c.description ? el("div", { class: "ds", text: c.description }) : null, bits.length ? el("div", { class: "st" }, ...bits) : null));
	}

	// Preview: the card in a sheet with a Join button.
	commPreview(c) {
		const $e = this.el("div", { class: "am-ferr" });
		const $go = this.el("button", { class: "am-go", text: "Join group" });
		$go.onclick = async () => {
			$go.disabled = true;
			$e.textContent = "";
			try {
				await this.joinAndOpen({ action: "join", group_id: c.id });
			} catch (e) {
				$e.textContent = e.message;
				$go.disabled = false;
			}
		};
		const $card = this.commCard(c);
		$card.querySelector(".bd").append($go, this.el("button", { class: "am-go alt", text: "Not now", onclick: () => this.closeSheet() }), $e);
		this.sheet("", $card);
	}

	// Create or join through the server, then land in that group.
	async joinAndOpen(body) {
		const { group } = await this.api("groups", { method: "POST", body: JSON.stringify(body) });
		this.closeSheet();
		await this.refreshHome();
		this.setTab(group.id);
	}
}
