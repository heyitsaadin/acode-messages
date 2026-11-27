import { CH_PERMS, SLOWMODES } from "../constants.js";

export class ChannelsMethods {
	/* ---------- channels ---------- */

	// The settings of the channel that's open right now (topic, slowmode, who can send), as the server last told us.
	chanInfo() {
		const c = this.state.channel;
		const g = c && c.kind !== "dm" ? this.group : null;
		return g ? (g.channels || []).find((x) => x.slug === c.slug) || null : null;
	}

	slowLabel(s) {
		if (!s) return "Off";
		if (s < 60) return `${s} seconds`;
		if (s < 3600) return `${s / 60} minute${s === 60 ? "" : "s"}`;
		return `${s / 3600} hour${s === 3600 ? "" : "s"}`;
	}

	chanPost(body) {
		return this.api("groups", { method: "POST", body: JSON.stringify(body) });
	}

	chanSub(c) {
		return [c.private ? "Private" : "", c.slowmode ? `Slowmode ${this.slowLabel(c.slowmode)}` : "", c.topic || ""].filter(Boolean).join(" · ");
	}

	// Every channel in one list: tap one to edit it, or create a new one.
	channelsAdmin(g) {
		g = this.fresh(g);
		const n = g.channels.length;
		const cats = g.categories || [];
		const back = () => this.channelsAdmin(g);
		const inCat = (c) => cats.find((k) => k.id === c.category_id)?.name;
		this.sheet(
			"Channels",
			this.item("plus", "Create channel", () => this.channelForm(g)),
			this.item("folder", "Create category", () => this.categoryForm(g, back)),
			this.el("div", { class: "am-fl", text: `Text channels · ${n}` }),
			...g.channels.map((c) => this.item(c.private ? "lock" : "hash", c.name, () => this.channelSettings(g, c), "", [inCat(c), this.chanSub(c)].filter(Boolean).join(" · "))),
			...(cats.length
				? [this.el("div", { class: "am-fl", text: `Categories · ${cats.length}` }), ...cats.map((k) => this.item("folder", k.name, () => this.categorySettings(g, k, back), "", `${g.channels.filter((c) => c.category_id === k.id).length} channels`))]
				: []),
		);
	}

	// catId pre-selects a category; back is where Cancel and a finished create go (default: the Channels list).
	channelForm(g, catId = null, back = null) {
		g = this.fresh(g);
		let priv = false;
		let cat = catId;
		const $name = this.el("input", { class: "am-inp", placeholder: "channel-name", maxlength: "32", autocapitalize: "off" });
		const $topic = this.el("input", { class: "am-inp", placeholder: "Topic (optional)", maxlength: "1024" });
		const $sw = this.el("div", { class: "am-sw" });
		const $priv = this.el(
			"div",
			{ class: "am-it", onclick: () => $sw.classList.toggle("on", (priv = !priv)) },
			this.ico("lock", 22),
			this.el("div", {}, this.el("span", { text: "Private channel" }), this.el("small", { text: "Only roles and people you pick can see it" })),
			$sw,
		);
		const $e = this.el("div", { class: "am-ferr" });
		const $go = this.el("button", { class: "am-go", text: "Create channel" });
		const go = async () => {
			const name = $name.value.trim();
			if (!name) return;
			$go.disabled = true;
			$e.textContent = "";
			try {
				const { channel } = await this.chanPost({ action: "channel_create", group_id: g.id, name, topic: $topic.value.trim(), private: priv, ...(cat != null ? { category_id: cat } : {}) });
				await this.refreshHome();
				const fresh = this.fresh(g);
				const c = fresh.channels.find((x) => x.slug === channel.slug) || channel;
				// A private channel is useless until someone can get in, so go straight to its access list.
				priv ? this.channelPerms(fresh, c) : this.channelsAdmin(fresh);
			} catch (e) {
				$e.textContent = e.message;
				$go.disabled = false;
			}
		};
		$go.onclick = go;
		$name.addEventListener("keydown", (e) => e.key === "Enter" && go());
		this.sheet("Create channel", $name, $topic, $priv, $e, $go, this.item("close", "Cancel", () => this.channelsAdmin(g)));
		setTimeout(() => $name.focus(), 250);
	}

	// Discord's "Channel Settings": name, topic, then permissions / slowmode / delete.
	channelSettings(g, c) {
		g = this.fresh(g);
		c = g.channels.find((x) => x.slug === c.slug) || c;
		const $name = this.el("input", { class: "am-inp", placeholder: "channel-name", maxlength: "32", autocapitalize: "off", value: c.name });
		const $topic = this.el("textarea", { class: "am-inp", rows: "3", placeholder: "What is this channel about?", maxlength: "1024" });
		$topic.value = c.topic || "";
		const $e = this.el("div", { class: "am-ferr" });
		const $go = this.el("button", { class: "am-go", text: "Save changes" });
		$go.onclick = async () => {
			const name = $name.value.trim();
			if (!name) return;
			$go.disabled = true;
			$e.textContent = "";
			try {
				await this.chanPost({ action: "channel_update", slug: c.slug, name, topic: $topic.value.trim() });
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
		this.sheet(
			`# ${c.name}`,
			this.el("div", { class: "am-fl", text: "Channel name" }),
			$name,
			this.el("div", { class: "am-fl", text: "Topic" }),
			$topic,
			$e,
			$go,
			this.el("div", { class: "am-fl", text: "Who can use it" }),
			this.item("shield", "Channel permissions", () => this.channelPerms(g, c), "", c.private ? "Private · only chosen roles and people" : "Everyone in the group"),
			this.item("pause", "Slowmode", () => this.slowmodeSheet(g, c), "", this.slowLabel(c.slowmode)),
			this.item(
				"trash",
				"Delete channel",
				() =>
					this.confirm(
						`Delete #${c.name}?`,
						"Every message in it is deleted for everyone. It can't be undone.",
						"Yes, delete channel",
						async () => {
							await this.chanPost({ action: "channel_delete", slug: c.slug });
							await this.refreshHome();
							this.channelsAdmin(g);
						},
						() => this.channelSettings(g, c),
					),
				"danger",
			),
			this.item("close", "Back", () => this.channelsAdmin(g)),
		);
	}

	slowmodeSheet(g, c) {
		const row = ([label, s]) =>
			this.el(
				"div",
				{
					class: "am-it",
					onclick: async () => {
						try {
							await this.chanPost({ action: "channel_update", slug: c.slug, slowmode: s });
							await this.refreshHome();
							this.channelSettings(g, c);
						} catch (e) {
							this.flash(e.message);
						}
					},
				},
				this.el("div", {}, this.el("span", { text: label })),
				(c.slowmode || 0) === s ? this.ico("check", 20) : null,
			);
		this.sheet(
			"Slowmode",
			this.el("div", { class: "am-sub", style: "margin:0 14px 8px", text: "People can send one message per interval. The owner and channel managers aren't limited." }),
			...SLOWMODES.map(row),
			this.item("close", "Back", () => this.channelSettings(g, c)),
		);
	}

	// Permissions, Basic view: a Private switch and the list of who gets in. "Advanced" has the per-role switches.
	async channelPerms(g, c) {
		g = this.fresh(g);
		const el = this.el.bind(this);
		this.sheet("Channel permissions", el("div", { class: "am-note", text: "Loading…" }));
		let seq = this.sheetSeq;
		let data, d;
		try {
			[data, d] = await Promise.all([this.api(`channels?settings=${encodeURIComponent(c.slug)}`), this.loadGroup(g)]);
		} catch (e) {
			if (this.sheetSeq === seq) this.sheet("Channel permissions", el("div", { class: "am-note", text: `Could not load (${e.message})` }), this.item("close", "Back", () => this.channelSettings(g, c)));
			return;
		}
		if (this.sheetSeq !== seq) return;
		const ovr = data.overrides;
		const live = () => this.sheetSeq === seq && this.$sheet.classList.contains("open");
		const show = (...nodes) => {
			this.sheet(...nodes);
			seq = this.sheetSeq;
		};
		const find = (kind, id) => ovr.find((o) => o.kind === kind && String(o.target_id) === String(id));
		const save = async (kind, id, allow, deny) => {
			await this.chanPost({ action: "channel_override_set", slug: c.slug, kind, target_id: Number(id), allow, deny });
			const i = ovr.findIndex((o) => o.kind === kind && String(o.target_id) === String(id));
			if (!allow.length && !deny.length) {
				if (i >= 0) ovr.splice(i, 1);
			} else if (i >= 0) Object.assign(ovr[i], { allow, deny });
			else ovr.push({ kind, target_id: String(id), allow, deny });
			this.refreshHome();
		};
		const isPrivate = () => (find("everyone", 0)?.deny || []).includes("view");
		const nameOf = (o) => (o.kind === "role" ? d.roles.find((r) => String(r.id) === String(o.target_id)) : d.members.find((m) => String(m.id) === String(o.target_id)));

		const basic = () => {
			const priv = isPrivate();
			const $sw = el("div", { class: `am-sw${priv ? " on" : ""}` });
			const toggle = el(
				"div",
				{
					class: "am-it",
					onclick: async () => {
						const o = find("everyone", 0) || { allow: [], deny: [] };
						const deny = new Set(o.deny || []);
						priv ? deny.delete("view") : deny.add("view");
						try {
							await save("everyone", 0, (o.allow || []).filter((p) => p !== "view"), [...deny]);
							if (live()) basic();
						} catch (e) {
							this.flash(e.message);
						}
					},
				},
				this.ico("lock", 22),
				el("div", {}, el("span", { text: "Private channel" }), el("small", { text: priv ? "Only the people and roles below can see it" : "Everyone in the group can see it" })),
				$sw,
			);
			const who = ovr.filter((o) => o.kind !== "everyone" && (o.allow || []).includes("view") && nameOf(o));
			const whoRow = (o) => {
				const x = nameOf(o);
				const drop = async () => {
					try {
						await save(o.kind, o.target_id, (o.allow || []).filter((p) => p !== "view"), o.deny || []);
						if (live()) basic();
					} catch (e) {
						this.flash(e.message);
					}
				};
				if (o.kind === "role") return el("div", { class: "am-it", onclick: drop }, el("span", { class: "am-dot", style: `background:${x.color || "rgba(127,127,127,.55)"}` }), el("div", {}, el("span", { text: x.name }), el("small", { text: "Role" })), this.ico("close", 20));
				return el("div", { class: "am-it", onclick: drop }, this.avw(x, 38), el("div", {}, el("span", { text: x.name }), el("small", { text: "Person" })), this.ico("close", 20));
			};
			show(
				"Channel permissions",
				toggle,
				el("div", { class: "am-sub", style: "margin:2px 16px 4px", text: "The owner and anyone who can manage channels can always see every channel." }),
				priv ? this.item("plus", "Add roles or people", () => picker()) : null,
				priv ? el("div", { class: "am-fl", text: "Who can access" }) : null,
				...(priv ? who.map(whoRow) : []),
				priv && !who.length ? el("div", { class: "am-sub", style: "margin:6px 16px", text: "Nobody yet. Tap “Add roles or people”." }) : null,
				el("div", { class: "am-fl", text: "Advanced" }),
				this.item("sliders", "Advanced permissions", () => advanced(), "", "Choose what each role can do here"),
				this.item("close", "Back", () => this.channelSettings(g, c)),
			);
		};

		// One tap on a role or person lets them in and returns to the list.
		const picker = () => {
			const has = (kind, id) => (find(kind, id)?.allow || []).includes("view");
			const add = async (kind, id) => {
				const o = find(kind, id) || { allow: [], deny: [] };
				try {
					await save(kind, id, [...new Set([...(o.allow || []), "view"])], (o.deny || []).filter((p) => p !== "view"));
					if (live()) basic();
				} catch (e) {
					this.flash(e.message);
				}
			};
			const roles = d.roles.filter((r) => !has("role", r.id));
			const people = d.members.filter((m) => !m.is_owner && !has("member", m.id));
			show(
				"Add roles or people",
				roles.length ? el("div", { class: "am-fl", text: "Roles" }) : null,
				...roles.map((r) => this.roleRow(r, false, () => add("role", r.id))),
				people.length ? el("div", { class: "am-fl", text: "People" }) : null,
				...people.map((m) => el("div", { class: "am-it", onclick: () => add("member", m.id) }, this.avw(m, 38), el("div", {}, el("span", { text: m.name })))),
				roles.length || people.length ? null : el("div", { class: "am-note", text: "Everyone is already added." }),
				this.item("close", "Back", () => basic()),
			);
		};

		// Advanced view: pick @everyone or a role, then set View / Send to deny, inherit or allow.
		const advanced = () => {
			const sum = (o) => {
				const n = o ? (o.allow || []).length + (o.deny || []).length : 0;
				return n ? `${n} override${n === 1 ? "" : "s"}` : "No overrides";
			};
			const people = ovr.filter((o) => o.kind === "member" && nameOf(o));
			show(
				"Advanced permissions",
				el("div", { class: "am-sub", style: "margin:0 14px 8px", text: "Pick who to change. Overrides on a role beat @everyone, and ones on a person beat their role." }),
				this.item("globe", "@everyone", () => editor("everyone", 0, "@everyone"), "", sum(find("everyone", 0))),
				...d.roles.map((r) => this.roleRow(r, false, () => editor("role", r.id, r.name), sum(find("role", r.id)))),
				...people.map((o) => this.item("user", nameOf(o).name, () => editor("member", o.target_id, nameOf(o).name), "", sum(o))),
				this.item("close", "Back", () => basic()),
			);
		};

		const editor = (kind, id, label) => {
			const o = find(kind, id) || { allow: [], deny: [] };
			const stateOf = (p) => ((o.deny || []).includes(p) ? "deny" : (o.allow || []).includes(p) ? "allow" : "inherit");
			const set = async (p, st) => {
				const allow = new Set(o.allow || []);
				const deny = new Set(o.deny || []);
				allow.delete(p);
				deny.delete(p);
				if (st === "allow") allow.add(p);
				if (st === "deny") deny.add(p);
				try {
					await save(kind, id, [...allow], [...deny]);
					if (live()) editor(kind, id, label);
				} catch (e) {
					this.flash(e.message);
				}
			};
			const rows = CH_PERMS.map(([key, title, desc]) => {
				const st = stateOf(key);
				const btn = (s, cls, kid) => el("button", { class: `${cls}${st === s ? " on" : ""}`, onclick: () => st !== s && set(key, s) }, kid);
				return el(
					"div",
					{ class: "am-it" },
					el("div", {}, el("span", { text: title }), el("small", { text: desc })),
					el("div", { class: "am-tri" }, btn("deny", "no", this.ico("close", 16)), btn("inherit", "", "/"), btn("allow", "yes", this.ico("check", 16))),
				);
			});
			show(label, el("div", { class: "am-sub", style: "margin:0 14px 4px", text: "✕ denies it, / keeps whatever it inherits, ✓ allows it." }), ...rows, this.item("close", "Back", () => advanced()));
		};

		basic();
	}

	newDm() {
		const $in = this.el("input", { class: "am-inp", placeholder: "Search by username", autocapitalize: "off" });
		const hint = () => this.el("div", { class: "am-note", text: "Find someone who uses Acode Messages." });
		const $res = this.el("div", {}, hint());
		let timer;
		$in.addEventListener("input", () => {
			clearTimeout(timer);
			const q = $in.value.trim();
			if (!q) return this.put($res, hint());
			timer = setTimeout(async () => {
				try {
					const { members } = await this.api(`members?q=${encodeURIComponent(q)}`);
					this.put($res, ...(members.length ? members.map((u) => this.userRow(u)) : [this.el("div", { class: "am-note", text: "No one found." })]));
				} catch (e) {
					this.put($res, this.el("div", { class: "am-note", text: `Search failed (${e.message})` }));
				}
			}, 300);
		});
		this.sheet("New message", $in, $res);
		setTimeout(() => $in.focus(), 250);
	}
}
