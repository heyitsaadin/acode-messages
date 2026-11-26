import { ls } from "../util.js";

export class GroupIconMethods {
	/* ---------- group picture (the round icon in the rail) ---------- */

	iconMenu(g, error) {
		this.sheet(
			"Group picture",
			this.item("image", "Choose a picture", () => this.pickIcon(g), "", "It is cropped to a square"),
			this.item("link", "Use an image link", () => this.iconLink(g)),
			g.icon ? this.item("close", "Remove picture", () => this.setIcon(g, null), "danger") : null,
			error ? this.el("div", { class: "am-ferr", text: error }) : null,
		);
	}

	pickIcon(g) {
		this.pickImage(256, 256, 120000, async (data, err) => {
			if (err) return this.iconMenu(g, err);
			if (!data) return;
			this.sheet("Group picture", this.el("div", { class: "am-note", text: "Uploading…" }));
			await this.setIcon(g, data);
		});
	}

	iconLink(g) {
		const $in = this.el("input", { class: "am-inp", placeholder: "https://…/icon.png", autocapitalize: "off", inputmode: "url" });
		const $go = this.el("button", { class: "am-go", text: "Set picture" });
		const $e = this.el("div", { class: "am-ferr" });
		$go.onclick = async () => {
			const v = $in.value.trim();
			if (!/^https:\/\/\S{4,}$/.test(v)) {
				$e.textContent = "Use a link that starts with https://";
				return;
			}
			$go.disabled = true;
			await this.setIcon(g, v, (m) => {
				$e.textContent = m;
				$go.disabled = false;
			});
		};
		this.sheet("Picture link", $in, $e, $go);
		setTimeout(() => $in.focus(), 250);
	}

	async setIcon(g, icon, onError) {
		try {
			const res = await this.api("banner", { method: "POST", body: JSON.stringify({ group_id: g.id, kind: "icon", icon }) });
			const cur = this.state.home.groups.find((x) => x.id === g.id) || g;
			cur.icon = res.icon || null;
			ls.set("am-home", { uid: this.state.user?.id, home: this.state.home, at: Date.now() });
			this.closeSheet();
			this.paintHome();
			this.refreshHome();
		} catch (e) {
			if (onError) onError(e.message);
			else this.iconMenu(g, e.message);
		}
	}
}
