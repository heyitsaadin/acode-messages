import { ls } from "../util.js";

export class BannerMethods {
	/* ---------- group banner ---------- */

	bannerMenu(g, error) {
		this.sheet(
			"Group banner",
			this.item("image", "Choose a picture", () => this.pickBanner(g), "", "Wide pictures look best"),
			this.item("link", "Use an image link", () => this.bannerLink(g)),
			g.banner ? this.item("close", "Remove banner", () => this.setBanner(g, null), "danger") : null,
			error ? this.el("div", { class: "am-ferr", text: error }) : null,
		);
	}

	pickBanner(g) {
		const $f = document.createElement("input");
		$f.type = "file";
		$f.accept = "image/*";
		$f.style.display = "none";
		$f.onchange = async () => {
			const f = $f.files?.[0];
			$f.remove();
			if (!f) return;
			this.sheet("Group banner", this.el("div", { class: "am-note", text: "Uploading…" }));
			try {
				await this.setBanner(g, await this.prepImage(f));
			} catch (e) {
				this.bannerMenu(g, e.message);
			}
		};
		this.$root.append($f);
		$f.click();
	}

	// Let the person pick which part of the picture to use (move and zoom), make it a W0 x H0 picture
	// and squeeze it under the server's size limit. Rejects with .cancelled = true if they back out.
	prepImage(file, W0 = 960, H0 = 320, limit = 270000) {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = async () => {
				try {
					const r = await this.cropPicture(img, W0, H0);
					URL.revokeObjectURL(url);
					let W = W0;
					let H = H0;
					for (let attempt = 0; attempt < 5; attempt++) {
						const c = document.createElement("canvas");
						c.width = W;
						c.height = H;
						c.getContext("2d").drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
						for (const q of [0.82, 0.7, 0.58, 0.46]) {
							const out = c.toDataURL("image/jpeg", q);
							if (out.length <= limit) return resolve(out);
						}
						W = Math.round(W * 0.78);
						H = Math.round(H * 0.78);
					}
					reject(new Error("That picture is too large"));
				} catch (e) {
					URL.revokeObjectURL(url);
					reject(e);
				}
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error("Could not read that picture"));
			};
			img.src = url;
		});
	}

	bannerLink(g) {
		const $in = this.el("input", { class: "am-inp", placeholder: "https://…/banner.png", autocapitalize: "off", inputmode: "url" });
		const $go = this.el("button", { class: "am-go", text: "Set banner" });
		const $e = this.el("div", { class: "am-ferr" });
		$go.onclick = async () => {
			const v = $in.value.trim();
			if (!/^https:\/\/\S{4,}$/.test(v)) {
				$e.textContent = "Use a link that starts with https://";
				return;
			}
			$go.disabled = true;
			await this.setBanner(g, v, (m) => {
				$e.textContent = m;
				$go.disabled = false;
			});
		};
		this.sheet("Banner image link", $in, $e, $go);
		setTimeout(() => $in.focus(), 250);
	}

	async setBanner(g, banner, onError) {
		try {
			const res = await this.api("banner", { method: "POST", body: JSON.stringify({ group_id: g.id, banner }) });
			// A background refresh may have swapped the group object since the sheet opened.
			const cur = this.state.home.groups.find((x) => x.id === g.id) || g;
			cur.banner = res.banner || null;
			ls.set("am-home", { uid: this.state.user?.id, home: this.state.home, at: Date.now() });
			this.closeSheet();
			this.paintHome();
			this.refreshHome();
		} catch (e) {
			if (onError) onError(e.message);
			else this.bannerMenu(g, e.message);
		}
	}
}
