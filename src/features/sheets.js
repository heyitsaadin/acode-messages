export class SheetsMethods {
	/* ---------- sheets & dialogs ---------- */

	sheet(title, ...nodes) {
		this.openSheet(false, title, nodes);
	}

	openSheet(tall, title, nodes) {
		if (!this.$sheet) return;
		// Nothing may pop open by itself in the first instant after the page appears.
		if (Date.now() - (this.openedAt || 0) < 700) return;
		this.pfsPage = null; // a settings page sets this again right after it opens
		this.sheetSeq = (this.sheetSeq || 0) + 1;
		this.sheetAt = Date.now();
		const was = this.$sheet.classList.contains("open");
		const $x = tall ? this.el("div", { class: "am-sx" }, this.el("button", { class: "am-btn", onclick: () => this.closeSheet() }, this.ico("close", 22))) : null;
		this.put(this.$sheet, $x, title ? this.el("h3", { text: title, class: tall ? "am-th" : "" }) : null, ...nodes);
		this.$sheet.classList.toggle("tall", !!tall);
		this.$sheet.dataset.vp = "";
		this.$sheet.scrollTop = 0;
		this.$scrim.classList.toggle("strong", !!tall);
		clearTimeout(this.enterT);
		this.$sheet.classList.toggle("enter", !!tall && !was);
		if (tall && !was) this.enterT = setTimeout(() => this.$sheet?.classList.remove("enter"), 1100);
		this.$sheet.classList.add("open");
		this.$scrim.classList.add("show");
		if (was) {
			this.$sheet.classList.remove("swap");
			void this.$sheet.offsetWidth;
			this.$sheet.classList.add("swap");
			clearTimeout(this.swapT);
			this.swapT = setTimeout(() => this.$sheet?.classList.remove("swap"), 260);
		}
	}

	// Pull the tall sheets (profile etc.) down from the top to close them. The sheet follows the finger,
	// the backdrop fades with it, and letting go either flings it away or springs it back.
	bindSheetSwipe() {
		const $s = this.$sheet;
		let armed = false;
		let drag = false;
		let x0 = 0;
		let y0 = 0;
		let dy = 0;
		let lastY = 0;
		let lastT = 0;
		let v = 0;
		$s.addEventListener("touchstart", (e) => {
			armed = false;
			drag = false;
			if (e.touches.length !== 1 || !$s.classList.contains("tall") || !$s.classList.contains("open") || $s.scrollTop > 0) return;
			if (e.target.closest?.("input,textarea,select")) return;
			armed = true;
			x0 = e.touches[0].clientX;
			y0 = lastY = e.touches[0].clientY;
			lastT = e.timeStamp;
			dy = 0;
			v = 0;
		}, { passive: true });
		$s.addEventListener("touchmove", (e) => {
			if (!armed) return;
			const t = e.touches[0];
			if (!drag) {
				const mx = t.clientX - x0;
				const my = t.clientY - y0;
				if ($s.scrollTop > 0 || my < -4) {
					armed = false;
					return;
				}
				if (my < 8 || my < Math.abs(mx)) return;
				drag = true;
				y0 = t.clientY;
				clearTimeout(this.enterT);
				$s.classList.remove("enter");
				$s.style.transition = "none";
				this.$scrim.style.transition = "none";
			}
			e.preventDefault();
			dy = Math.max(0, t.clientY - y0);
			const dt = e.timeStamp - lastT;
			if (dt > 0) v = 0.8 * v + 0.2 * ((t.clientY - lastY) / dt);
			lastY = t.clientY;
			lastT = e.timeStamp;
			$s.style.transform = `translateY(${dy}px)`;
			this.$scrim.style.opacity = String(Math.max(0, 1 - dy / ($s.offsetHeight * 0.85)));
		}, { passive: false });
		const end = (cancel) => {
			const was = drag;
			armed = false;
			drag = false;
			if (!was) return;
			const close = !cancel && (dy > 110 || v > 0.6);
			$s.style.transition = "";
			this.$scrim.style.transition = "";
			void $s.offsetWidth;
			if (close) this.closeSheet();
			$s.style.transform = "";
			this.$scrim.style.opacity = "";
		};
		$s.addEventListener("touchend", () => end(false));
		$s.addEventListener("touchcancel", () => end(true));
	}

	closeSheet() {
		this.pfsPage = null;
		this.$sheet?.classList.remove("open");
		if (this.$sheet) this.$sheet.dataset.vp = "";
		this.$scrim?.classList.remove("show");
	}

	item(icon, text, onclick, cls = "", sub = "") {
		return this.el("div", { class: `am-it ${cls}`, onclick }, this.ico(icon, 22), this.el("div", {}, this.el("span", { text }), sub ? this.el("small", { text: sub }) : null));
	}

	// A row that copies text and says so inline ("Copied ✓") instead of popping up.
	copyItem(icon, text, value) {
		const $it = this.item(icon, text, async () => {
			await this.copy(value);
			const $s = $it.querySelector("small") || $it.lastChild.appendChild(document.createElement("small"));
			$s.textContent = "Copied ✓";
		}, "", "Tap to copy and share it");
		return $it;
	}

	groupForm(kind) {
		const create = kind === "create";
		const $in = this.el("input", { class: "am-inp", placeholder: create ? "Group name" : "Invite link or code", maxlength: create ? "40" : "200", autocapitalize: "off" });
		const who = this.state.user?.name;
		if (create && who) $in.value = `${who}'s group`.slice(0, 40);
		const $go = this.el("button", { class: "am-go", text: create ? "Create group" : "Join group" });
		const $e = this.el("div", { class: "am-ferr" });
		const go = async () => {
			const v = $in.value.trim();
			if (!v) return;
			$go.disabled = true;
			$e.textContent = "";
			try {
				await this.joinAndOpen(create ? { action: "create", name: v } : { action: "join", code: v });
			} catch (e) {
				$e.textContent = e.message;
				$go.disabled = false;
			}
		};
		$go.onclick = go;
		$in.addEventListener("keydown", (e) => e.key === "Enter" && go());
		this.sheet(create ? "Create a group" : "Join a group", $in, $e, $go);
		setTimeout(() => {
			$in.focus();
			if (create) $in.select();
		}, 250);
	}
}
