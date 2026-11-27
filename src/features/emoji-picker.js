import { EMOJI_CATS } from "../emoji-data.js";
import { ls } from "../util.js";

const EMO_RECENT_KEY = "am-emo-recent";
const EMO_RECENT_MAX = 32;
const EMO_RESULTS_MAX = 160;

// The panel under the message box: a search field, the emoji of one category, and a row of tabs
// (Recent, the categories, and GIF). GIF is only a placeholder for now.
export class EmojiPickerMethods {
	/* ---------- emoji picker ---------- */

	emoBuild() {
		const el = this.el.bind(this);
		this.emoTab = "smileys";
		this.$emoSearch = el("input", { type: "search", placeholder: "Search emoji", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "search" });
		this.$emoSearch.addEventListener("input", () => this.emoPaint());
		this.$emoGrid = el("div", { class: "am-emo-g" });
		this.$emoTabs = el("div", { class: "am-emo-t" });
		this.emoTabBtns = {};
		const tabs = [{ id: "recent", label: "🕘" }, ...EMOJI_CATS.map((c) => ({ id: c.id, label: c.tab, title: c.name })), { id: "gif", label: "GIF", cls: "gif" }];
		for (const t of tabs) {
			const $b = el("button", { class: t.cls || "", text: t.label, title: t.title || (t.id === "recent" ? "Recent" : t.label), onclick: () => this.emoGo(t.id) });
			this.emoTabBtns[t.id] = $b;
			this.$emoTabs.append($b);
		}
		// Pressing a button here must not take focus from the message box, or the keyboard closes.
		const keep = (e) => {
			if (e.target.closest?.("button")) e.preventDefault();
		};
		for (const $x of [this.$emoGrid, this.$emoTabs]) {
			$x.addEventListener("pointerdown", keep);
			$x.addEventListener("mousedown", keep);
		}
		this.put(this.$emo, el("div", { class: "am-emo-s" }, this.$emoSearch), this.$emoGrid, this.$emoTabs);
		this.emoPaint();
	}

	// The smiley button: open or close the panel.
	emoToggle() {
		const open = this.$emo.classList.toggle("show");
		if (!open) return;
		this.$emoSearch.value = "";
		this.emoPaint();
	}

	emoGo(id) {
		this.emoTab = id;
		this.$emoSearch.value = "";
		this.emoPaint();
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

	emoButtons(list) {
		return list.map((e) => this.el("button", { class: "am-ee", text: e, onclick: () => this.emoPick(e) }));
	}

	emoNote(title, text) {
		return this.el("div", { class: "am-emo-note" }, this.el("b", { text: title }), text ? this.el("div", { text }) : null);
	}

	emoPaint() {
		const q = this.$emoSearch.value.trim().toLowerCase();
		const el = this.el.bind(this);
		let nodes;
		if (q) {
			const found = this.emoFind(q);
			nodes = found.length ? this.emoButtons(found) : [this.emoNote("No emoji found", "Try another word, like heart, cat or food.")];
		} else if (this.emoTab === "gif") {
			nodes = [this.emoNote("GIFs are coming soon", "You'll be able to search and send GIFs from here.")];
		} else if (this.emoTab === "recent") {
			const r = this.emoRecent();
			nodes = r.length ? this.emoButtons(r) : [this.emoNote("No recent emoji yet", "The ones you use show up here.")];
		} else {
			const cat = EMOJI_CATS.find((c) => c.id === this.emoTab) || EMOJI_CATS[0];
			nodes = [el("div", { class: "am-eh", text: cat.name }), ...this.emoButtons(cat.groups.flatMap((g) => g.list))];
		}
		this.$emoGrid.replaceChildren(...nodes);
		this.$emoGrid.scrollTop = 0;
		for (const [id, $b] of Object.entries(this.emoTabBtns)) $b.classList.toggle("on", !q && id === this.emoTab);
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
