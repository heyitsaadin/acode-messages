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
		return $a;
	}

	// Avatar with the green/grey presence dot.
	avw(u, size, online) {
		return this.el("div", { class: "am-avw" }, this.avatar(u, size), online === undefined ? null : this.el("span", { class: `am-on${online ? "" : " off"}` }));
	}

	// Acode's blue rosette verification mark, rendered as a crisp inline SVG.
	verifiedMark() {
		const $mark = this.el("span", { class: "am-verified-mark", title: "Acode verified", "aria-label": "Acode verified" });
		$mark.innerHTML = '<svg viewBox="0 0 40 40" role="img" aria-hidden="true"><path fill="currentColor" d="M20 1.5c3.5 0 5.4 4.1 8.5 4.1 2.6 0 5.1-2.7 8-1.2 2.9 1.6 1.9 6.1 3.8 8.2 2 2.1 6.5 2 7.1 5.1.6 3.1-3.1 5.8-3.1 8.8s3.7 5.7 3.1 8.8c-.6 3.1-5.1 3-7.1 5.1-1.9 2.1-.9 6.6-3.8 8.2-2.9 1.5-5.4-1.2-8-1.2-3.1 0-5 4.1-8.5 4.1s-5.4-4.1-8.5-4.1c-2.6 0-5.1 2.7-8 1.2-2.9-1.6-1.9-6.1-3.8-8.2-2-2.1-6.5-2-7.1-5.1-.6-3.1 3.1-5.8 3.1-8.8s-3.7-5.7-3.1-8.8c.6-3.1 5.1-3 7.1-5.1 1.9-2.1.9-6.6 3.8-8.2 2.9-1.5 5.4 1.2 8 1.2 3.1 0 5-4.1 8.5-4.1z" transform="translate(4 4) scale(.67)"/><path d="m10.5 20.5 6.2 6.1L30 13.5" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="square" stroke-linejoin="miter"/></svg>';
		return $mark;
	}

	badges(u) {
		const out = [];
		if (u.verified) out.push(this.verifiedMark());
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
