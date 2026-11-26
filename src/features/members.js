import { MAX_ROLES, PERMS, ROLE_COLORS, MUTE_CHOICES } from "../constants.js";

export class MembersMethods {
	/* ---------- members & new DM ---------- */

	// ctx = { g, d } when shown inside a group's member list; without it the row just opens the profile.
	userRow(u, ctx) {
		const self = String(u.id) === String(this.me.id);
		const role = ctx ? this.roleOf(ctx.d, u) : null;
		const muted = !!ctx && !!u.muted_until && new Date(u.muted_until) > new Date();
		const $n = this.el("b", {}, u.name, ...this.badges(u), u.is_owner ? this.el("span", { class: "am-badge pro", text: "OWNER" }) : null);
		if (role?.color) $n.style.color = role.color;
		const bits = [];
		if (role) bits.push(role.name);
		bits.push(u.online ? "Online" : "Offline");
		if (muted) bits.push("Muted");
		return this.el(
			"div",
			{ class: "am-dm", onclick: ctx ? () => this.memberSheet(ctx.g, u) : () => this.profile(u, self) },
			this.avw(u, 42, !!u.online),
			this.el("div", { class: "bd" }, $n, this.el("small", { text: bits.join(" · ") })),
		);
	}

	roleOf(d, u) {
		return d?.roles?.find((r) => r.id === u.role_id) || null;
	}

	// Members, roles and my own standing in one group.
	async loadGroup(g) {
		const d = await this.api(`members?group=${g.id}`);
		this.gdata[g.id] = d;
		this.members[g.id] = d.members;
		return d;
	}

	membersView(g) {
		g = this.fresh(g);
		const d = this.gdata[g.id];
		if (!d) return;
		const ctx = { g, d };
		this.sheet(`Members — ${d.members.length}`, this.can(g, "manage_roles") ? this.item("shield", "Manage roles", () => this.rolesSheet(g)) : null, ...d.members.map((u) => this.userRow(u, ctx)));
	}

	async showMembers(g) {
		g = this.fresh(g);
		const known = this.gdata[g.id];
		if (known) this.membersView(g);
		else {
			const skel = () => [0, 1, 2, 3].map(() => this.el("div", { class: "am-dm" }, this.sk(42, 42, 21), this.el("div", { class: "bd" }, this.sk("50%", 14, 6), this.el("div", { style: "height:7px" }), this.sk("25%", 11, 6))));
			this.sheet(`Members${g.member_count ? ` — ${g.member_count}` : ""}`, ...skel());
		}
		const seq = this.sheetSeq;
		try {
			await this.loadGroup(g);
			// Only redraw if nothing else was opened while we were loading.
			if (this.sheetSeq === seq && this.$sheet.classList.contains("open")) this.membersView(g);
		} catch (e) {
			if (!known) this.sheet("Members", this.el("div", { class: "am-note", text: `Could not load (${e.message})` }));
		}
	}

	// Tap a member: profile, message, and whatever moderation you're allowed to do to them.
	memberSheet(g, u) {
		g = this.fresh(g);
		const d = this.gdata[g.id];
		const me = d?.me;
		const self = String(u.id) === String(this.me.id);
		const role = this.roleOf(d, u);
		const muted = !!u.muted_until && new Date(u.muted_until) > new Date();
		const has = (p) => !!me && (me.owner || me.perms.includes(p));
		// You can only act on people who rank below you (the owner outranks everyone).
		const above = !!me && !self && !u.is_owner && (me.owner || (u.rk ?? 0) < me.position);
		const bits = [];
		if (u.is_owner) bits.push("Owner");
		else if (role) bits.push(role.name);
		if (muted) bits.push(`Muted ${this.untilText(u.muted_until)}`);
		const $n = this.el("b", {}, u.name, ...this.badges(u));
		if (role?.color) $n.style.color = role.color;
		const head = this.el("div", { class: "am-it", style: "pointer-events:none" }, this.avw(u, 46, !!u.online), this.el("div", {}, $n, bits.length ? this.el("small", { text: bits.join(" · ") }) : null));
		this.sheet(
			null,
			head,
			this.item("user", "View profile", () => this.profile(u, self)),
			self ? null : this.item("chat", "Send message", () => this.openDm(u)),
			...(above && has("manage_roles") ? this.roleQuick(g, u) : []),
			above && has("mute") ? (muted ? this.item("mute", "Unmute", () => this.doMute(g, u, 0)) : this.item("mute", "Mute…", () => this.muteSheet(g, u))) : null,
			above && has("kick")
				? this.item(
						"leave",
						"Kick from group",
						() =>
							this.confirm(
								`Kick ${u.name}?`,
								"They'll be removed from the group, but can rejoin with the invite code.",
								"Yes, kick",
								async () => {
									await this.api("groups", { method: "POST", body: JSON.stringify({ action: "kick", group_id: g.id, user_id: Number(u.id) }) });
									await this.loadGroup(g);
									this.membersView(g);
									this.refreshHome();
								},
								() => this.memberSheet(g, u),
								"leave",
							),
						"danger",
					)
				: null,
		);
	}

	muteSheet(g, u) {
		this.sheet(
			`Mute ${u.name}`,
			...MUTE_CHOICES.map(([label, minutes]) => this.item("mute", label, () => this.doMute(g, u, minutes))),
			this.item("close", "Cancel", () => this.memberSheet(g, u)),
		);
	}

	async doMute(g, u, minutes) {
		try {
			await this.api("groups", { method: "POST", body: JSON.stringify({ action: "mute", group_id: g.id, user_id: Number(u.id), minutes }) });
			await this.loadGroup(g);
			this.membersView(g);
		} catch (e) {
			this.flash(e.message);
		}
	}

	// A row with a colour dot, used for roles.
	roleRow(r, selected, onclick, sub) {
		const $dot = this.el("span", { class: "am-dot" });
		$dot.style.background = r?.color || "rgba(127,127,127,.55)";
		return this.el("div", { class: "am-it", onclick }, $dot, this.el("div", {}, this.el("span", { text: r ? r.name : "No role" }), sub ? this.el("small", { text: sub }) : null), selected ? this.ico("check", 20) : null);
	}

	assignRole(g, u) {
		g = this.fresh(g);
		const d = this.gdata[g.id];
		const me = d.me;
		const cur = u.role_id ?? null;
		const set = async (roleId) => {
			try {
				await this.api("groups", { method: "POST", body: JSON.stringify({ action: "set_role", group_id: g.id, user_id: Number(u.id), role_id: roleId }) });
				await this.loadGroup(g);
				this.membersView(g);
			} catch (e) {
				this.flash(e.message);
			}
		};
		// You can only hand out roles that rank below your own.
		const roles = d.roles.filter((r) => me.owner || r.position < me.position);
		this.sheet(`Role for ${u.name}`, this.roleRow(null, cur === null, () => set(null)), ...roles.map((r) => this.roleRow(r, cur === r.id, () => set(r.id), this.permSummary(r.perms))), roles.length ? null : this.el("div", { class: "am-sub", style: "margin:6px 14px", text: "There are no roles you can give out yet." }), this.item("close", "Cancel", () => this.memberSheet(g, u)));
	}

	roleSub(d, r) {
		const n = d.members.filter((m) => m.role_id === r.id).length;
		return `${n} member${n === 1 ? "" : "s"} · ${this.permSummary(r.perms)}`;
	}

	// Roles straight in the member sheet: one tap gives a role, tap it again to take it away. No extra screens.
	roleQuick(g, u) {
		const d = this.gdata[g.id];
		const me = d.me;
		const roles = d.roles.filter((r) => me.owner || r.position < me.position);
		if (!roles.length) return [];
		let cur = u.role_id ?? null;
		const $box = this.el("div", {});
		const draw = () => this.put($box, ...roles.map((r) => this.roleRow(r, cur === r.id, () => tap(r), this.permSummary(r.perms))));
		const tap = async (r) => {
			const prev = cur;
			cur = cur === r.id ? null : r.id;
			draw();
			try {
				await this.api("groups", { method: "POST", body: JSON.stringify({ action: "set_role", group_id: g.id, user_id: Number(u.id), role_id: cur }) });
				u.role_id = cur;
				this.loadGroup(g).catch(() => {});
			} catch (e) {
				cur = prev;
				draw();
				this.flash(e.message);
			}
		};
		draw();
		return [this.el("div", { class: "am-fl", text: "Role" }), $box];
	}

	// Everyone in the group with a switch: tap a person to give or take this role, instantly.
	roleMembers(g, role) {
		const d = this.gdata[g.id];
		const me = d.me;
		const have = (m) => m.role_id === role.id;
		const $label = this.el("div", { class: "am-fl" });
		const $box = this.el("div", {});
		const people = d.members.filter((m) => !m.is_owner);
		const toggle = async (m) => {
			const prev = m.role_id ?? null;
			m.role_id = have(m) ? null : role.id;
			draw();
			try {
				await this.api("groups", { method: "POST", body: JSON.stringify({ action: "set_role", group_id: g.id, user_id: Number(m.id), role_id: m.role_id }) });
				this.loadGroup(g).catch(() => {});
			} catch (e) {
				m.role_id = prev;
				draw();
				this.flash(e.message);
			}
		};
		const draw = () => {
			$label.textContent = `Members · ${people.filter(have).length}`;
			this.put(
				$box,
				...people.map((m) => {
					const ok = String(m.id) !== String(this.me.id) && (me.owner || (m.rk ?? 0) < me.position || have(m));
					const other = !have(m) && m.role_id ? d.roles.find((r) => r.id === m.role_id) : null;
					const row = this.el(
						"div",
						{ class: "am-it", onclick: ok ? () => toggle(m) : () => this.flash("You can only change people who rank below you") },
						this.avw(m, 38),
						this.el("div", {}, this.el("span", { text: m.name }), other ? this.el("small", { text: `Has ${other.name}` }) : null),
						this.el("div", { class: `am-sw${have(m) ? " on" : ""}` }),
					);
					if (!ok) row.style.opacity = ".45";
					return row;
				}),
			);
		};
		draw();
		return [$label, $box];
	}

	permSummary(perms) {
		const list = PERMS.filter(([k]) => (perms || []).includes(k)).map(([, label]) => label);
		return list.length ? list.join(", ") : "No permissions";
	}

	async rolesSheet(g) {
		g = this.fresh(g);
		const draw = (d) => {
			const me = d.me;
			const rows = d.roles.map((r) => {
				const locked = !me.owner && r.position >= me.position;
				const row = this.roleRow(r, false, locked ? null : () => this.roleEditor(g, r), locked ? "Ranks above you" : this.roleSub(d, r));
				if (locked) row.style.opacity = ".5";
				return row;
			});
			this.sheet(
				"Roles",
				...rows,
				d.roles.length ? null : this.el("div", { class: "am-note", text: "No roles yet." }),
				d.roles.length < MAX_ROLES ? this.item("plus", "Create role", () => this.roleEditor(g, null)) : null,
				this.el("div", { class: "am-sub", style: "margin:8px 16px 4px", text: "Roles higher in the list outrank the ones below. You can only manage people and roles that rank below you." }),
			);
		};
		const known = this.gdata[g.id];
		if (known) draw(known);
		else this.sheet("Roles", this.el("div", { class: "am-note", text: "Loading…" }));
		const seq = this.sheetSeq;
		try {
			const d = await this.loadGroup(g);
			if (this.sheetSeq === seq && this.$sheet.classList.contains("open")) draw(d);
		} catch (e) {
			if (!known) this.sheet("Roles", this.el("div", { class: "am-note", text: `Could not load (${e.message})` }));
		}
	}

	roleEditor(g, role) {
		g = this.fresh(g);
		const el = this.el.bind(this);
		const d = this.gdata[g.id];
		const me = d.me;
		const isNew = !role;
		const perms = new Set(role?.perms || []);
		let color = role?.color || null;
		const $name = el("input", { class: "am-inp", placeholder: "Role name", maxlength: "24", autocapitalize: "off" });
		$name.value = role?.name || "";
		const $e = el("div", { class: "am-ferr" });
		const $save = el("button", { class: "am-go", text: isNew ? "Create role" : "Save role" });
		const $cols = el("div", { class: "am-cols" });
		const drawCols = () =>
			this.put(
				$cols,
				...[null, ...ROLE_COLORS].map((c) => {
					const $c = el("div", { class: `am-col${c === color ? " on" : ""}${c ? "" : " none"}`, onclick: () => {
						color = c;
						drawCols();
					} }, c ? null : this.ico("close", 16));
					if (c) $c.style.background = c;
					return $c;
				}),
			);
		drawCols();
		const permRows = PERMS.map(([key, label, desc]) => {
			// You can't give out a permission you don't have yourself.
			const locked = !me.owner && !me.perms.includes(key) && !perms.has(key);
			const $sw = el("div", { class: `am-sw${perms.has(key) ? " on" : ""}` });
			const row = el(
				"div",
				{
					class: "am-it",
					onclick: () => {
						if (locked) {
							$e.textContent = "You can only give permissions you have yourself";
							return;
						}
						$e.textContent = "";
						if (perms.has(key)) perms.delete(key);
						else perms.add(key);
						$sw.classList.toggle("on", perms.has(key));
					},
				},
				el("div", {}, el("span", { text: label }), el("small", { text: locked ? "You don't have this permission" : desc })),
				$sw,
			);
			if (locked) row.style.opacity = ".5";
			return row;
		});
		$save.onclick = async () => {
			const name = $name.value.trim();
			if (!name) {
				$e.textContent = "Give the role a name";
				return;
			}
			$save.disabled = true;
			$e.textContent = "";
			try {
				const body = isNew ? { action: "role_create", group_id: g.id } : { action: "role_update", role_id: role.id };
				await this.api("groups", { method: "POST", body: JSON.stringify({ ...body, name, color, perms: [...perms] }) });
				await this.loadGroup(g);
				this.refreshHome();
				this.rolesSheet(g);
			} catch (e) {
				$e.textContent = e.message;
				$save.disabled = false;
			}
		};
		const move = async (dir) => {
			try {
				await this.api("groups", { method: "POST", body: JSON.stringify({ action: "role_move", role_id: role.id, dir }) });
				await this.loadGroup(g);
				this.rolesSheet(g);
			} catch (e) {
				this.flash(e.message);
			}
		};
		const i = isNew ? -1 : d.roles.findIndex((r) => r.id === role.id);
		this.sheet(
			isNew ? "New role" : "Edit role",
			$name,
			el("div", { class: "am-fl", text: "Colour" }),
			$cols,
			el("div", { class: "am-fl", text: "Permissions" }),
			...permRows,
			$e,
			$save,
			...(isNew ? [el("div", { class: "am-sub", style: "margin:14px 16px 0", text: "Save the role first, then you can add people to it here." })] : this.roleMembers(g, role)),
			!isNew && i > 0 ? this.item("up", "Move up", () => move("up"), "", "Rank higher") : null,
			!isNew && i >= 0 && i < d.roles.length - 1 ? this.item("down", "Move down", () => move("down"), "", "Rank lower") : null,
			isNew ? null : this.item("trash", "Delete role", () => this.confirm(`Delete ${role.name}?`, "Anyone with this role goes back to having none.", "Yes, delete role", async () => {
				await this.api("groups", { method: "POST", body: JSON.stringify({ action: "role_delete", role_id: role.id }) });
				await this.loadGroup(g);
				this.refreshHome();
				this.rolesSheet(g);
			}, () => this.roleEditor(g, role)), "danger"),
			this.item("close", "Back", () => this.rolesSheet(g)),
		);
		if (isNew) setTimeout(() => $name.focus(), 250);
	}
}
