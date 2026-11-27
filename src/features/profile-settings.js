import { DEFAULT_API } from "../constants.js";
import { ls } from "../util.js";

// Where "back" goes from each page. "profile" is the profile sheet the pill lives on.
const UP = { main: "profile", shop: "profile", account: "main", name: "account", appearance: "main", sounds: "main", advanced: "main" };
const TITLE = { main: "Settings", shop: "Shop", account: "Account", name: "Display name", appearance: "Appearance", sounds: "Sounds", advanced: "Advanced" };

export class ProfileSettingsMethods {
	/* ---------- Shop / Settings pill and the settings pages ---------- */

	// The floating pill at the bottom of your own profile, like Discord's.
	pfsDock() {
		const el = this.el.bind(this);
		const tab = (icon, label, go) => el("button", { class: "am-dk", onclick: go }, this.ico(icon, 24), el("span", { text: label }));
		return el("div", { class: "am-dockw" }, el("div", { class: "am-dock" }, tab("shop", "Shop", () => this.pfsOpen("shop")), tab("gear", "Settings", () => this.pfsOpen("main"))));
	}

	// Every settings page is the tall sheet again with new content, so moving between them feels like one place.
	pfsOpen(page = "main") {
		const pages = {
			main: () => this.pfsMain(),
			account: () => this.pfsAccount(),
			name: () => this.pfsName(),
			appearance: () => this.pfsAppearance(),
			sounds: () => this.pfsSounds(),
			advanced: () => this.pfsAdvanced(),
			shop: () => this.pfsShop(),
		};
		const key = pages[page] ? page : "main";
		this.openSheet(true, "", [this.pfsHead(key), ...pages[key]()]);
		this.pfsPage = key; // openSheet clears this, so it is set after
	}

	// One step back: sub-pages go to their parent, the first page goes back to the profile. False when no page is open.
	pfsBack() {
		const up = UP[this.pfsPage];
		if (!up) return false;
		if (up === "profile") this.profile(this.me, true);
		else this.pfsOpen(up);
		return true;
	}

	pfsHead(page) {
		return this.el("div", { class: "am-sth" }, this.el("button", { class: "am-btn", "aria-label": "Back", onclick: () => this.pfsBack() }, this.ico("back", 24)), this.el("h3", { text: TITLE[page] || "Settings" }));
	}

	pfsLabel(text) {
		return this.el("div", { class: "am-slbl", text });
	}

	pfsGroup(...rows) {
		return this.el("div", { class: "am-sgrp" }, ...rows);
	}

	pfsNote(text) {
		return this.el("div", { class: "am-snote", text });
	}

	// One row: optional icon, title, small text under it, a value on the right and an arrow when it opens something.
	pfsRow({ icon, title, sub, value, onclick }) {
		const el = this.el.bind(this);
		return el(
			"div",
			{ class: `am-sr${onclick ? " tap" : ""}`, ...(onclick ? { onclick } : {}) },
			icon ? el("span", { class: "ic" }, this.ico(icon, 20)) : null,
			el("div", { class: "tx" }, el("b", { text: title }), sub ? el("small", { text: sub }) : null),
			value ? el("span", { class: "vl", text: value }) : null,
			onclick ? this.ico("chev", 18) : null,
		);
	}

	pfsSwitch(title, sub, on, change) {
		const el = this.el.bind(this);
		const $sw = el("div", { class: `am-sw${on ? " on" : ""}` });
		let cur = on;
		return el(
			"div",
			{
				class: "am-sr tap",
				onclick: () => {
					cur = !cur;
					$sw.classList.toggle("on", cur);
					change(cur);
				},
			},
			el("div", { class: "tx" }, el("b", { text: title }), el("small", { text: sub })),
			$sw,
		);
	}

	pfsCached() {
		return ls.get(`am-prof:${Number(this.me.id)}`) || null;
	}

	/* ---------- pages ---------- */

	pfsMain() {
		const el = this.el.bind(this);
		const u = this.me;
		const edit = () => this.editProfile(this.pfsCached()?.user);
		return [
			el("div", { class: "am-sme", onclick: edit }, this.avatar(u, 52), el("div", { class: "tx" }, el("b", { text: u.name || "You" }), el("small", { text: "Edit profile" })), this.ico("chev", 18)),
			this.pfsLabel("User settings"),
			this.pfsGroup(
				this.pfsRow({ icon: "user", title: "Account", sub: "Display name, about me and sign-in", onclick: () => this.pfsOpen("account") }),
				this.pfsRow({ icon: "palette", title: "Appearance", sub: "Who can see your profile", onclick: () => this.pfsOpen("appearance") }),
				this.pfsRow({ icon: "bell", title: "Sounds", sub: "Send and receive sounds", onclick: () => this.pfsOpen("sounds") }),
			),
			this.pfsLabel("App"),
			this.pfsGroup(this.pfsRow({ icon: "sliders", title: "Advanced", sub: "Server address", onclick: () => this.pfsOpen("advanced") })),
		];
	}

	pfsAccount() {
		const u = this.me;
		const cached = this.pfsCached()?.user || {};
		const email = ls.get("cached-logged-in-user")?.email;
		const about = String(cached.about ?? ls.get("am-me", {})?.about ?? "").trim();
		const edit = () => this.editProfile(this.pfsCached()?.user);
		const status = [];
		if (cached.first_seen) status.push(this.pfsRow({ title: "Member since", value: new Date(cached.first_seen).toLocaleDateString([], { month: "short", year: "numeric" }) }));
		if (cached.visibility) status.push(this.pfsRow({ title: "Profile", value: cached.visibility === "private" ? "Private" : "Public", onclick: () => this.pfsOpen("appearance") }));
		return [
			this.pfsLabel("Account information"),
			this.pfsGroup(
				this.pfsRow({ title: "Display name", value: u.name || "", onclick: () => this.pfsOpen("name") }),
				this.pfsRow({ title: "About me", value: about || "Not set", onclick: edit }),
				this.pfsRow({ title: "Picture and banner", onclick: edit }),
				email ? this.pfsRow({ title: "Email", value: email }) : null,
			),
			this.pfsLabel("How you sign in"),
			this.pfsGroup(this.pfsRow({ title: "Acode account", value: "Connected" })),
			this.pfsNote("You sign in with your Acode account, so your password and login are managed in Acode (Profile → Login)."),
			status.length ? this.pfsLabel("Account status") : null,
			status.length ? this.pfsGroup(...status) : null,
		];
	}

	pfsName() {
		const el = this.el.bind(this);
		const cur = this.me.name || "";
		const $in = el("input", { class: "am-inp", placeholder: "Display name", maxlength: "32", autocapitalize: "off" });
		$in.value = cur;
		const $err = el("div", { class: "am-ferr" });
		const $go = el("button", { class: "am-go", text: "Save" });
		$go.onclick = async () => {
			const name = $in.value.trim();
			if (name === cur) return this.pfsBack();
			$go.disabled = true;
			$go.textContent = "Saving…";
			$err.textContent = "";
			try {
				const { user: nu } = await this.api("me", { method: "POST", body: JSON.stringify({ name }) });
				this.applyMe(nu);
				this.paintHome();
				this.refreshHome();
				this.pfsOpen("account");
			} catch (e) {
				$err.textContent = /HTTP 404/.test(e.message) ? "Your server doesn't support profile editing yet. Update acode-messages-server first." : e.message;
				$go.disabled = false;
				$go.textContent = "Save";
			}
		};
		$in.addEventListener("keydown", (e) => e.key === "Enter" && $go.click());
		return [el("div", { class: "am-fl", text: "Display name" }), $in, el("div", { class: "am-sub", style: "margin:4px 18px 0", text: "Leave empty to use your Acode account name." }), $err, $go];
	}

	// "Who can see your profile" lives here now (it used to be a card on the profile).
	pfsAppearance() {
		const el = this.el.bind(this);
		const id = Number(this.me.id);
		const $box = el("div");
		const paint = (data) => {
			const cur = data?.user?.visibility;
			if (!cur) {
				this.put($box, el("div", { class: "am-snote", text: "Profile privacy isn't available on your server yet." }));
				return;
			}
			const $err = el("div", { class: "am-ferr", style: "margin:8px 0 0" });
			const $pick = this.visPicker(cur, async (v) => {
				$err.textContent = "";
				try {
					await this.api("me", { method: "POST", body: JSON.stringify({ visibility: v }) });
					data.user.visibility = v;
					ls.set(`am-prof:${id}`, data);
				} catch (e) {
					$pick.set(data.user.visibility);
					$err.textContent = e.message;
				}
			});
			this.put($box, el("div", { class: "am-card" }, el("h4", { text: "Who can see your profile" }), $pick, $err));
		};
		const cached = this.pfsCached();
		if (cached?.user?.visibility) paint(cached);
		else {
			this.put($box, el("div", { class: "am-card" }, this.sk("60%", 14, 6), el("div", { style: "height:10px" }), this.sk("85%", 14, 6)));
			this.api(`profile?user=${id}`, { cache: "no-store" })
				.then((d) => {
					ls.set(`am-prof:${id}`, d);
					if (this.pfsPage === "appearance") paint(d);
				})
				.catch(() => {
					if (this.pfsPage === "appearance") paint(null);
				});
		}
		return [$box];
	}

	pfsSounds() {
		const s = this.settings;
		return [
			this.pfsLabel("Chat sounds"),
			this.pfsGroup(
				this.pfsSwitch("Send sound", "Play a short sound when a message is sent.", s.sendSound !== false, (on) => {
					s.sendSound = on;
					this.appSettings.update();
					if (on) this.playSendSound();
				}),
				this.pfsSwitch("Receive sound", "Play a soft sound when someone else's message arrives in the chat you have open.", s.receiveSound !== false, (on) => {
					s.receiveSound = on;
					this.appSettings.update();
					if (on) {
						this.rxAt = 0;
						this.primeSound();
						setTimeout(() => this.playReceiveSound(), 150); // the audio needs a moment to wake up after the tap
					}
				}),
			),
		];
	}

	pfsAdvanced() {
		const el = this.el.bind(this);
		const $in = el("input", { class: "am-inp", placeholder: DEFAULT_API, autocapitalize: "off", inputmode: "url", maxlength: "200" });
		$in.value = this.settings.apiUrl || DEFAULT_API;
		const $err = el("div", { class: "am-ferr" });
		const save = (raw) => {
			const v = String(raw || "").trim().replace(/\/+$/, "");
			if (v && !/^https?:\/\/\S+$/i.test(v)) {
				$err.textContent = "Enter a full address that starts with http:// or https://";
				return;
			}
			$err.textContent = "";
			this.settings.apiUrl = v || DEFAULT_API;
			this.appSettings.update();
			$in.value = this.settings.apiUrl;
			this.flash("Saved. Reopen Acode Messages to use it.");
		};
		return [
			this.pfsLabel("Server address"),
			$in,
			$err,
			el("button", { class: "am-go", text: "Save", onclick: () => save($in.value) }),
			el("button", { class: "am-go alt", text: "Use the default server", onclick: () => save("") }),
			this.pfsNote("Only change this if you run your own server."),
		];
	}

	// Placeholder until shops exist.
	pfsShop() {
		const el = this.el.bind(this);
		return [el("div", { class: "am-empty" }, el("span", { class: "ring" }, this.ico("shop", 40)), el("b", { text: "Shop" }), el("span", { class: "t", text: "The shop isn't open yet. Check back soon." }))];
	}
}
