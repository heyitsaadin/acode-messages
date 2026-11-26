import { ls } from "../util.js";

const STEPS = 3;

export class OnboardingMethods {
	/* ---------- first-run setup ---------- */

	// New people get a short setup before they use the chat: name, picture, banner and public or private.
	// The server remembers who has finished, so this is one request and then never again. People who had an
	// account before this existed are marked as finished by the server's migration and never see it.
	async checkOnboarding() {
		const id = Number(this.me.id);
		if (!id || this.$ob || ls.get(`am-ob:${id}`)) return;
		let d;
		try {
			d = await this.api(`profile?user=${id}`, { cache: "no-store" });
		} catch {
			return;
		}
		if (!this.$root || this.$ob) return;
		ls.set(`am-prof:${id}`, d);
		const done = d?.user?.onboarded;
		if (done === true) ls.set(`am-ob:${id}`, true);
		// done missing means an older server that doesn't track setup: leave everything as it was.
		else if (done === false) this.showOnboarding(d);
	}

	showOnboarding(d) {
		if (!this.$root || this.$ob) return;
		const el = this.el.bind(this);
		const id = Number(this.me.id);
		const src = d?.user || {};
		const mine = ls.get("am-me", {}) || {};
		const acodeAvatar = ls.get("cached-logged-in-user")?.avatar_url || null;
		const cur = { name: this.me.name || "", about: String(src.about || ""), avatar: this.me.avatar_url || null, banner: src.banner || null };
		// draft.avatar / draft.banner: undefined = unchanged, null = remove, string = new picture
		const draft = { name: cur.name, about: cur.about, visibility: src.visibility === "private" ? "private" : "public" };
		const s = { step: 0, busy: false, label: "" };
		const $ob = el("div", { class: "am-ob" });
		const $err = el("div", { class: "am-ferr am-ob-err" });
		this.$ob = $ob;
		this.obState = s;
		this.$root.append($ob);

		const feat = (icon, title, text) => el("div", { class: "am-ob-feat" }, el("span", { class: "ic" }, this.ico(icon, 22)), el("div", {}, el("b", { text: title }), el("small", { text })));

		// 1. welcome
		const welcome = () => {
			const first = String(cur.name).trim().split(/\s+/)[0];
			return [
				el("div", { class: "am-ob-hero" }, el("span", { class: "ring" }, this.ico("chat", 40)), el("h2", { text: first ? `Welcome, ${first}` : "Welcome" }), el("p", { text: "Let's set up your profile before you start chatting. It only takes a minute." })),
				feat("user", "Make it yours", "Choose your name, picture and banner."),
				feat("lock", "You decide who sees you", "Keep your profile public, or make it private."),
				feat("users", "Find your people", "Join groups, message friends and hop into voice chat."),
			];
		};

		// 2. name, picture, banner, about me
		const profile = () => {
			const $ban = el("div", { class: "am-ed-ban" });
			const $av = el("div", { class: "am-ed-av" });
			const $acts = el("div", { class: "am-acts" });
			const $pe = el("div", { class: "am-ferr" });
			const $name = el("input", { class: "am-inp", placeholder: "Display name", maxlength: "32", autocapitalize: "off" });
			const $about = el("textarea", { class: "am-inp", placeholder: "Tell people a little about yourself", maxlength: "190" });
			const $cnt = el("div", { class: "am-cnt" });
			$name.value = draft.name;
			$about.value = draft.about;
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
				$pe.textContent = "";
				this.pickImage(w, h, limit, (data, e) => {
					if (e) {
						$pe.textContent = e;
						return;
					}
					draft[k] = data;
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
			$name.addEventListener("input", () => {
				draft.name = $name.value;
				if (!val("avatar")) media();
			});
			$about.addEventListener("input", () => {
				draft.about = $about.value;
				count();
			});
			media();
			count();
			return [
				el("div", { class: "am-ob-title" }, el("h2", { text: "Your profile" }), el("p", { text: "Tap the banner or picture to change them." })),
				el("div", { style: "height:14px" }),
				$ban,
				$av,
				$acts,
				$pe,
				el("div", { class: "am-fl", text: "Display name" }),
				$name,
				el("div", { class: "am-sub", style: "margin:4px 18px 0", text: "Leave empty to use your Acode account name." }),
				el("div", { class: "am-fl", text: "About me" }),
				$about,
				$cnt,
			];
		};

		// 3. public or private
		const privacy = () => {
			const $note = el("div", { class: "am-ob-note" });
			const say = () => {
				$note.textContent =
					draft.visibility === "private"
						? "People can still find you, message you and send friend requests. Your banner, about me and activity stay hidden until you're friends."
						: "Anyone can see your banner, about me and activity. You can switch to private any time.";
			};
			say();
			return [
				el("div", { class: "am-ob-title" }, el("h2", { text: "Who can see your profile?" }), el("p", { text: "Pick one for now. You can change it later in Edit profile." })),
				el("div", { style: "height:8px" }),
				this.visPicker(draft.visibility, (v) => {
					draft.visibility = v;
					say();
				}),
				$note,
			];
		};

		const lock = (on) => {
			s.busy = on;
			$ob.querySelectorAll("button").forEach(($b) => ($b.disabled = on));
			const $g = $ob.querySelector(".am-go");
			if ($g) $g.textContent = on ? "Saving…" : s.label;
		};

		// Saves everything in one request. Skipping only marks setup as done and keeps the defaults.
		const finish = async (skip) => {
			if (s.busy) return;
			const body = { onboarded: true };
			if (!skip) {
				const name = draft.name.trim();
				const about = draft.about.trim();
				if (name !== cur.name) body.name = name;
				if (about !== cur.about.trim()) body.about = about;
				if (draft.avatar !== undefined) body.avatar = draft.avatar;
				if (draft.banner !== undefined) body.banner = draft.banner;
				body.visibility = draft.visibility;
			}
			lock(true);
			$err.textContent = "";
			try {
				const { user: nu } = await this.api("me", { method: "POST", body: JSON.stringify(body) });
				this.applyMe(nu);
				ls.set(`am-ob:${id}`, true);
				this.closeOnboarding();
				this.paintHome();
				this.refreshHome();
			} catch (e) {
				lock(false);
				$err.textContent = e.message;
			}
		};

		const render = () => {
			const st = s.step;
			const last = st === STEPS - 1;
			s.label = st === 0 ? "Get started" : last ? "Finish setup" : "Continue";
			$err.textContent = "";
			const $body = el("div", { class: "am-ob-body in" }, ...[welcome, profile, privacy][st]());
			this.put(
				$ob,
				el(
					"div",
					{ class: "am-ob-top" },
					el("button", { class: `am-btn${st ? "" : " gone"}`, "aria-label": "Back", onclick: () => go(st - 1) }, this.ico("back", 24)),
					el("div", { class: "am-ob-dots" }, ...Array.from({ length: STEPS }, (_, i) => el("i", { class: i === st ? "on" : "" }))),
					el("span", { style: "width:40px;flex-shrink:0" }),
				),
				$body,
				el(
					"div",
					{ class: "am-ob-foot" },
					$err,
					el("button", { class: "am-go", text: s.label, onclick: () => (last ? finish(false) : go(st + 1)) }),
					el("button", { class: "am-ob-sec", text: st === 0 ? "Skip for now" : "Back", onclick: () => (st === 0 ? finish(true) : go(st - 1)) }),
				),
			);
		};
		const go = (n) => {
			if (s.busy) return;
			s.step = Math.max(0, Math.min(STEPS - 1, n));
			render();
		};
		s.go = go;
		render();
	}

	// Back button while the setup is open: one step back, and from the first step close the chat.
	// Setup isn't finished until Finish or Skip, so it comes back the next time.
	obBack() {
		const s = this.obState;
		if (!s || s.busy) return;
		if (s.step > 0) s.go(s.step - 1);
		else this.close();
	}

	closeOnboarding() {
		const $ob = this.$ob;
		this.$ob = null;
		this.obState = null;
		if (!$ob) return;
		$ob.classList.add("out");
		setTimeout(() => $ob.remove(), 280);
	}
}
