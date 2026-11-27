import { ICONS } from "../icons.js";

export class UiHelpersMethods {
	/* ---------- UI helpers ---------- */

	el(tag, props = {}, ...kids) {
		const $e = document.createElement(tag);
		for (const [k, v] of Object.entries(props)) {
			if (k === "class") $e.className = v;
			else if (k === "text") $e.textContent = v;
			else if (k.startsWith("on")) $e[k] = v;
			else $e.setAttribute(k, v);
		}
		$e.append(...kids.filter(Boolean));
		return $e;
	}

	ico(name, size = 22) {
		const $i = document.createElement("span");
		$i.className = "am-i";
		$i.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
		return $i;
	}

	put($e, ...kids) {
		$e?.replaceChildren(...kids.filter(Boolean));
	}

	// Shimmering placeholder block.
	sk(w, h, r = 8) {
		const $s = document.createElement("div");
		$s.className = "am-sk";
		$s.style.cssText = `width:${typeof w === "number" ? `${w}px` : w};height:${h}px;border-radius:${r}px;flex-shrink:0`;
		return $s;
	}

	hue(s) {
		let h = 0;
		for (const c of String(s || "")) h = (h * 31 + c.charCodeAt(0)) % 360;
		return h;
	}

	initial(s) {
		return ([...String(s || "?").trim()][0] || "?").toUpperCase();
	}

	avatar(u, size) {
		const $a = this.el("div", { class: "am-av", text: this.initial(u.name) });
		$a.style.background = `hsl(${this.hue(u.name)} 42% 40%)`;
		if (size) {
			$a.style.width = $a.style.height = `${size}px`;
			$a.style.fontSize = `${Math.round(size * 0.4)}px`;
		}
		if (u.avatar_url) {
			const $i = document.createElement("img");
			$i.onerror = () => $i.remove();
			$i.src = this.bannerSrc(u.avatar_url);
			$a.append($i);
		}
		// A decoration is only a data attribute; styles.css draws it. Tiny avatars (reply previews) stay plain.
		if (u.avatar_decoration && /^[a-z]{2,12}$/.test(u.avatar_decoration) && (!size || size >= 24)) {
			$a.dataset.deco = u.avatar_decoration;
			// Particles orbit OUTSIDE the portrait edge; keep the image itself unobstructed.
			const particleCount = u.avatar_decoration === "sakura" ? 8 :
				["aurora", "galaxy", "electric", "ember", "fire", "frost", "rainbow"].includes(u.avatar_decoration) ? 6 : 4;
			const avatarRadius = (size || 40) / 2;
			for (let n = 0; n < particleCount; n++) {
				const angle = (Math.PI * 2 * n) / particleCount - Math.PI / 2;
				const radius = avatarRadius + (u.avatar_decoration === "sakura" ? 9 : 7) + (n % 2) * 3;
				const $particle = this.el("i", { class: "am-deco-particle", "aria-hidden": "true" });
				$particle.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
				$particle.style.top = `calc(50% + ${Math.sin(angle) * radius}px)`;
				$particle.style.setProperty("--particle-delay", `${-(n * 0.43)}s`);
				$particle.style.setProperty("--particle-drift", `${n % 2 ? 5 : -5}px`);
				$a.append($particle);
			}
			// Sakura petals also start beyond the avatar edge and drift down past the frame.
			if (u.avatar_decoration === "sakura") {
				const drift = [-10, -6, 6, 10, 12, -12, 4, -4];
				for (let n = 0; n < drift.length; n++) {
					const angle = (Math.PI * 2 * n) / drift.length - Math.PI / 2;
					const radius = avatarRadius + 10 + (n % 3) * 2;
					const $petal = this.el("i", { class: "am-sakura-petal", "aria-hidden": "true" });
					$petal.style.left = `calc(50% + ${Math.cos(angle) * radius}px)`;
					$petal.style.top = `calc(50% + ${Math.sin(angle) * radius}px)`;
					$petal.style.setProperty("--petal-x", `${drift[n]}px`);
					$a.append($petal);
				}
			}
		}
		return $a;
	}

	// Avatar with the green/grey presence dot.
	avw(u, size, online) {
		return this.el("div", { class: "am-avw" }, this.avatar(u, size), online === undefined ? null : this.el("span", { class: `am-on${online ? "" : " off"}` }));
	}

	// Acode's blue rosette verification mark, rendered as a crisp inline SVG.
	verifiedMark() {
		const $mark = this.el("img", {
			class: "am-verified-mark",
			src: `${this.pluginBaseUrl}project/acode-verified.png`,
			alt: "Acode verified",
			title: "Acode verified",
		});
		return $mark;
	}

	pluginAdminMark() {
		return this.el("span", { class: "am-badge plugin-admin", text: "Plugin Admin", title: "Acode Messages plugin administrator" });
	}

	badges(u) {
		const out = [];
		if (u.verified || u.is_plugin_admin) out.push(this.verifiedMark()); // the plugin owner always gets the rosette
		if (u.is_plugin_admin) out.push(this.pluginAdminMark());
		if (u.acode_pro) out.push(this.el("span", { class: "am-badge pro", text: "PRO" }));
		if (u.is_admin) out.push(this.el("span", { class: "am-badge admin", text: "Acode Administrator", title: "Acode platform administrator" }));
		return out;
	}

	async copy(text) {
		try {
			if (window.cordova?.plugins?.clipboard?.copy) window.cordova.plugins.clipboard.copy(text);
			else await navigator.clipboard.writeText(text);
		} catch {
			const t = document.createElement("textarea");
			t.value = text;
			document.body.append(t);
			t.select();
			try {
				document.execCommand("copy");
			} catch {}
			t.remove();
		}
	}

	bannerSrc(b) {
		if (!b) return "";
		return b.startsWith("/") ? `${this.base}${b}` : b;
	}

	get me() {
		return this.state.user || {};
	}

	get group() {
		return this.state.home.groups.find((g) => g.id === this.state.channel?.group_id);
	}

	shortTime(t) {
		const now = new Date();
		if (t.toDateString() === now.toDateString()) return t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
		return t.toLocaleDateString([], { month: "short", day: "numeric" });
	}

	dayLabel(t) {
		const now = new Date();
		if (t.toDateString() === now.toDateString()) return "Today";
		if (t.toDateString() === new Date(now - 864e5).toDateString()) return "Yesterday";
		return t.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
	}

	ago(t) {
		const s = Math.max(0, (Date.now() - new Date(t)) / 1000);
		if (s < 60) return "just now";
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
		return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
	}

	fmtMs(ms) {
		const m = Math.round((ms || 0) / 60000);
		if (m < 1) return ms > 0 ? "<1m" : "0m";
		return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
	}
}
