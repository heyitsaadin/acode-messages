import { ID, ICON_CLASS } from "../constants.js";
import { ICON_URI } from "../icons.js";
import { ls } from "../util.js";
import CSS from "../styles.css";

export class LauncherMethods {
	// Failures only, inline inside the chat UI. Nothing pops up for normal actions.
	flash(msg) {
		if (!this.$err) return;
		clearTimeout(this.flashT);
		this.$err.textContent = msg;
		this.$err.classList.add("show");
		this.flashT = setTimeout(() => this.$err?.classList.remove("show"), 3500);
	}

	alertError(msg) {
		try {
			const alertBox = acode.require("alert");
			if (typeof alertBox === "function") return alertBox("Acode Messages", msg);
		} catch {}
		console.error("Acode Messages:", msg);
	}

	async launch() {
		try {
			await this.open();
		} catch (e) {
			this.alertError(`Acode Messages error: ${e?.message || e}`);
		}
	}

	mountStockButton(onclick) {
		const header = window.editorManager?.header || document.querySelector("header");
		if (!header || header.querySelector("[data-acode-messages]")) return;
		const $b = document.createElement("span");
		$b.className = `icon ${ICON_CLASS}`;
		$b.style.cssText = "font-size:1.2em;pointer-events:auto;cursor:pointer;";
		$b.setAttribute("data-acode-messages", "1");
		let last = 0;
		const handler = (e) => {
			if (e.type === "touchend" && e.cancelable) e.preventDefault();
			e.stopPropagation();
			if (Date.now() - last < 400) return;
			last = Date.now();
			onclick();
		};
		$b.addEventListener("click", handler, true);
		$b.addEventListener("touchend", handler, true);
		header.insertBefore($b, header.lastChild);
		this.cleanups.push(() => $b.remove());
	}

	// Fallback entry point: a side-panel app (the icon strip next to Files / Search / Plugins).
	// Tapping its icon shows one button that opens the full Acode Messages page.
	mountSidebarFallback() {
		if (this.sidebarMounted) return;
		const onclick = () => this.launch();
		try {
			const sidebarApps = acode.require("sidebarApps");
			if (!sidebarApps || typeof sidebarApps.add !== "function") throw new Error("sidebarApps unavailable");
			const SID = "acode-messages";
			sidebarApps.add(
				ICON_CLASS,
				SID,
				"Acode Messages",
				(container) => {
					const $c = container?.el || container;
					if (!$c) return;
					$c.innerHTML = "";
					const $wrap = document.createElement("div");
					$wrap.style.cssText = "padding:16px;display:flex;flex-direction:column;gap:12px;";
					const $t = document.createElement("div");
					$t.textContent = "Chat with other Acode users.";
					$t.style.cssText = "opacity:.75;font-size:.9em;";
					const $b = document.createElement("button");
					$b.textContent = "Open Acode Messages";
					$b.style.cssText = "padding:12px 16px;border:0;border-radius:8px;font-size:1em;cursor:pointer;background:var(--active-color,#5865f2);color:var(--active-text-color,#fff);";
					$b.addEventListener("click", onclick);
					$wrap.append($t, $b);
					$c.append($wrap);
				},
				false,
				// Opening the panel tab itself launches the page, so it's one tap.
				() => onclick(),
			);
			this.sidebarMounted = true;
			this.cleanups.push(() => {
				try {
					sidebarApps.remove?.(SID);
				} catch {}
				this.sidebarMounted = false;
			});
		} catch (e) {
			console.warn("Acode Messages: sidebar fallback failed", e);
			this.mountStockButton(onclick); // last resort: inject into the header by hand
		}
	}

	async init(baseUrl) {
		this.pluginBaseUrl = String(baseUrl || "").endsWith("/") ? String(baseUrl) : `${baseUrl || ""}/`;
		window.acodeMessages = this;
		this.cleanups = [];
		try {
			acode.addIcon(ICON_CLASS, ICON_URI, { monochrome: true });
		} catch {}
		this.$style = document.createElement("style");
		this.$style.textContent = CSS;
		document.head.append(this.$style);

		// 1) Header button (needs the new acode.addHeaderButton from the Acode dev PR).
		//    If it is missing, throws, or the button never shows up, the sidebar panel takes over.
		const onclick = () => this.launch();
		let headerOk = false;
		try {
			if (typeof acode.addHeaderButton === "function") {
				const rm = acode.addHeaderButton({ id: ID, icon: ICON_CLASS, label: "Acode Messages", order: -10, onclick, action: onclick });
				this.cleanups.push(typeof rm === "function" ? rm : () => {});
				headerOk = true;
			}
		} catch (e) {
			console.warn("Acode Messages: addHeaderButton failed", e);
		}
		if (!headerOk) this.mountSidebarFallback();

		// Quiet self-check: the call may "succeed" yet render nothing. If so, use the sidebar.
		setTimeout(() => {
			const $el = document.querySelector(`[data-header-button="${ID}"], [data-acode-messages]`);
			if (!$el?.isConnected) return this.mountSidebarFallback();
			if ($el.dataset.amBound) return;
			$el.dataset.amBound = "1";
			let last = 0;
			const fire = (e) => {
				if (e.type === "touchend" && e.cancelable) e.preventDefault();
				if (Date.now() - last < 600) return;
				last = Date.now();
				e.stopImmediatePropagation?.();
				onclick();
			};
			$el.addEventListener("click", fire, true);
			$el.addEventListener("pointerup", fire, true);
			$el.addEventListener("touchend", fire, true);
		}, 2500);

		// 2) Command palette entry.
		try {
			const commands = acode.require("commands");
			commands?.addCommand?.({ name: "acode-messages-open", description: "Open Acode Messages", exec: () => this.launch() });
			this.cleanups.push(() => commands?.removeCommand?.("acode-messages-open"));
		} catch {}

		this.initCodeShare();
		this.warm();
	}

	async destroy() {
		clearTimeout(this.warmT);
		this.close();
		this.cleanups?.forEach((f) => {
			try {
				f();
			} catch {}
		});
		this.$style?.remove();
	}

	// Quietly fetch the home screen a moment after startup so the first open is already filled in.
	warm() {
		this.warmT = setTimeout(async () => {
			const u = this.cachedUser();
			if (!u || this.$page) return;
			try {
				this.state.user = this.state.user || u;
				const { me, ...home } = await this.api("home");
				ls.set("am-home", { uid: u.id, home, at: Date.now() });
				this.pushShare(false).catch(() => {});
			} catch {}
		}, 2000);
	}
}
