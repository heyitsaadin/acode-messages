import { ls } from "../util.js";

export class PermissionsMethods {
	/* ---------- permissions ---------- */

	fresh(g) {
		return this.state.home.groups.find((x) => x.id === g.id) || g;
	}

	isOwner(g) {
		return !!g && (!!g.is_owner || String(g.owner_id) === String(this.me.id));
	}

	can(g, perm) {
		return !!g && (this.isOwner(g) || (Array.isArray(g.perms) && g.perms.includes(perm)));
	}

	isMuted(g) {
		return !!g?.muted_until && new Date(g.muted_until) > new Date();
	}

	untilText(v) {
		const t = new Date(v);
		if (t.getFullYear() >= 2100) return "until someone unmutes you";
		const time = t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
		return t.toDateString() === new Date().toDateString() ? `until ${time}` : `until ${t.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
	}

	// A mute on the chat screen: the box is greyed out and says why.
	syncMute() {
		if (!this.$ta) return;
		const c = this.state.channel;
		const g = c && c.kind !== "dm" ? this.group : null;
		const muted = this.isMuted(g);
		const readOnly = !muted && !!g && this.chanInfo()?.can_send === false;
		const off = muted || readOnly;
		this.$ta.disabled = off;
		if (this.$emoBtn) this.$emoBtn.disabled = off;
		if (this.$mic) this.$mic.disabled = off;
		this.$ta.placeholder = muted ? `You're muted ${this.untilText(g.muted_until)}` : readOnly ? "You can't send messages in this channel" : this.chatPlaceholder();
		if (off) this.$emo.classList.remove("show");
	}

	// Runs after every home refresh: keeps an open chat in step with kicks, mutes and renames.
	afterHome() {
		if (this.view !== "chat") return;
		const c = this.state.channel;
		if (!c || c.kind === "dm") return;
		if (!this.group) {
			this.showHome();
			this.flash("You're no longer in that group");
			return;
		}
		if (!this.chanInfo()) {
			this.showHome();
			this.flash("That channel isn't available any more");
			return;
		}
		this.paintChatHead();
		this.syncMute();
	}

	roleLine(g) {
		const bits = [];
		if (this.isOwner(g)) bits.push("You own this group");
		else if (g.role_name) bits.push(`Your role: ${g.role_name}`);
		if (this.isMuted(g)) bits.push(`Muted ${this.untilText(g.muted_until)}`);
		return bits.length ? this.el("div", { class: "am-sub", style: "margin:-4px 14px 6px", text: bits.join(" · ") }) : null;
	}

	// Group settings under small headings. Each row only shows for people who hold that permission.
	manageItems(g) {
		g = this.fresh(g);
		const sec = (title, ...items) => {
			const list = items.filter(Boolean);
			return list.length ? [this.el("div", { class: "am-fl", text: title }), ...list] : [];
		};
		const n = (g.channels || []).length;
		return [
			...sec("Channels", this.can(g, "manage_channels") ? this.item("hash", "Channels", () => this.channelsAdmin(g), "", `${n} channel${n === 1 ? "" : "s"} · create, edit, choose who can use them`) : null),
			...sec(
				"Appearance",
				this.can(g, "manage_group") ? this.item("edit", "Rename group", () => this.renameForm(g)) : null,
				this.can(g, "manage_group") ? this.item("image", g.icon ? "Change group picture" : "Add a group picture", () => this.iconMenu(g), "", "The round picture in the left bar") : null,
				this.can(g, "manage_group") ? this.item("image", g.banner ? "Change group banner" : "Add a group banner", () => this.bannerMenu(g), "", "Shown at the top of the group for everyone") : null,
			),
			...sec("People & access", this.can(g, "manage_roles") ? this.item("shield", "Roles", () => this.rolesSheet(g), "", "Create roles, then give them to people in one tap") : null),
			// Only the owner sees this, and only when the server knows about public groups (is_public is sent).
			...sec("Discovery", this.isOwner(g) && typeof g.is_public === "boolean" ? this.item("globe", "Public group", () => this.publicSheet(g), "", g.is_public ? "On · listed under Public groups, anyone can join" : "Off · people need an invite code") : null),
		];
	}

	// Owner: list the group under "Public groups" so people can join without an invite code.
	publicSheet(g) {
		g = this.fresh(g);
		const el = this.el.bind(this);
		let on = !!g.is_public;
		const $sw = el("div", { class: `am-sw${on ? " on" : ""}` });
		const $desc = el("textarea", { class: "am-inp", rows: "3", placeholder: "What is this group about?", maxlength: "140" });
		$desc.value = g.description || "";
		const $cnt = el("div", { class: "am-cnt" });
		const $e = el("div", { class: "am-ferr" });
		const $save = el("button", { class: "am-go", text: "Save" });
		const $more = el("div", {}, el("div", { class: "am-fl", text: "Short description" }), $desc, $cnt);
		const sync = () => {
			$sw.classList.toggle("on", on);
			$more.style.display = on ? "" : "none";
			$cnt.textContent = `${$desc.value.length}/140`;
		};
		$desc.addEventListener("input", sync);
		const row = el(
			"div",
			{ class: "am-it", onclick: () => ((on = !on), sync()) },
			this.ico("globe", 22),
			el("div", {}, el("span", { text: "List in Public groups" }), el("small", { text: "Anyone on Acode Messages can find the group and join it without an invite code. Private channels stay private, and the invite code still works." })),
			$sw,
		);
		$save.onclick = async () => {
			const description = $desc.value.trim();
			if (on && !description && !g.description) {
				$e.textContent = "Add a short description so people know what the group is about";
				return;
			}
			$save.disabled = true;
			$e.textContent = "";
			try {
				const r = await this.api("groups", { method: "POST", body: JSON.stringify({ action: "set_public", group_id: g.id, public: on, description }) });
				const cur = this.fresh(g);
				cur.is_public = !!r.is_public;
				cur.description = r.description || "";
				if (this.disc) this.disc.at = 0; // refresh the public list next time it opens
				this.refreshHome();
				this.serverSettings(cur);
			} catch (e) {
				$e.textContent = e.message;
				$save.disabled = false;
			}
		};
		sync();
		this.sheet("Public group", row, $more, $e, $save, this.item("close", "Back", () => this.serverSettings(g)));
	}

	// Generic "are you sure" sheet. onYes may throw; the message shows under the button.
	confirm(title, text, yes, onYes, onNo, icon = "trash") {
		const $e = this.el("div", { class: "am-ferr" });
		const $y = this.item(
			icon,
			yes,
			async () => {
				if ($y.dataset.busy) return;
				$y.dataset.busy = "1";
				try {
					await onYes();
				} catch (e) {
					delete $y.dataset.busy;
					$e.textContent = e.message;
				}
			},
			"danger",
		);
		this.sheet(title, text ? this.el("div", { class: "am-sub", style: "margin:0 14px 8px", text }) : null, $y, this.item("close", "Cancel", () => (onNo ? onNo() : this.closeSheet())), $e);
	}

	renameForm(g) {
		const $in = this.el("input", { class: "am-inp", placeholder: "Group name", maxlength: "40", autocapitalize: "off", value: g.name });
		const $go = this.el("button", { class: "am-go", text: "Save name" });
		const $e = this.el("div", { class: "am-ferr" });
		const go = async () => {
			const v = $in.value.trim();
			if (!v) return;
			if (v === g.name) return this.closeSheet();
			$go.disabled = true;
			$e.textContent = "";
			try {
				await this.api("groups", { method: "POST", body: JSON.stringify({ action: "rename", group_id: g.id, name: v }) });
				this.fresh(g).name = v;
				this.closeSheet();
				this.paintHome();
				if (this.view === "chat") this.afterHome();
				this.refreshHome();
			} catch (e) {
				$e.textContent = e.message;
				$go.disabled = false;
			}
		};
		$go.onclick = go;
		$in.addEventListener("keydown", (e) => e.key === "Enter" && go());
		this.sheet("Rename group", $in, $e, $go);
		setTimeout(() => $in.focus(), 250);
	}

	confirmDelete(g) {
		this.confirm(
			`Delete ${g.name}?`,
			"This permanently deletes the group, its channels and every message in it, for everyone. It can't be undone.",
			"Yes, delete group",
			async () => {
				await this.api("groups", { method: "POST", body: JSON.stringify({ action: "delete", group_id: g.id }) });
				this.closeSheet();
				this.state.home.groups = this.state.home.groups.filter((x) => x.id !== g.id);
				this.state.tab = "dm";
				ls.set("am-tab", "dm");
				if (this.view === "chat") this.showHome();
				this.paintHome();
				this.refreshHome();
			},
			() => this.groupMenu(g),
		);
	}

	confirmLeave(g) {
		this.sheet(
			`Leave ${g.name}?`,
			this.item("leave", "Yes, leave", async () => {
				try {
					await this.api("groups", { method: "POST", body: JSON.stringify({ action: "leave", group_id: g.id }) });
					this.closeSheet();
					if (this.view === "chat") this.showHome();
					this.state.tab = "dm";
					await this.refreshHome();
				} catch (e) {
					this.flash(e.message);
				}
			}, "danger"),
			this.item("close", "Cancel", () => this.closeSheet()),
		);
	}
}
