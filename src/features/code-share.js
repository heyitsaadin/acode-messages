import { peerOf } from "../util.js";
import { highlight } from "./highlight.js";

const FILE_MAX_BYTES = 1_000_000; // biggest file /share uploads (the server enforces the same limit)

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

	/* ---------- /share <file>: send a file that is open in a tab ---------- */

	// Real editor tabs only. The chat tab and other pages have nothing to share.
	openFiles() {
		return (window.editorManager?.files || []).filter((f) => f && f.type === "editor" && f.filename);
	}

	// The folder a tab lives in, so two tabs with the same name can be told apart.
	fileWhere(f) {
		const raw = String(f.location || (f.uri ? String(f.uri).replace(/\/[^/]*$/, "") : "")).replace(/\/+$/, "");
		let dir = raw;
		try {
			dir = decodeURIComponent(raw);
		} catch {}
		return dir.split("/").filter(Boolean).slice(-2).join("/");
	}

	// Autofill while typing: "/s" offers the command, "/share ap" lists the open tabs that match.
	// Returns true when the message box holds a /share command, so the @mention list stays out of the way.
	shareSuggest(before) {
		const $s = this.$sug;
		const show = (...kids) => {
			this.put($s, ...kids);
			$s.scrollTop = 0;
			$s.classList.add("show");
			return true;
		};
		const keep = (e) => e.preventDefault(); // keep the keyboard open while tapping
		const cmd = /^\/([a-z]*)$/i.exec(before);
		if (cmd && "share".startsWith(cmd[1].toLowerCase())) {
			const $r = this.el("div", { class: "am-sg", onclick: () => this.pickShareCommand() }, this.ico("file", 22), this.el("b", { text: "/share" }), this.el("small", { text: "Send a file from your tabs" }));
			$r.onmousedown = keep;
			$r.onpointerdown = keep;
			return show(this.el("div", { class: "am-sug-h", text: "Command" }), $r);
		}
		const arg = /^\/share\s+([^\n]*)$/i.exec(before);
		if (!arg) return false;
		const typed = arg[1].trim();
		const q = typed.toLowerCase();
		const files = this.openFiles();
		const rank = (n) => {
			const l = n.toLowerCase();
			return l.startsWith(q) ? 0 : l.includes(q) ? 1 : 9;
		};
		const list = files
			.map((f) => ({ f, r: rank(f.filename) }))
			.filter((x) => x.r < 9)
			.sort((a, b) => a.r - b.r || a.f.filename.localeCompare(b.f.filename))
			.slice(0, 8)
			.map((x) => x.f);
		// The whole name is already typed and nothing else matches: nothing left to fill in.
		if (list.length === 1 && list[0].filename === typed) {
			this.hideSug();
			return true;
		}
		if (!list.length) return show(this.el("div", { class: "am-sug-h", text: files.length ? `No open tab matches "${typed}"` : "No file is open in a tab" }));
		const rows = list.map((f) => {
			const name = f.filename;
			const pre = name.toLowerCase().startsWith(q) ? q.length : 0;
			const $n = this.el("b", {}, ...(pre ? [this.el("em", { text: name.slice(0, pre) }), name.slice(pre)] : [name]));
			const $r = this.el("div", { class: "am-sg", onclick: () => this.pickShareFile(name) }, this.ico("file", 22), $n, this.el("small", { text: this.fileWhere(f) }));
			$r.onmousedown = keep;
			$r.onpointerdown = keep;
			return $r;
		});
		return show(this.el("div", { class: "am-sug-h", text: "Open files" }), ...rows);
	}

	// Tapping the "/share" row types the command and opens the file list.
	pickShareCommand() {
		const t = this.$ta;
		t.value = "/share ";
		t.focus();
		t.setSelectionRange(t.value.length, t.value.length);
		t.dispatchEvent(new Event("input"));
	}

	// Tapping a file fills in its full name. Sending is still up to you.
	pickShareFile(name) {
		const t = this.$ta;
		t.value = `/share ${name}`;
		this.sugSkip = t.value;
		t.focus();
		t.setSelectionRange(t.value.length, t.value.length);
		t.dispatchEvent(new Event("input"));
		this.hideSug();
	}

	// Runs when "/share <name>" is sent. Only a tab that is open right now can be shared.
	shareCommand(arg) {
		const want = String(arg || "").trim();
		if (!want) return this.flash("Add a file name, like /share app.py");
		const low = want.toLowerCase();
		const hits = this.openFiles().filter((f) => f.filename.toLowerCase() === low);
		if (!hits.length) return this.flash(`"${want}" isn't open in a tab, so nothing was shared`);
		if (hits.length > 1) {
			// Same name in two folders: ask which one.
			return this.sheet(
				`Which ${hits[0].filename}?`,
				...hits.map((f) =>
					this.item("file", f.filename, () => {
						this.closeSheet();
						this.shareFile(f);
					}, "", this.fileWhere(f)),
				),
			);
		}
		return this.shareFile(hits[0]);
	}

	// The text of a tab, including edits that aren't saved yet.
	fileText(file) {
		const s = file.session;
		if (typeof s?.getValue === "function") return s.getValue();
		if (typeof s?.doc?.toString === "function") return s.doc.toString();
		return null;
	}

	// Cuts code into pieces that fit in one message each, at line breaks.
	splitCode(code, budget) {
		const parts = [];
		let buf = [];
		let size = 0;
		let from = 1;
		const flush = () => {
			if (!buf.length) return;
			parts.push({ text: buf.join("\n"), a: from, b: from + buf.length - 1 });
			from += buf.length;
			buf = [];
			size = 0;
		};
		for (const raw of code.split("\n")) {
			// a single line longer than a message (minified files) is cut into pieces
			const pieces = raw.length > budget ? raw.match(new RegExp(`[\\s\\S]{1,${budget}}`, "g")) : [raw];
			for (const line of pieces) {
				if (buf.length && size + line.length + 1 > budget) flush();
				buf.push(line);
				size += line.length + 1;
			}
		}
		flush();
		return parts;
	}

	// Sends a whole tab as a code card (same format as "Send to chat"). Big files go out as several messages.
	shareFile(file) {
		const ch = this.state.channel;
		if (!ch) return;
		const name = String(file.filename);
		if (file.loaded === false || file.loading) return this.flash(`${name} hasn't finished loading. Tap its tab once, then try again`);
		let text = null;
		try {
			text = this.fileText(file);
		} catch {}
		if (text == null) return this.flash(`Couldn't read ${name}`);
		const code = String(text).replace(/\r\n?/g, "\n").replace(/\s+$/, "").replace(/```/g, "``\u200b`");
		if (!code.trim()) return this.flash(`${name} is empty, so nothing was shared`);
		const safe = name.replace(/[`\r\n]/g, "_");
		const ext = /\.([\w+#-]{1,12})$/.exec(name)?.[1]?.toLowerCase() || "text";
		const budget = Math.max(300, 1950 - (ext.length + safe.length + 25)); // the server takes 2000 characters per message
		const parts = this.splitCode(code, budget);
		if (parts.length > SHARE_MAX_PARTS) return this.flash(`${name} is too long to share whole. Select the part you want and use "Send to chat"`);
		const blocks = parts.map((p) => {
			const label = parts.length === 1 ? safe : `${safe}:${p.a}${p.b > p.a ? `-${p.b}` : ""}`;
			return `\`\`\`${ext} ${label}\n${p.text}\n\`\`\``;
		});
		const go = async () => {
			for (let i = 0; i < blocks.length; i++) {
				if (this.state.channel !== ch) return; // left the chat meanwhile
				if (!(await this.postMessage(blocks[i], null, ch))) {
					if (i) this.flash(`Only ${i} of ${blocks.length} parts were sent`);
					return;
				}
			}
		};
		if (blocks.length === 1) return go();
		// Several messages: ask first, so a big file never floods the chat by accident.
		const kb = (code.length / 1024).toFixed(1);
		this.sheet(
			`Share ${safe}?`,
			this.el("div", { class: "am-sub", style: "margin:0 14px 8px", text: `It's ${kb} KB, too big for one message, so it goes out as ${blocks.length} messages.` }),
			this.item("send", `Send ${blocks.length} messages`, () => {
				this.closeSheet();
				go();
			}),
			this.item("close", "Cancel", () => this.closeSheet()),
		);
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
