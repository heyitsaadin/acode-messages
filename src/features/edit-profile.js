import { ls } from "../util.js";
import { GIF_LIMITS } from "../gif.js";

export class EditProfileMethods {
	/* ---------- edit profile ---------- */

	// Opened from the plugin's settings page: bring up the messages page, then the editor.
	async openEditProfile() {
		await this.launch();
		if (!this.$page || !this.state.user?.id) return;
		this.openedAt = 0;
		this.editProfile();
	}

	// gifKind ("avatar" or "banner") lets that picture be a GIF: it skips the cropper and is uploaded as it is,
	// as long as it passes the GIF limits. Without it (group icons and so on) a GIF is flattened to a still picture.
	// onBusy(true/false) tells the caller when the picture is being processed (after the crop, or while a GIF is checked).
	pickImage(w, h, limit, done, gifKind, onBusy) {
		const $f = document.createElement("input");
		$f.type = "file";
		$f.accept = "image/*";
		$f.style.display = "none";
		$f.onchange = async () => {
			const f = $f.files?.[0];
			$f.remove();
			if (!f) return;
			try {
				if (gifKind && (await this.looksLikeGif(f))) {
					onBusy?.(true);
					await this.nextPaint();
					const g = await this.prepGif(f, gifKind);
					onBusy?.(false);
					done(g);
					return;
				}
				const d = await this.prepImage(f, w, h, limit, () => onBusy?.(true));
				onBusy?.(false);
				done(d);
			} catch (e) {
				onBusy?.(false);
				if (e.cancelled) return;
				done(null, e.message);
			}
		};
		this.$root.append($f);
		$f.click();
	}

	applyMe(nu) {
		const id = Number(this.me.id);
		const deco = nu.avatar_decoration || null;
		const m = { uid: this.me.id, about: nu.about || "" };
		if (nu.custom_name) m.name = nu.name;
		if (nu.custom_avatar) m.avatar_url = nu.avatar_url;
		ls.set("am-me", m);
		const fx = nu.profile_effect || null;
		this.state.user = { ...this.state.user, name: nu.name, avatar_url: nu.avatar_url, avatar_decoration: deco, profile_effect: fx };
		const c = ls.get(`am-prof:${id}`);
		if (c) {
			c.user = { ...c.user, name: nu.name, avatar_url: nu.avatar_url, avatar_decoration: deco, profile_effect: fx, banner: nu.banner || null, about: nu.about || "", ...(nu.visibility ? { visibility: nu.visibility, onboarded: nu.onboarded } : {}) };
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
		const cur = { name: u.name || "", about: String(src.about ?? mine.about ?? ""), avatar: u.avatar_url || null, banner: src.banner || null, visibility: src.visibility || null, decoration: u.avatar_decoration ?? src.avatar_decoration ?? null };
		const draft = {}; // undefined = unchanged, null = remove, string = new picture (or decoration name)
		const touched = {};
		const $ban = el("div", { class: "am-ed-ban" });
		const $av = el("div", { class: "am-ed-av" });
		const $acts = el("div", { class: "am-acts" });
		const $decos = el("div", { class: "am-decos" });
		const $err = el("div", { class: "am-ferr" });
		const $name = el("input", { class: "am-inp", placeholder: "Display name", maxlength: "32", autocapitalize: "off" });
		const $about = el("textarea", { class: "am-inp", placeholder: "Tell people a little about yourself", maxlength: "190" });
		const $cnt = el("div", { class: "am-cnt" });
		const $save = el("button", { class: "am-go", text: "Save changes" });
		// Floating pill at the bottom of the sheet: appears as soon as anything changed, so saving is hard to miss.
		const $pillBtn = el("button", { text: "Save" });
		const $pill = el("div", { class: "am-savepill" }, el("span", { text: "Save your changes" }), $pillBtn);
		const busy = {}; // "avatar" / "banner" while that picture is being processed
		let saving = false;
		// Public / private choice. Only shown when the server reports one (it needs migration 012).
		const $vis = el("div");
		const paintVis = () => {
			if (!cur.visibility) return this.put($vis);
			this.put(
				$vis,
				el("div", { class: "am-fl", text: "Profile privacy" }),
				this.visPicker(draft.visibility || cur.visibility, (v) => {
					draft.visibility = v;
					syncDirty();
				}),
			);
		};
		$name.value = cur.name;
		$about.value = cur.about;
		const val = (k) => (draft[k] !== undefined ? draft[k] : cur[k]);
		// Everything that differs from what is saved right now.
		const changes = () => {
			const body = {};
			const name = $name.value.trim();
			const about = $about.value.trim();
			if (name !== cur.name) body.name = name;
			if (about !== cur.about.trim()) body.about = about;
			if (draft.avatar !== undefined) body.avatar = draft.avatar;
			if (draft.banner !== undefined) body.banner = draft.banner;
			if (draft.decoration !== undefined && draft.decoration !== cur.decoration) body.decoration = draft.decoration;
			if (draft.visibility && draft.visibility !== cur.visibility) body.visibility = draft.visibility;
			return body;
		};
		const syncDirty = () => {
			const working = Object.values(busy).some(Boolean);
			$pill.classList.toggle("show", Object.keys(changes()).length > 0);
			$pillBtn.disabled = working || saving;
			if (saving) $pillBtn.replaceChildren(this.spinner("sm"), "Saving…");
			else $pillBtn.textContent = working ? "Processing…" : "Save";
		};
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
		const pick = (k, w, h, limit, gifKind) => {
			if (busy[k]) return; // already working on one
			$err.textContent = "";
			this.pickImage(
				w,
				h,
				limit,
				(d, e) => {
					busy[k] = false;
					if (e) {
						$err.textContent = e;
						media();
						return;
					}
					draft[k] = d;
					media();
				},
				gifKind,
				(on) => {
					busy[k] = !!on;
					media();
				},
			);
		};
		const pickAvatar = () => pick("avatar", 256, 256, 110000, "avatar");
		const pickBanner = () => pick("banner", 960, 320, 270000, "banner");
		const media = () => {
			const banner = val("banner");
			const avatar = draft.avatar === null ? acodeAvatar : val("avatar");
			const deco = val("decoration");
			const who = { name: $name.value.trim() || cur.name, avatar_url: avatar };
			const loading = () => el("div", { class: "am-ed-load" }, this.spinner());
			this.put($ban, banner ? img(banner) : null, el("div", { class: "am-ed-cam b" }, this.ico("image", 16)), busy.banner ? loading() : null);
			this.put($av, this.avatar({ ...who, avatar_decoration: deco }, 90), el("div", { class: "am-ed-cam" }, this.ico("image", 16)), busy.avatar ? loading() : null);
			this.put($decos, ...this.decoTiles(who, deco, (d) => {
				draft.decoration = d;
				media();
			}));
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
			syncDirty();
		};
		$ban.onclick = pickBanner;
		$av.onclick = pickAvatar;
		$name.addEventListener("input", () => (!val("avatar") ? media() : syncDirty()));
		$about.addEventListener("input", () => {
			touched.about = true;
			count();
			syncDirty();
		});
		const save = async () => {
			if (saving || Object.values(busy).some(Boolean)) return; // a picture is still being processed
			const body = changes();
			if (!Object.keys(body).length) {
				this.closeSheet();
				return;
			}
			saving = true;
			$save.disabled = true;
			$save.textContent = "Saving…";
			$err.textContent = "";
			syncDirty();
			try {
				const { user: nu } = await this.api("me", { method: "POST", body: JSON.stringify(body) });
				this.applyMe(nu);
				$pill.classList.remove("show");
				this.closeSheet();
				this.paintHome();
				this.refreshHome();
				this.profile(this.me, true);
			} catch (e) {
				$err.textContent = /HTTP 404/.test(e.message) ? "Your server doesn't support profile editing yet. Update acode-messages-server first." : e.message;
				$save.disabled = false;
				$save.textContent = "Save changes";
				saving = false;
				syncDirty();
			}
		};
		$save.onclick = save;
		$pillBtn.onclick = save;
		media();
		count();
		paintVis();
		const gifNote = `GIFs work too: up to ${Math.round(GIF_LIMITS.avatar.bytes / 1000)} KB for a picture, ${Math.round(GIF_LIMITS.banner.bytes / 1000)} KB for a banner, and ${GIF_LIMITS.maxMs / 1000} seconds long.`;
		this.openSheet(true, "", [
			$ban,
			$av,
			$acts,
			el("div", { class: "am-sub", style: "margin:10px 18px 0", text: gifNote }),
			el("div", { class: "am-fl", text: "Avatar decoration" }),
			$decos,
			el("div", { class: "am-fl", text: "Display name" }),
			$name,
			el("div", { class: "am-sub", style: "margin:4px 18px 0", text: "Leave empty to use your Acode account name." }),
			el("div", { class: "am-fl", text: "About me" }),
			$about,
			$cnt,
			$vis,
			$err,
			$save,
			el("div", { class: "am-savebar" }, $pill),
		]);
		// Opened from settings with nothing loaded yet: fetch the saved values in the background.
		if (!info0) {
			this.api(`profile?user=${id}`, { cache: "no-store" })
				.then((d) => {
					ls.set(`am-prof:${id}`, d);
					if (d.user?.visibility && !cur.visibility) {
						cur.visibility = d.user.visibility;
						paintVis();
					}
					if (!touched.about && d.user?.about != null) {
						cur.about = String(d.user.about);
						$about.value = cur.about;
						count();
					}
					if (draft.banner === undefined) cur.banner = d.user?.banner || null;
					if (draft.decoration === undefined) cur.decoration = d.user?.avatar_decoration || null; // the server leaves it out when there is none
					if (draft.banner === undefined || draft.decoration === undefined) media();
					syncDirty();
				})
				.catch(() => {});
		}
	}
}
