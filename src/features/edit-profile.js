import { ls } from "../util.js";

export class EditProfileMethods {
	/* ---------- edit profile ---------- */

	// Opened from the plugin's settings page: bring up the messages page, then the editor.
	async openEditProfile() {
		await this.launch();
		if (!this.$page || !this.state.user?.id) return;
		this.openedAt = 0;
		this.editProfile();
	}

	pickImage(w, h, limit, done) {
		const $f = document.createElement("input");
		$f.type = "file";
		$f.accept = "image/*";
		$f.style.display = "none";
		$f.onchange = async () => {
			const f = $f.files?.[0];
			$f.remove();
			if (!f) return;
			try {
				done(await this.prepImage(f, w, h, limit));
			} catch (e) {
				done(null, e.message);
			}
		};
		this.$root.append($f);
		$f.click();
	}

	applyMe(nu) {
		const id = Number(this.me.id);
		const m = { uid: this.me.id, about: nu.about || "" };
		if (nu.custom_name) m.name = nu.name;
		if (nu.custom_avatar) m.avatar_url = nu.avatar_url;
		ls.set("am-me", m);
		this.state.user = { ...this.state.user, name: nu.name, avatar_url: nu.avatar_url };
		const c = ls.get(`am-prof:${id}`);
		if (c) {
			c.user = { ...c.user, name: nu.name, avatar_url: nu.avatar_url, banner: nu.banner || null, about: nu.about || "" };
			ls.set(`am-prof:${id}`, c);
		}
	}

	editProfile(info0) {
		const el = this.el.bind(this);
		const u = this.me;
		const id = Number(u.id);
		const mine = ls.get("am-me", {}) || {};
		const src = info0 || ls.get(`am-prof:${id}`)?.user || {};
		const acodeAvatar = ls.get("cached-logged-in-user")?.avatar_url || null;
		const cur = { name: u.name || "", about: String(src.about ?? mine.about ?? ""), avatar: u.avatar_url || null, banner: src.banner || null, visibility: src.visibility || null };
		const draft = {}; // undefined = unchanged, null = remove, string = new picture
		const touched = {};
		const $ban = el("div", { class: "am-ed-ban" });
		const $av = el("div", { class: "am-ed-av" });
		const $acts = el("div", { class: "am-acts" });
		const $err = el("div", { class: "am-ferr" });
		const $name = el("input", { class: "am-inp", placeholder: "Display name", maxlength: "32", autocapitalize: "off" });
		const $about = el("textarea", { class: "am-inp", placeholder: "Tell people a little about yourself", maxlength: "190" });
		const $cnt = el("div", { class: "am-cnt" });
		const $save = el("button", { class: "am-go", text: "Save changes" });
		// Public / private choice. Only shown when the server reports one (it needs migration 012).
		const $vis = el("div");
		const paintVis = () => {
			if (!cur.visibility) return this.put($vis);
			this.put($vis, el("div", { class: "am-fl", text: "Profile privacy" }), this.visPicker(draft.visibility || cur.visibility, (v) => (draft.visibility = v)));
		};
		$name.value = cur.name;
		$about.value = cur.about;
		const val = (k) => (draft[k] !== undefined ? draft[k] : cur[k]);
		const count = () => {
			$cnt.textContent = `${$about.value.length}/190`;
		};
		const img = (url) => {
			const $i = document.createElement("img");
			$i.alt = "";
			$i.onerror = () => $i.remove();
			$i.src = this.bannerSrc(url);
			return $i;
		};
		const pick = (k, w, h, limit) => {
			$err.textContent = "";
			this.pickImage(w, h, limit, (d, e) => {
				if (e) {
					$err.textContent = e;
					return;
				}
				draft[k] = d;
				media();
			});
		};
		const pickAvatar = () => pick("avatar", 256, 256, 110000);
		const pickBanner = () => pick("banner", 960, 320, 270000);
		const media = () => {
			const banner = val("banner");
			const avatar = draft.avatar === null ? acodeAvatar : val("avatar");
			this.put($ban, banner ? img(banner) : null, el("div", { class: "am-ed-cam b" }, this.ico("image", 16)));
			this.put($av, this.avatar({ name: $name.value.trim() || cur.name, avatar_url: avatar }, 90), el("div", { class: "am-ed-cam" }, this.ico("image", 16)));
			const customAvatar = draft.avatar !== undefined ? !!draft.avatar : !!mine.avatar_url;
			this.put(
				$acts,
				el("button", { class: "am-pillb", text: "Change picture", onclick: pickAvatar }),
				el("button", { class: "am-pillb", text: "Change banner", onclick: pickBanner }),
				customAvatar
					? el("button", {
							class: "am-pillb danger",
							text: "Reset picture",
							onclick: () => {
								draft.avatar = null;
								media();
							},
						})
					: null,
				banner
					? el("button", {
							class: "am-pillb danger",
							text: "Remove banner",
							onclick: () => {
								draft.banner = null;
								media();
							},
						})
					: null,
			);
		};
		$ban.onclick = pickBanner;
		$av.onclick = pickAvatar;
		$name.addEventListener("input", () => !val("avatar") && media());
		$about.addEventListener("input", () => {
			touched.about = true;
			count();
		});
		$save.onclick = async () => {
			const body = {};
			const name = $name.value.trim();
			const about = $about.value.trim();
			if (name !== cur.name) body.name = name;
			if (about !== cur.about.trim()) body.about = about;
			if (draft.avatar !== undefined) body.avatar = draft.avatar;
			if (draft.banner !== undefined) body.banner = draft.banner;
			if (draft.visibility && draft.visibility !== cur.visibility) body.visibility = draft.visibility;
			if (!Object.keys(body).length) {
				this.closeSheet();
				return;
			}
			$save.disabled = true;
			$save.textContent = "Saving…";
			$err.textContent = "";
			try {
				const { user: nu } = await this.api("me", { method: "POST", body: JSON.stringify(body) });
				this.applyMe(nu);
				this.closeSheet();
				this.paintHome();
				this.refreshHome();
				this.profile(this.me, true);
			} catch (e) {
				$err.textContent = /HTTP 404/.test(e.message) ? "Your server doesn't support profile editing yet. Update acode-messages-server first." : e.message;
				$save.disabled = false;
				$save.textContent = "Save changes";
			}
		};
		media();
		count();
		this.openSheet(true, "", [
			$ban,
			$av,
			$acts,
			el("div", { class: "am-fl", text: "Display name" }),
			$name,
			el("div", { class: "am-sub", style: "margin:4px 18px 0", text: "Leave empty to use your Acode account name." }),
			el("div", { class: "am-fl", text: "About me" }),
			$about,
			$cnt,
			$err,
			$save,
		]);
		// Opened from settings with nothing loaded yet: fetch the saved values in the background.
		if (!info0) {
			this.api(`profile?user=${id}`, { cache: "no-store" })
				.then((d) => {
					ls.set(`am-prof:${id}`, d);
					if (!touched.about && d.user?.about != null) {
						cur.about = String(d.user.about);
						$about.value = cur.about;
						count();
					}
					if (draft.banner === undefined) {
						cur.banner = d.user?.banner || null;
						media();
					}
				})
				.catch(() => {});
		}
	}
}
