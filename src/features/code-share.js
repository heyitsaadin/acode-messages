import { peerOf } from "../util.js";

const CODE_MAX = 1800; // the server accepts 2000 characters per message, the fences and file name take the rest

export class CodeShareMethods {
	/* ---------- code sharing: things a plain chat app can't do ---------- */
	/* Select code in the editor -> "Send to chat". Code in a message shows as a card you can copy or open in the editor. */

	initCodeShare() {
		// The selection popup has no remove(), so add the item once and always call the live plugin instance.
		try {
			const menu = acode.require("selectionMenu");
			if (typeof menu?.add === "function" && !window.__amSelectionItem) {
				window.__amSelectionItem = true;
				menu.add(() => window.acodeMessages?.shareSelection(), this.ico("send", 20), "selected", true, { id: "acode-messages-share", label: "Send to chat" });
			}
		} catch (e) {
			console.warn("Acode Messages: selection menu item failed", e);
		}
		try {
			const commands = acode.require("commands");
			commands?.addCommand?.({ name: "acode-messages-share-code", description: "Send selected code to Acode Messages", exec: () => this.shareSelection() });
			this.cleanups.push(() => commands?.removeCommand?.("acode-messages-share-code"));
		} catch {}
	}

	// Strip the indentation every line has in common, so a snippet from deep inside a file reads well.
	dedent(code) {
		const lines = code.replace(/\r\n?/g, "\n").split("\n");
		let min = Infinity;
		for (const l of lines) {
			if (!l.trim()) continue;
			min = Math.min(min, /^[ \t]*/.exec(l)[0].length);
		}
		if (!Number.isFinite(min) || min === 0) return lines.join("\n");
		return lines.map((l) => l.slice(Math.min(min, /^[ \t]*/.exec(l)[0].length))).join("\n");
	}

	// Reads the selection (or the current line) from the editor and lets you pick where to send it.
	async shareSelection() {
		const em = window.editorManager;
		const view = em?.editor;
		const file = em?.activeFile;
		if (!view?.state || !file || file.type !== "editor") return this.alertError("Open a file and select some code first.");
		const { state } = view;
		const sel = state.selection.main;
		let from = sel.from;
		let to = sel.to;
		if (from === to) {
			const line = state.doc.lineAt(from);
			from = line.from;
			to = line.to;
		}
		let code = this.dedent(state.sliceDoc(from, to)).replace(/\s+$/, "");
		if (!code.trim()) return this.alertError("Select some code first.");
		const a = state.doc.lineAt(from).number;
		const b = state.doc.lineAt(to).number;
		let trimmed = false;
		if (code.length > CODE_MAX) {
			code = `${code.slice(0, CODE_MAX).replace(/\n[^\n]*$/, "")}\n…`;
			trimmed = true;
		}
		code = code.replace(/```/g, "``\u200b`");
		const name = String(file.filename || "snippet");
		const ext = /\.([\w+#-]{1,12})$/.exec(name)?.[1]?.toLowerCase() || "text";
		const label = `${name}:${a}${b > a ? `-${b}` : ""}`;
		this.pendingCode = { block: `\`\`\`${ext} ${label}\n${code}\n\`\`\``, trimmed };
		const reused = !!this.tab;
		try {
			await this.open();
		} catch {}
		if (!this.$page) return;
		// A freshly opened chat keeps sheets shut for a moment (see openSheet). When the tab was already
		// open, the tap that chose "Send to chat" can still land on the chat after the switch, so wait that out too.
		const wait = reused ? 450 : 760 - (Date.now() - (this.openedAt || 0));
		if (wait > 0) await new Promise((r) => setTimeout(r, wait));
		if (!this.state.user) return this.flash("Sign in to Acode first, then try again");
		this.codeTargets();
	}

	codeTargets() {
		if (!this.pendingCode || !this.$sheet) return;
		const home = this.state.home || {};
		const cur = this.view === "chat" ? this.state.channel : null;
		const rows = [];
		if (cur) rows.push(this.item("chat", `Current chat · ${cur.kind === "dm" ? cur.name : `#${cur.name}`}`, () => this.codeTo(cur)));
		for (const d of home.dms || []) rows.push(this.item("user", d.name, () => this.codeTo({ slug: d.slug, name: d.name, kind: "dm", peer: peerOf(d) }), "", "Direct message"));
		for (const g of home.groups || []) {
			for (const c of g.channels || []) rows.push(this.item(c.private ? "lock" : "hash", c.name, () => this.codeTo({ slug: c.slug, name: c.name, kind: "text", group_id: g.id }), "", g.name));
		}
		this.sheet("Send code to…", ...(rows.length ? rows : [this.el("div", { class: "am-note", text: "No chats yet. Start a conversation or join a group first." })]));
	}

	// The snippet lands in the message box, so you can add a note before sending.
	codeTo(ch) {
		const p = this.pendingCode;
		this.pendingCode = null;
		if (!p) return;
		this.closeSheet();
		if (this.view !== "chat" || this.state.channel?.slug !== ch.slug) this.openChannel(ch);
		const t = this.$ta;
		const have = t.value.trim();
		t.value = have ? `${have}\n${p.block}` : p.block;
		t.dispatchEvent(new Event("input"));
		t.focus();
		if (p.trimmed) this.flash("Long snippet, trimmed to fit in one message");
	}

	// "```js main.js:12-20\n...\n```" blocks become cards; everything around them keeps the @mention formatting.
	richText(text) {
		if (!text.includes("```")) return this.richInline(text);
		const f = document.createDocumentFragment();
		const re = /```([^\n`]*)\n([\s\S]*?)\n?```/g;
		let last = 0;
		let m;
		while ((m = re.exec(text))) {
			if (m.index > last) f.append(this.richInline(text.slice(last, m.index).replace(/\n$/, "")));
			f.append(this.codeCard(m[1].trim(), m[2]));
			last = m.index + m[0].length;
			if (text[last] === "\n") last++;
		}
		if (last < text.length) f.append(this.richInline(text.slice(last)));
		return f;
	}

	codeCard(info, code) {
		const el = this.el.bind(this);
		const sp = info.indexOf(" ");
		const lang = sp < 0 ? info : info.slice(0, sp);
		const label = sp < 0 ? "" : info.slice(sp + 1).trim();
		const $copy = el("button", { text: "Copy" });
		$copy.onclick = async (e) => {
			e.stopPropagation();
			await this.copy(code);
			$copy.textContent = "Copied ✓";
			setTimeout(() => ($copy.textContent = "Copy"), 1500);
		};
		const $open = el("button", {
			text: "Open",
			onclick: (e) => {
				e.stopPropagation();
				this.openSnippet(code, label, lang);
			},
		});
		return el("div", { class: "am-code" }, el("div", { class: "am-code-h" }, el("span", { class: "ti", text: label || lang || "code" }), $copy, $open), el("pre", {}, el("code", { text: code })));
	}

	// Opens a shared snippet as a new file in the editor.
	openSnippet(code, label, lang) {
		const base = label.replace(/:\d+(-\d+)?$/, "").split("/").pop().trim();
		const name = base || `snippet.${lang && lang !== "text" ? lang : "txt"}`;
		try {
			acode.newEditorFile(name, { text: code, render: true });
		} catch {
			this.copy(code);
			this.flash("Couldn't open a tab, copied the code instead");
		}
	}

	// Chat list / reply previews: a code block shows as a short label instead of raw backticks.
	plainPreview(s) {
		s = String(s || "");
		if (!s.includes("```")) return s;
		return s
			.replace(/```[^\n`]*\n[\s\S]*?\n?```/g, "💻 Code")
			.replace(/```[\s\S]*$/, "💻 Code")
			.replace(/\s+/g, " ")
			.trim();
	}
}
