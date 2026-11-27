import { ls } from "../util.js";

// The server (group) screens, laid out like Discord:
//   - the channel list with a tappable banner / name header and collapsible categories
//   - the server sheet you get by tapping the banner or name (quick actions, create channel / category)
//   - a separate Group settings page, shown only to people who may change something
export class ServerPanelMethods {
	/* ---------- channel list ---------- */

	catOpen(g, k) {
		return !ls.get("am-cats", {})[`${g.id}:${k.id}`];
	}

	toggleCat(g, k) {
		const all = ls.get("am-cats", {});
		const key = `${g.id}:${k.id}`;
		if (all[key]) delete all[key];
		else all[key] = 1;
		ls.set("am-cats", all);
		this.paintPanelNow();
	}

	chanRow(g, c) {
		const el = this.el.bind(this);
		return el(
			"div",
			{ class: `am-ch${c.mentions > 0 ? " ment" : c.unread > 0 ? " unread" : ""}`, "data-slug": c.slug, onclick: () => this.openChannel({ slug: c.slug, name: c.name, kind: "text", group_id: g.id }) },
			// On the left edge, like Discord: a small @ when someone mentioned you here, otherwise a dot when there is something new.
			c.mentions > 0 ? el("span", { class: "am-um", "aria-label": "You were mentioned", text: "@" }) : c.unread > 0 ? el("span", { class: "am-ud", "aria-label": "Unread messages" }) : null,
			this.ico(c.private ? "lock" : "hash", 20),
			el("span", { class: "cn", text: c.name }),
			this.can(g, "manage_channels") ? el("button", { class: "am-btn", "aria-label": "Channel settings", style: "margin-left:auto;width:32px;height:32px", onclick: (e) => (e.stopPropagation(), this.channelSettings(g, c)) }, this.ico("sliders", 18)) : null,
		);
	}

	// Banner (tap for the server sheet), then name + member count + invite, then the channels under their categories.
	paintGroup(g) {
		const el = this.el.bind(this);
		const manage = this.can(g, "manage_channels");
		const n = g.member_count;
		const sub = `${n} member${n === 1 ? "" : "s"}${g.is_public ? " · Public" : ""}`;
		const open = () => this.groupMenu(g);
		const $head = el(
			"div",
			{ class: "am-sh", onclick: open },
			el(
				"div",
				{ class: "tt" },
				el("b", {}, el("span", { class: "nm", text: g.name }), g.is_default ? el("span", { class: "vf", "aria-label": "Verified" }, this.ico("check", 12)) : null, this.ico("chev", 18)),
				el("small", { text: sub }),
			),
			el("button", { class: "am-btn", "aria-label": "Invite people", onclick: (e) => (e.stopPropagation(), this.inviteSheet(g)) }, this.ico("userplus", 22)),
			g.banner ? null : el("button", { class: "am-btn", "aria-label": "Close", onclick: (e) => (e.stopPropagation(), this.close()) }, this.ico("close", 22)),
		);
		if (g.banner) {
			const h = this.hue(g.name);
			const $hero = el("div", { class: "am-hero", onclick: open });
			$hero.style.background = `linear-gradient(135deg,hsl(${h} 45% 36%),hsl(${(h + 50) % 360} 50% 24%))`;
			const $img = document.createElement("img");
			$img.alt = "";
			$img.onerror = () => $img.remove();
			$img.src = this.bannerSrc(g.banner);
			$hero.append($img, el("div", { class: "acts" }, el("button", { class: "am-btn", "aria-label": "Close", onclick: (e) => (e.stopPropagation(), this.close()) }, this.ico("close", 20))));
			this.put(this.$ph, $hero, $head);
		} else {
			this.put(this.$ph, $head);
		}

		const cats = g.categories || [];
		const chans = g.channels || [];
		const loose = chans.filter((c) => c.category_id == null || !cats.some((k) => k.id === c.category_id));
		const nodes = loose.map((c) => this.chanRow(g, c));
		for (const k of cats) {
			const mine = chans.filter((c) => c.category_id === k.id);
			// People who can't manage channels don't see a category they have nothing in.
			if (!manage && !mine.length) continue;
			const shown = this.catOpen(g, k);
			nodes.push(
				el(
					"div",
					{ class: "am-cat", onclick: () => this.toggleCat(g, k) },
					this.ico(shown ? "down" : "chev", 14),
					el("span", { class: "nm", text: k.name }),
					!shown && mine.some((c) => c.unread > 0 || c.mentions > 0) ? el("span", { class: "am-ud", "aria-label": "Unread messages inside" }) : null,
					manage ? el("button", { class: "am-btn", "aria-label": `Add a channel to ${k.name}`, onclick: (e) => (e.stopPropagation(), this.channelForm(g, k.id, () => this.closeSheet())) }, this.ico("plus", 16)) : null,
					manage ? el("button", { class: "am-btn", "aria-label": `${k.name} settings`, onclick: (e) => (e.stopPropagation(), this.categorySettings(g, k)) }, this.ico("sliders", 16)) : null,
				),
			);
			if (shown) nodes.push(...mine.map((c) => this.chanRow(g, c)));
		}
		if (!nodes.length) nodes.push(el("div", { class: "am-note", text: "No channels yet." }));
		this.put(this.$plist, ...nodes);
	}

	/* ---------- the server sheet (tap the banner or the name) ---------- */

	hasSettings(g) {
		return ["manage_group", "manage_roles", "manage_channels", "delete_group"].some((p) => this.can(g, p));
	}

	groupMenu(g) {
		g = this.fresh(g);
		const el = this.el.bind(this);
		const h = this.hue(g.name);
		const $ban = el("div", { class: "ban" });
		$ban.style.background = `linear-gradient(135deg,hsl(${h} 45% 36%),hsl(${(h + 50) % 360} 50% 24%))`;
		if (g.banner) {
			const $b = document.createElement("img");
			$b.alt = "";
			$b.onerror = () => $b.remove();
			$b.src = this.bannerSrc(g.banner);
			$ban.append($b);
		}
		$ban.append(this.commIcon({ name: g.name, icon: g.icon }));
		const $st = el("div", { class: "st" });
		const stats = () => {
			const d = this.gdata[g.id];
			const out = [];
			if (d?.members) out.push(el("span", {}, el("i"), `${d.members.filter((m) => m.online).length} Online`));
			out.push(el("span", {}, el("i", { class: "g" }), `${g.member_count} Member${g.member_count === 1 ? "" : "s"}`));
			return out;
		};
		this.put($st, ...stats());
		const card = el("div", { class: "am-comm prev" }, $ban, el("div", { class: "bd" }, this.commName({ name: g.name, verified: !!g.is_default }), g.description ? el("div", { class: "ds", text: g.description }) : null, $st));

		const qa = (icon, label, fn) => el("button", { class: "am-qa", onclick: fn }, el("span", { class: "ic" }, this.ico(icon, 24)), el("span", { text: label }));
		const actions = el("div", { class: "am-qas" }, qa("userplus", "Invite", () => this.inviteSheet(g)), qa("users", "Members", () => this.showMembers(g)), this.hasSettings(g) ? qa("gear", "Settings", () => this.serverSettings(g)) : null);
		const create = this.can(g, "manage_channels") ? el("div", { class: "am-mg" }, this.item("hash", "Create Channel", () => this.channelForm(g, null, () => this.closeSheet())), this.item("folder", "Create Category", () => this.categoryForm(g))) : null;
		const leave = this.isOwner(g) ? null : el("div", { class: "am-mg" }, this.item("leave", "Leave group", () => this.confirmLeave(g), "danger"));

		this.sheet(null, card, actions, this.roleLine(g), create, leave);

		// The online count needs the member list; fill it in once it arrives.
		if (!this.gdata[g.id]) {
			const seq = this.sheetSeq;
			this.loadGroup(g)
				.then(() => {
					if (this.sheetSeq === seq && this.$sheet.classList.contains("open")) this.put($st, ...stats());
				})
				.catch(() => {});
		}
	}

	/* ---------- group settings (owner / people with permissions) ---------- */

	serverSettings(g) {
		g = this.fresh(g);
		const del = this.can(g, "delete_group") ? [this.el("div", { class: "am-fl", text: "Danger zone" }), this.item("trash", "Delete group", () => this.confirmDelete(g), "danger")] : [];
		this.sheet("Group settings", ...this.manageItems(g), ...del, this.item("close", "Back", () => this.groupMenu(g)));
	}

	/* ---------- categories ---------- */

	// Choose a category with chips. onPick gets the category id, or null for "None".
	catChips(g, sel, onPick) {
		const cats = g.categories || [];
		if (!cats.length) return [];
		const $box = this.el("div", { class: "am-chips am-catpick" });
		const draw = () =>
			this.put(
				$box,
				...[{ id: null, name: "None" }, ...cats].map((k) =>
					this.el("button", {
						class: `am-chip${k.id === sel ? " on" : ""}`,
						text: k.name,
						onclick: () => {
							sel = k.id;
							onPick(k.id);
							draw();
						},
					}),
				),
			);
		draw();
		return [this.el("div", { class: "am-fl", text: "Category" }), $box];
	}

	// back: where Cancel and a successful create go. Without it the sheet just closes.
	categoryForm(g, back) {
		g = this.fresh(g);
		const $name = this.el("input", { class: "am-inp", placeholder: "Category name", maxlength: "24", autocapitalize: "words" });
		const $e = this.el("div", { class: "am-ferr" });
		const $go = this.el("button", { class: "am-go", text: "Create category" });
		const go = async () => {
			const name = $name.value.trim();
			if (!name) return;
			$go.disabled = true;
			$e.textContent = "";
			try {
				await this.chanPost({ action: "category_create", group_id: g.id, name });
				await this.refreshHome();
				if (back) back();
				else this.closeSheet();
			} catch (e) {
				$e.textContent = e.message;
				$go.disabled = false;
			}
		};
		$go.onclick = go;
		$name.addEventListener("keydown", (e) => e.key === "Enter" && go());
		this.sheet("Create category", $name, this.el("div", { class: "am-sub", style: "margin:2px 16px 4px", text: "Categories group channels under a heading you can collapse." }), $e, $go, this.item("close", "Cancel", () => (back ? back() : this.groupMenu(g))));
		setTimeout(() => $name.focus(), 250);
	}

	categorySettings(g, k, back) {
		g = this.fresh(g);
		const cats = g.categories || [];
		k = cats.find((x) => x.id === k.id) || k;
		const i = cats.findIndex((x) => x.id === k.id);
		const leave = () => (back ? back() : this.closeSheet());
		const $name = this.el("input", { class: "am-inp", placeholder: "Category name", maxlength: "24", value: k.name });
		const $e = this.el("div", { class: "am-ferr" });
		const $go = this.el("button", { class: "am-go", text: "Save changes" });
		$go.onclick = async () => {
			const name = $name.value.trim();
			if (!name) return;
			$go.disabled = true;
			$e.textContent = "";
			try {
				await this.chanPost({ action: "category_update", category_id: k.id, name });
				await this.refreshHome();
				$go.textContent = "Saved ✓";
				setTimeout(() => {
					$go.textContent = "Save changes";
					$go.disabled = false;
				}, 1200);
			} catch (e) {
				$e.textContent = e.message;
				$go.disabled = false;
			}
		};
		const move = async (dir) => {
			try {
				await this.chanPost({ action: "category_move", category_id: k.id, dir });
				await this.refreshHome();
				this.categorySettings(g, k, back);
			} catch (e) {
				this.flash(e.message);
			}
		};
		this.sheet(
			k.name,
			this.el("div", { class: "am-fl", text: "Category name" }),
			$name,
			$e,
			$go,
			this.item("plus", "Create channel here", () => this.channelForm(g, k.id, leave)),
			i > 0 ? this.item("up", "Move up", () => move("up")) : null,
			i >= 0 && i < cats.length - 1 ? this.item("down", "Move down", () => move("down")) : null,
			this.item(
				"trash",
				"Delete category",
				() =>
					this.confirm(
						`Delete ${k.name}?`,
						"Its channels aren't deleted. They just move out of the category.",
						"Yes, delete category",
						async () => {
							await this.chanPost({ action: "category_delete", category_id: k.id });
							await this.refreshHome();
							leave();
						},
						() => this.categorySettings(g, k, back),
					),
				"danger",
			),
			this.item("close", "Back", leave),
		);
	}
}
