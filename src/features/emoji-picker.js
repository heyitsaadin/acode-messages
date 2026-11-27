import { EMOJI_CATS } from "../emoji-data.js";
import { ls } from "../util.js";

const EMO_RECENT_KEY = "am-emo-recent";
const EMO_RECENT_MAX = 36;
const EMO_RESULTS_MAX = 200;

const SVG = (body, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const SVG_SEARCH = SVG('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 20);
const SVG_CLOCK = SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const SVG_DEL = SVG('<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m18 9-6 6m0-6 6 6"/>', 26);

// The panel under the message box, laid out like Discord's:
//   [ Emoji | GIFs | Stickers ]  switch
//   search field
//   one scrolling list: "Frequently Used" (if any), then every category with its own header
//   a bar of category icons that jump to a section, and a delete key
// GIFs and Stickers are only placeholders for now.
export class EmojiPickerMethods {
	/* ---------- emoji picker ---------- */

	emoBuild() {
		const el = this.el.bind(this);
		this.emoMode = "emoji";
		this.emoSecs = {};

		const $seg = el("div", { class: "am-emo-m" });
		this.emoModeBtns = {};
		for (const [id, label] of [["emoji", "Emoji"], ["gif", "GIFs"], ["stickers", "Stickers"]]) {
			const $b = el("button", { text: label, onclick: () => this.emoSetMode(id) });
			this.emoModeBtns[id] = $b;
			$seg.append($b);
		}

		this.$emoSearch = el("input", { type: "search", placeholder: "Find the perfect emoji", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "search" });
		this.$emoSearch.addEventListener("input", () => this.emoPaint());
		const $mag = el("span", { class: "ic" });
		$mag.innerHTML = SVG_SEARCH;
		const $search = el("div", { class: "am-emo-s" }, $mag, this.$emoSearch);

		this.$emoGrid = el("div", { class: "am-emo-g" });
		this.$emoGrid.addEventListener("scroll", () => this.emoSpy(), { passive: true });

		const $tabs = el("div", { class: "am-emo-tt" });
		this.emoTabBtns = {};
		const tabs = [{ id: "recent", svg: SVG_CLOCK, title: "Frequently Used" }, ...EMOJI_CATS.map((c) => ({ id: c.id, label: c.tab, title: c.name }))];
		for (const t of tabs) {
			const $b = el("button", { title: t.title, onclick: () => this.emoGo(t.id) });
			if (t.svg) $b.innerHTML = t.svg;
			else $b.textContent = t.label;
			this.emoTabBtns[t.id] = $b;
			$tabs.append($b);
		}
		const $del = el("button", { class: "del", title: "Delete", onclick: () => this.emoBack() });
		$del.innerHTML = SVG_DEL;
		const $bar = el("div", { class: "am-emo-t" }, $tabs, $del);

		// Pressing a button here must not take focus from the message box, or the keyboard closes.
		const keep = (e) => {
			if (e.target.closest?.("button")) e.preventDefault();
		};
		this.$emo.addEventListener("pointerdown", keep);
		this.$emo.addEventListener("mousedown", keep);

		this.put(this.$emo, $seg, $search, this.$emoGrid, $bar);
		this.emoPaint();
	}

	// The smiley button: open or close the panel.
	emoToggle() {
		const open = this.$emo.classList.toggle("show");
		if (!open) return;
		this.emoMode = "emoji";
		this.$emoSearch.value = "";
		this.emoPaint();
	}

	emoSetMode(id) {
		this.emoMode = id;
		this.$emoSearch.value = "";
		this.emoPaint();
	}

	// A bottom-bar icon: jump to that section.
	emoGo(id) {
		if (this.emoMode !== "emoji" || this.$emoSearch.value) {
			this.emoMode = "emoji";
			this.$emoSearch.value = "";
			this.emoPaint();
		}
		const $s = this.emoSecs[id];
		this.$emoGrid.scrollTo({ top: $s ? $s.offsetTop : 0, behavior: "smooth" });
		this.emoActive(id);
	}

	emoRecent() {
		const r = ls.get(EMO_RECENT_KEY);
		return Array.isArray(r) ? r : [];
	}

	emoPick(e) {
		this.addEmoji(e);
		const r = [e, ...this.emoRecent().filter((x) => x !== e)].slice(0, EMO_RECENT_MAX);
		ls.set(EMO_RECENT_KEY, r);
	}

	// The delete key: removes the selection, or the last emoji / letter before the cursor.
	emoBack() {
		const t = this.$ta;
		if (!t) return;
		let s = t.selectionStart;
		const e = t.selectionEnd;
		if (s === e) {
			const before = t.value.slice(0, s);
			let last;
			if (typeof Intl !== "undefined" && Intl.Segmenter) {
				for (const g of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(before)) last = g.segment;
			} else {
				last = Array.from(before).pop();
			}
			if (!last) return;
			s -= last.length;
		}
		t.setRangeText("", s, e, "end");
		t.dispatchEvent(new Event("input"));
	}

	emoButtons(list) {
		return list.map((e) => this.el("button", { class: "am-ee", text: e, onclick: () => this.emoPick(e) }));
	}

	emoSection(id, title, list) {
		const $s = this.el("div", { class: "am-es" }, this.el("div", { class: "am-eh", text: title }), this.el("div", { class: "am-eg" }, ...this.emoButtons(list)));
		this.emoSecs[id] = $s;
		return $s;
	}

	emoNote(title, text) {
		return this.el("div", { class: "am-emo-note" }, this.el("b", { text: title }), text ? this.el("div", { text }) : null);
	}

	emoPaint() {
		const q = this.$emoSearch.value.trim().toLowerCase();
		const mode = this.emoMode;
		this.emoSecs = {};
		this.$emo.classList.toggle("ph", mode !== "emoji");
		for (const [id, $b] of Object.entries(this.emoModeBtns)) $b.classList.toggle("on", id === mode);
		let nodes;
		if (mode === "gif") {
			nodes = [this.emoNote("GIFs are coming soon", "You'll be able to search and send GIFs from here.")];
		} else if (mode === "stickers") {
			nodes = [this.emoNote("Stickers are coming soon")];
		} else if (q) {
			const found = this.emoFind(q);
			nodes = found.length ? [this.emoSection("results", "Search results", found)] : [this.emoNote("No emoji found", "Try another word, like heart, cat or food.")];
		} else {
			nodes = [];
			const r = this.emoRecent();
			if (r.length) nodes.push(this.emoSection("recent", "Frequently Used", r));
			for (const c of EMOJI_CATS) nodes.push(this.emoSection(c.id, c.name, c.groups.flatMap((g) => g.list)));
		}
		this.$emoGrid.replaceChildren(...nodes);
		this.$emoGrid.scrollTop = 0;
		this.emoActive(q || mode !== "emoji" ? null : Object.keys(this.emoSecs)[0]);
	}

	// Highlight the bottom-bar icon of the section you are looking at.
	emoSpy() {
		if (this.emoMode !== "emoji" || this.$emoSearch.value.trim()) return;
		const g = this.$emoGrid;
		const ids = Object.keys(this.emoSecs);
		if (!ids.length) return;
		let cur = ids[0];
		for (const id of ids) if (this.emoSecs[id].offsetTop <= g.scrollTop + 12) cur = id;
		if (g.scrollTop + g.clientHeight >= g.scrollHeight - 2) cur = ids[ids.length - 1];
		this.emoActive(cur);
	}

	emoActive(id) {
		if (this.emoCur === id) return;
		this.emoCur = id;
		for (const [k, $b] of Object.entries(this.emoTabBtns)) {
			const on = k === id;
			$b.classList.toggle("on", on);
			if (on) $b.scrollIntoView?.({ block: "nearest", inline: "nearest" });
		}
	}

	// Every word you type has to appear in a group's search words.
	emoFind(q) {
		const terms = q.split(/\s+/).filter(Boolean);
		const out = [];
		const seen = new Set();
		for (const c of EMOJI_CATS) {
			for (const g of c.groups) {
				if (!terms.every((t) => g.words.includes(t))) continue;
				for (const e of g.list) {
					if (seen.has(e)) continue;
					seen.add(e);
					out.push(e);
				}
				if (out.length >= EMO_RESULTS_MAX) return out;
			}
		}
		return out;
	}
}
