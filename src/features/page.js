import { ID, HOME_MS, ICON_CLASS } from "../constants.js";
import { ls } from "../util.js";
import CSS from "../styles.css";

export class PageMethods {
	/* ---------- page lifecycle ---------- */

	async open() {
		// Already open as a tab: just bring it to the front.
		if (this.tab) {
			try {
				this.tab.makeActive();
				return;
			} catch {
				this.close(true);
			}
		}
		if (this.$page?.isConnected) return;
		if (this.$page) this.close(true);
		try {
			this.build();
		} catch (e) {
			this.close(true);
			this.alertError(`Could not open chat: ${e.message || e}`);
			return;
		}
		await this.start();
	}

	build() {
		this.view = "home";
		const el = this.el.bind(this);

		// home: [rail | panel] on top, one full-width profile bar underneath
		this.$rail = el("div", { class: "am-rail" });
		this.$ph = el("div", { class: "am-ph" });
		this.$plist = el("div", { class: "am-plist" });
		this.$me = el("div", { class: "am-foot" });
		this.$vchip = el("div", { class: "am-vchip", onclick: () => this.voice && this.openChannel(this.voice.channel) }, this.ico("headset", 20), el("b", { text: "" }), this.ico("chev", 18));
		const home = el("div", { class: "am-home" }, el("div", { class: "am-hbody" }, this.$rail, el("div", { class: "am-panel" }, this.$ph, this.$plist)), this.$me, this.$vchip);

		// chat
		this.$chead = el("div", { class: "am-chead" });
		this.$list = el("div", { class: "am-list" });
		this.$emo = el("div", { class: "am-emo" });
		this.emoBuild();
		this.$ta = el("textarea", { rows: "1", placeholder: "Message" });
		this.$ta.addEventListener("input", () => {
			this.$ta.style.height = "48px";
			this.$ta.style.height = `${Math.min(this.$ta.scrollHeight, 112)}px`;
			this.syncFab();
			this.suggest();
		});
		this.$ta.addEventListener("keyup", (e) => {
			if (e.key && e.key.startsWith("Arrow")) this.suggest();
		});
		this.$ta.addEventListener("click", () => this.suggest());
		this.$ta.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
				e.preventDefault();
				this.send();
			}
		});
		this.bindRows();
		this.$emoBtn = el("button", { class: "am-btn", onclick: () => this.emoToggle() }, this.ico("smile", 24));
		this.$plus = el("button", { class: "am-btn am-plus", onclick: () => this.plusMenu() }, this.ico("plus", 26));
		this.$send = el("button", { class: "am-send", onclick: () => this.send() }, this.ico("send", 20));
		// Tapping the button would take focus from the message box and close the keyboard. Stop that at the
		// press, so the box keeps focus and you can type the next message straight away.
		const keepFocus = (e) => e.preventDefault();
		this.$send.addEventListener("pointerdown", keepFocus);
		this.$send.addEventListener("mousedown", keepFocus);
		this.$send.addEventListener("touchstart", (e) => {
			if (e.cancelable && this.$ta.getRootNode().activeElement === this.$ta) {
				// keep focus, but still let the tap become a click
				this.kbOpen = true;
			}
		}, { passive: true });
		this.$send.addEventListener("click", () => {
			// backup for webviews that move focus anyway: if the keyboard was open, put the cursor back
			if (this.kbOpen) {
				this.kbOpen = false;
				if (this.$ta.getRootNode().activeElement !== this.$ta) this.$ta.focus({ preventScroll: true });
			}
		});
		this.$mic = el("button", { class: "am-btn am-mic", onclick: () => this.recStart() }, this.ico("mic", 24));
		this.$recT = el("span", { class: "tm", text: "0:00" });
		this.$rec = el(
			"div",
			{ class: "am-rec" },
			el("span", { class: "dot" }),
			this.$recT,
			el("button", { class: "am-btn", onclick: () => this.recStop(false) }, this.ico("trash", 22)),
			el("button", { class: "am-rsend", onclick: () => this.recStop(true) }, this.ico("send", 20)),
		);
		this.$bar = el("div", { class: "am-bar" }, el("div", { class: "am-pill" }, this.$plus, this.$ta, this.$emoBtn, this.$mic, this.$send), this.$rec);
		this.$pend = el("div", { class: "am-pend" });
		this.$ctx = el("div", { class: "am-ctx" });
		this.$vbar = el("div", { class: "am-vbar", onclick: () => this.voicePanel() }, el("span", { class: "am-pdot" }), el("b", { text: "" }), this.ico("chev", 18));
		this.syncFab();
		this.$sug = el("div", { class: "am-sug" });
		const chat = el("div", { class: "am-chat" }, this.$chead, this.$vbar, this.$list, this.$pend, this.$ctx, this.$sug, this.$bar, this.$emo);

		// overlay sheet + inline error strip
		// A sheet ignores taps on its backdrop for a moment, so the tap that opened it can't close it again.
		this.$scrim = el("div", { class: "am-scrim", onclick: () => Date.now() - (this.sheetAt || 0) > 350 && this.closeSheet() });
		this.$sheet = el("div", { class: "am-sheet" });
		this.bindSheetSwipe();
		this.$err = el("div", { class: "am-err", onclick: () => this.$err.classList.remove("show") });

		this.$shield = el("div", { class: "am-shield" });
		const swallow = (e) => {
			e.preventDefault?.();
			e.stopPropagation();
		};
		for (const t of ["click", "touchstart", "touchend", "pointerdown", "pointerup", "mousedown", "mouseup"]) this.$shield.addEventListener(t, swallow);
		this.openedAt = Date.now();
		this.shieldT = setTimeout(() => {
			this.$shield?.remove();
			this.$shield = null;
		}, 700);
		this.$root = el("div", { class: "am-root" }, home, chat, this.$scrim, this.$sheet, this.$err, this.$shield);
		// Audio can only start after a tap, so any tap in the chat gets the sounds ready.
		this.$root.addEventListener("touchend", () => this.primeSound(), { passive: true });
		this.$root.addEventListener("click", () => this.primeSound(), { passive: true });

		// Preferred: a tab in Acode's own tab bar, like the Welcome tab. Older Acode builds
		// without custom tabs get the old full-screen page instead.
		if (!this.mountTab()) this.mountPage();
		this.pushBack();
	}

	// Opens the chat as an editor tab. Returns false if this Acode has no custom tabs.
	mountTab() {
		let EditorFile;
		try {
			EditorFile = acode.require("EditorFile");
		} catch {}
		if (typeof EditorFile !== "function" || typeof EditorFile.prototype?.addStyle !== "function") return false;
		let tab;
		try {
			this.$root.classList.add("tab");
			// The tab content lives in a shadow root, so the page CSS has to be handed to the tab itself.
			// (A leading newline keeps the string from being mistaken for a stylesheet URL.)
			tab = new EditorFile("Acode Messages", {
				type: "page",
				content: this.$root,
				tabIcon: `icon ${ICON_CLASS}`,
				stylesheets: [`\n${CSS}`],
				hideQuickTools: true,
				persistInSession: false,
				render: true,
			});
		} catch (e) {
			console.warn("Acode Messages: could not open a tab, using a full page", e);
			this.$root.classList.remove("tab");
			return false;
		}
		tab.setCustomTitle?.(() => "Chat");
		tab.on("close", () => {
			if (this.tab === tab) this.close(true);
		});
		// Only grab the back button while the chat tab is the one on screen.
		tab.on("focus", () => {
			if (this.tab === tab) this.pushBack();
		});
		tab.on("blur", () => {
			if (this.tab === tab) this.actionStack?.remove?.(ID);
		});
		this.tab = tab;
		this.$page = tab;
		return true;
	}

	// Fallback for Acode versions without custom tabs: a full-screen page.
	mountPage() {
		const $page = this.Page("Acode Messages");
		this.$page = $page;
		if (typeof $page.appendBody === "function") $page.appendBody(this.$root);
		else $page.body = this.$root;
		app.append($page);

		// We draw our own headers, so hide the stock page header and fill the screen.
		const hdr = $page.querySelector("header");
		if (hdr) hdr.style.display = "none";
		this.$root.style.setProperty("--am-top", "0px");

		$page.onhide = () => this.close(true);
	}

	pushBack() {
		this.actionStack?.remove?.(ID);
		this.actionStack?.push({ id: ID, action: () => this.onBack() });
	}

	onBack() {
		// The picture cropper is on top of everything: back cancels it.
		if (this.cropCancel) {
			this.cropCancel();
			if (this.$page) this.pushBack();
			return;
		}
		// The setup screen sits on top of everything: back goes one step back inside it.
		if (this.$ob) {
			this.obBack();
			if (this.$page) this.pushBack();
			return;
		}
		if (this.$sheet?.classList.contains("open")) {
			this.closeSheet();
			this.pushBack();
		} else if (this.view === "chat") {
			this.showHome();
			this.pushBack();
		} else this.close();
	}

	close(fromHide) {
		this.voiceLeave();
		this.recStop(false);
		this.stopVoiceMsg();
		clearTimeout(this.vStatusT);
		clearTimeout(this.pollTimer);
		clearTimeout(this.flashT);
		clearTimeout(this.saveT);
		clearTimeout(this.shieldT);
		clearInterval(this.homeTimer);
		this.pollTimer = this.homeTimer = null;
		const $page = this.$page;
		const tab = this.tab;
		this.$page = null;
		this.tab = null;
		this.$err = null;
		this.$ob = null;
		this.obState = null;
		this.actionStack?.remove?.(ID);
		if (tab) {
			// Closing from inside the chat (X, back): take the tab down. If the user closed the tab itself, it is already going.
			if (!fromHide) {
				try {
					tab.remove(true, { ignorePinned: true });
				} catch {}
			}
		} else if ($page && !fromHide) {
			try {
				if (typeof $page.hide === "function") $page.hide();
				else $page.remove();
			} catch {
				$page.remove();
			}
		}
		this.$root?.remove();
		this.$root = null;
	}

	// Paint from cache first so the screen is never empty, then refresh in the background.
	async start() {
		this.homeSeen = false;
		const cu = this.cachedUser();
		const snap = ls.get("am-home");
		if (cu) {
			this.state.user = cu;
			if (snap?.home && String(snap.uid) === String(cu.id)) {
				this.state.home = { friends: [], requests: [], ...snap.home };
				this.homeSig = JSON.stringify(snap.home);
				this.pickTab(true);
				this.homeSeen = true;
				this.paintHome();
			} else {
				this.paintHomeSkeleton();
				this.paintMe();
			}
			// Refresh name/avatar quietly.
			this.getUser().then((u) => {
				if (u && this.$page && String(u.id) === String(cu.id)) {
					this.state.user = this.withMine({ ...this.state.user, ...u });
					this.paintMe();
				}
			});
		} else {
			this.paintHomeSkeleton();
			this.paintMe();
			const u = await this.getUser();
			if (!this.$page) return;
			if (!u) {
				this.homeNote(`Sign in with your Acode account (Profile → Login) to join the chat.${this.loginError ? ` (${this.loginError})` : ""}`, () => this.start());
				return;
			}
			this.state.user = this.withMine(u);
			this.paintMe();
		}
		// First visit: the server says setup isn't done yet, so show the welcome and profile setup on top.
		this.checkOnboarding();
		await this.loadHome(false);
		this.pushShare(false).catch(() => {});
		clearInterval(this.homeTimer);
		this.homeTimer = setInterval(() => {
			if (document.hidden) return;
			this.loadHome(true);
			this.refreshOnline();
		}, HOME_MS);
	}
}
