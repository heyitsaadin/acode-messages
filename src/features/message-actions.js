export class MessageActionsMethods {
	/* ---------- long press menu: reply, edit, delete ---------- */

	bindRows() {
		const L = this.$list;
		let timer = null;
		let sx = 0;
		let sy = 0;
		let $hit = null;
		let fired = false;
		let lastTap = { id: null, at: 0 };
		const cancel = () => {
			clearTimeout(timer);
			timer = null;
			if (!fired) $hit?.classList.remove("hl");
		};
		L.addEventListener("touchstart", (e) => {
			const $r = e.target.closest?.(".am-row");
			if (!$r || e.touches.length !== 1) return;
			$hit = $r;
			fired = false;
			sx = e.touches[0].clientX;
			sy = e.touches[0].clientY;
			clearTimeout(timer);
			timer = setTimeout(() => {
				fired = true;
				timer = null;
				$r.classList.add("hl");
				try {
					navigator.vibrate?.(12);
				} catch {}
				this.msgMenu($r);
			}, 420);
		}, { passive: true });
		L.addEventListener("touchmove", (e) => {
			const t = e.touches[0];
			if (timer && (Math.abs(t.clientX - sx) > 9 || Math.abs(t.clientY - sy) > 9)) cancel();
		}, { passive: true });
		L.addEventListener("touchend", (e) => {
			if (fired) {
				e.preventDefault();
				fired = false;
				return;
			}
			cancel();
			// double tap your own message to edit it, like Discord
			const $r = e.target.closest?.(".am-row");
			if (!$r || e.target.closest("img,button,.am-rp,.am-av,.am-who,.am-mn")) return;
			const now = Date.now();
			if (lastTap.id === $r.dataset.id && now - lastTap.at < 320 && $r.dataset.own) {
				lastTap = { id: null, at: 0 };
				this.startEdit($r._m);
			} else lastTap = { id: $r.dataset.id, at: now };
		});
		L.addEventListener("touchcancel", cancel, { passive: true });
		L.addEventListener("scroll", cancel, { passive: true });
		// desktop / emulator: right click opens the same menu
		L.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			const $r = e.target.closest?.(".am-row");
			if ($r) this.msgMenu($r);
		});
	}

	msgMenu($r) {
		const m = $r._m;
		if (!m) return;
		const own = String(m.user_id) === String(this.me.id);
		const kind = m.kind || "text";
		const hasText = kind === "text" || (m.content && m.content !== "📷 Photo");
		const close = (fn) => () => {
			this.closeSheet();
			$r.classList.remove("hl");
			fn();
		};
		const g1 = this.el(
			"div",
			{ class: "am-mg" },
			...[
				own && kind === "text" ? this.item("edit", "Edit Message", close(() => this.startEdit(m))) : null,
				this.item("reply", "Reply", close(() => this.startReply(m))),
			].filter(Boolean),
		);
		const g2 = this.el(
			"div",
			{ class: "am-mg" },
			...[
				hasText ? this.item("copy", "Copy Text", close(() => this.copy(m.content))) : null,
				!own ? this.item("at", "Mention", close(() => this.mention(m))) : null,
				this.item("idcard", "Copy Message ID", close(() => this.copy(String(m.id)))),
			].filter(Boolean),
		);
		const nodes = [this.el("div", { class: "am-mhint", text: own ? "Double tap your message to edit" : `${m.name} · ${this.shortTime(new Date(m.created_at))}` }), g1, g2];
		if (own) nodes.push(this.el("div", { class: "am-mg" }, this.item("trash", "Delete Message", close(() => this.askDelete(m)), "danger")));
		this.sheet("", ...nodes);
		// the row stays highlighted until the sheet closes
		const off = setInterval(() => {
			if (!this.$sheet?.classList.contains("open")) {
				$r.classList.remove("hl");
				clearInterval(off);
			}
		}, 250);
	}

	clearCtx() {
		this.replyTo = null;
		this.editing = null;
		this.$ctx?.classList.remove("show");
		this.$ctx?.replaceChildren();
		if (this.$ta) this.$ta.placeholder = this.chatPlaceholder();
	}

	showCtx(icon, label, name, text) {
		const el = this.el.bind(this);
		this.put(
			this.$ctx,
			this.ico(icon, 18),
			el("div", { class: "tx" }, el("span", { text: label }), name ? el("b", { text: ` ${name}` }) : null, text ? el("span", { text: `  ${text}` }) : null),
			el("button", { class: "am-btn", style: "width:34px;height:34px", onclick: () => this.cancelCtx() }, this.ico("close", 18)),
		);
		this.$ctx.classList.add("show");
		this.$ta.placeholder = this.chatPlaceholder();
		this.$ta.focus();
	}

	cancelCtx() {
		const wasEdit = !!this.editing;
		this.clearCtx();
		if (wasEdit) {
			this.$ta.value = "";
			this.$ta.style.height = "48px";
		}
		this.syncFab();
	}

	startReply(m) {
		if (this.editing) this.cancelCtx();
		this.replyTo = m;
		this.showCtx("reply", "Replying to", m.name, this.previewText(m).slice(0, 80));
		this.syncFab();
	}

	startEdit(m) {
		if (!m || String(m.user_id) !== String(this.me.id) || (m.kind && m.kind !== "text")) return;
		this.replyTo = null;
		this.editing = m;
		this.$ta.value = m.content;
		this.$ta.dispatchEvent(new Event("input"));
		this.showCtx("edit", "Editing message");
		this.syncFab();
	}

	mention(m) {
		if (this.editing) this.cancelCtx();
		this.insertMention(m.name);
	}

	askDelete(m) {
		this.confirm("Delete message?", "This can't be undone. It disappears for everyone in this chat.", "Delete", async () => {
			await this.deleteMessage(m);
			this.closeSheet();
		});
	}

	// The server may take a DELETE or a POST {action:"delete"}; try the REST form first, then the action form.
	async mutate(kind, m, extra = {}) {
		const channel = this.state.channel.slug;
		const body = { id: m.id, message_id: m.id, channel, ...extra };
		try {
			return await this.api("messages", { method: kind === "delete" ? "DELETE" : "PATCH", body: JSON.stringify(body) });
		} catch (e) {
			if (!/HTTP (404|405|400|501)/.test(e.message)) throw e;
			return this.api("messages", { method: "POST", body: JSON.stringify({ action: kind, ...body }) });
		}
	}

	async deleteMessage(m) {
		await this.mutate("delete", m);
		this.dropMessage(m.id);
	}

	dropMessage(id) {
		const $r = this.$list.querySelector(`.am-row[data-id="${id}"]`);
		this.msgBuf = this.msgBuf.filter((x) => String(x.id) !== String(id));
		this.saveMsgs();
		if (!$r) return;
		// a "continued" row below loses its header if the first row goes away
		const $n = $r.nextElementSibling;
		const wasFirst = $r.classList.contains("first");
		$r.classList.add("gone");
		setTimeout(() => {
			$r.remove();
			if (wasFirst && $n?.classList?.contains("cont")) this.promote($n);
			this.relast();
		}, 230);
	}

	// Turn a "continued" row into a full one (avatar + name) after the message above it vanished.
	promote($n) {
		const m = $n._m;
		const $mr = $n.querySelector(".am-mr");
		if (!m || !$mr) return;
		const t = new Date(m.created_at);
		const $fresh = this.msgRow(m, t, false, this.replyOf(m), false);
		$fresh._m = m;
		$n.replaceWith($fresh);
	}

	relast() {
		const rows = this.$list.querySelectorAll(".am-row");
		const last = rows[rows.length - 1]?._m;
		this.lastAuthor = last ? { id: String(last.user_id), t: new Date(last.created_at) } : null;
	}

	async saveEdit() {
		const m = this.editing;
		const content = this.$ta.value.trim();
		if (!m) return;
		if (!content) return this.askDelete(m);
		if (content === m.content) return this.cancelCtx();
		if (this.sending) return;
		this.sending = true;
		try {
			const isDm = this.state.channel?.kind === "dm";
			const r = await this.mutate("edit", m, { content: await this.e2eWire(this.state.channel, content) });
			const nm = r?.message || {};
			// In a DM the server only has the ciphertext, so show what was typed.
			this.applyEdit(m.id, isDm ? content : (nm.content ?? content), nm.edited_at || new Date().toISOString());
			this.cancelCtx();
		} catch (e) {
			this.flash(`Couldn't edit (${e.message})`);
		} finally {
			this.sending = false;
		}
	}

	applyEdit(id, content, at) {
		const $r = this.$list.querySelector(`.am-row[data-id="${id}"]`);
		const b = this.msgBuf.find((x) => String(x.id) === String(id));
		if (b) {
			b.content = content;
			b.edited_at = at;
		}
		this.saveMsgs();
		if (!$r?._m) return;
		$r._m.content = content;
		$r._m.edited_at = at;
		const $mb = $r.querySelector(".am-mb");
		const $old = $mb.querySelector(".am-mc");
		if ($old) $old.replaceWith(this.bubble($r._m, null, new Date($r._m.created_at), String($r._m.user_id) === String(this.me.id)));
	}

	// Picks up edits and deletes made by other people: re-reads the recent window every few polls.
	async reconcile() {
		const ch = this.state.channel;
		if (!ch || this.view !== "chat" || !this.lastId) return;
		try {
			const { messages } = await this.api(`messages?channel=${encodeURIComponent(ch.slug)}&after=0`);
			if (ch !== this.state.channel || !Array.isArray(messages) || !messages.length) return;
			const ids = new Set(messages.map((x) => String(x.id)));
			const min = Math.min(...messages.map((x) => Number(x.id)));
			const max = Math.max(...messages.map((x) => Number(x.id)));
			for (const m of messages) {
				if (m.deleted) {
					this.dropMessage(m.id);
					continue;
				}
				const b = this.msgBuf.find((x) => String(x.id) === String(m.id));
				if (b && b.content !== m.content) this.applyEdit(m.id, m.content, m.edited_at || new Date().toISOString());
			}
			// rows inside the fetched window that the server no longer returns were deleted
			for (const $r of [...this.$list.querySelectorAll(".am-row")]) {
				const id = Number($r.dataset.id);
				if (id >= min && id <= max && !ids.has($r.dataset.id) && !$r.classList.contains("gone")) this.dropMessage(id);
			}
		} catch {}
	}

	async send() {
		const content = this.$ta.value.trim();
		const pend = this.pend;
		if (this.editing) return this.saveEdit();
		if ((!content && !pend) || !this.state.channel) return;
		if (this.state.channel.kind !== "dm" && (this.isMuted(this.group) || this.chanInfo()?.can_send === false)) return this.syncMute();
		// "/share app.py" sends that open tab as a code card instead of the literal text
		const cmd = !pend && /^\/share(?:\s+([\s\S]*))?$/i.exec(content);
		if (cmd) return this.shareCommand(cmd[1]);
		await this.postMessage(content, pend ? { type: "image", data: pend.b64, w: pend.w, h: pend.h } : null);
	}

	// Text, a photo (with optional caption) or a voice clip. One request, one message.
	async postMessage(content, attachment, ch = this.state.channel) {
		if (!ch) return;
		if (this.sending) return this.flash("Still sending the last message…");
		this.sending = true;
		if (this.$send) this.$send.disabled = true;
		this.$pend?.classList.add("busy");
		const replied = this.replyTo;
		try {
			const wire = await this.e2eWire(ch, content); // DMs go out as an encrypted envelope
			const { message } = await this.api("messages", {
				method: "POST",
				body: JSON.stringify({ channel: ch.slug, content: wire, ...(attachment ? { attachment } : {}), ...(this.replyTo ? { reply_to: this.replyTo.id } : {}) }),
			});
			await this.decryptMessages(ch, [message]);
			if (attachment?.type !== "voice") {
				this.clearCtx();
				this.$ta.value = "";
				this.$ta.style.height = "48px";
				this.clearPending();
			}
			if (ch === this.state.channel && Number(message.id) > this.lastId) {
				if (replied && message.reply_to == null && !message.reply && message.reply_to_id == null) message.reply_to = replied.id;
				this.append([message], true);
			}
			return true;
		} catch (e) {
			this.flash(`${attachment ? "Not sent" : "Message not sent"} (${e.message})`);
			if (/muted/i.test(e.message)) this.refreshHome().then(() => this.syncMute());
			return false;
		} finally {
			this.sending = false;
			if (this.$send) this.$send.disabled = false;
			this.$pend?.classList.remove("busy");
			this.syncFab();
		}
	}
}
