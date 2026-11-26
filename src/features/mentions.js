import { POLL_MS, MSG_CACHE } from "../constants.js";
import { ls } from "../util.js";

export class MentionsMethods {
	/* ---------- @mentions: suggestions while typing, tap a name to mention ---------- */

	// People you can mention here: this DM's peer or the group's members, plus anyone who spoke in the chat.
	mentionPeople() {
		const out = new Map();
		const myId = String(this.me?.id ?? "");
		const add = (u, id) => {
			const name = u?.name;
			const uid = String(id ?? u?.id ?? u?.user_id ?? u?.peer_id ?? "");
			if (!name || !uid || uid === myId) return;
			const k = name.toLowerCase();
			const old = out.get(k);
			const next = { id: uid, name, avatar_url: u.avatar_url, verified: u.verified, acode_pro: u.acode_pro, is_admin: u.is_admin, is_plugin_admin: u.is_plugin_admin, online: u.online };
			if (!old || (old.online === undefined && u.online !== undefined)) out.set(k, { ...old, ...next });
		};
		const c = this.state.channel;
		if (c?.kind === "dm") add(c.peer, c.peer?.id);
		else if (this.group) for (const u of this.members[this.group.id] || []) add(u);
		for (const m of this.msgBuf || []) add(m, m.user_id);
		return [...out.values()];
	}

	// Every name we can recognise inside a message, longest first so "@Aadin Kc" beats "@Aadin".
	mentionNames() {
		if (this._mn && Date.now() - this._mn.at < 2500 && this._mn.ch === this.state.channel) return this._mn.list;
		const set = new Set(this.mentionPeople().map((u) => u.name));
		if (this.me?.name) set.add(this.me.name);
		const list = [...set].sort((a, b) => b.length - a.length).map((n) => [n, n.toLowerCase()]);
		this._mn = { at: Date.now(), ch: this.state.channel, list };
		return list;
	}

	findPerson(name) {
		const k = String(name || "").toLowerCase();
		if (this.me?.name && this.me.name.toLowerCase() === k) return { ...this.me, self: true };
		return this.mentionPeople().find((u) => u.name.toLowerCase() === k) || null;
	}

	suggest() {
		const t = this.$ta;
		const $s = this.$sug;
		if (!t || !$s) return;
		if (this.editing || t.value === this.sugSkip) return this.hideSug();
		const pos = t.selectionStart ?? t.value.length;
		const before = t.value.slice(0, pos);
		if (this.shareSuggest(before)) return; // "/share ap…" lists matching open tabs instead of members
		const mt = /(^|\s)@([^@\n]{0,32})$/.exec(before);
		if (!mt) return this.hideSug();
		const g = this.group;
		if (g && !this.gdata[g.id] && !this.loadingMembers) {
			this.loadingMembers = true;
			this.loadGroup(g).then(() => this.suggest()).catch(() => {}).finally(() => (this.loadingMembers = false));
		}
		const q = mt[2].toLowerCase();
		const rank = (n) => {
			const l = n.toLowerCase();
			if (l.startsWith(q)) return 0;
			if (q && l.split(/[\s._-]+/).some((w) => w.startsWith(q))) return 1;
			return q ? 9 : 0;
		};
		const list = this.mentionPeople()
			.map((u) => ({ u, r: rank(u.name) }))
			.filter((x) => x.r < 9)
			.sort((a, b) => a.r - b.r || (b.u.online ? 1 : 0) - (a.u.online ? 1 : 0) || a.u.name.localeCompare(b.u.name))
			.slice(0, 8)
			.map((x) => x.u);
		if (!list.length) return this.hideSug();
		const start = pos - q.length - 1;
		const rows = list.map((u) => {
			const pre = u.name.toLowerCase().startsWith(q) ? q.length : 0;
			const $n = this.el("b", {}, ...(pre ? [this.el("em", { text: u.name.slice(0, pre) }), u.name.slice(pre)] : [u.name]), ...this.badges(u));
			const $r = this.el("div", { class: "am-sg", onclick: () => this.pickMention(u, start, pos) }, this.avatar(u, 30), $n, u.online === undefined ? null : this.el("small", { text: u.online ? "Online" : "" }));
			const keep = (e) => e.preventDefault(); // keep the keyboard open while tapping
			$r.onmousedown = keep;
			$r.onpointerdown = keep;
			return $r;
		});
		this.put($s, this.el("div", { class: "am-sug-h", text: q ? "Members matching" : "Mention a member" }), ...rows);
		$s.scrollTop = 0;
		$s.classList.add("show");
	}

	hideSug() {
		if (this.$sug?.classList.contains("show")) {
			this.$sug.classList.remove("show");
			this.$sug.replaceChildren();
		}
	}

	pickMention(u, start, end) {
		const t = this.$ta;
		const ins = `@${u.name} `;
		t.value = t.value.slice(0, start) + ins + t.value.slice(end);
		const caret = start + ins.length;
		this.sugSkip = t.value;
		t.focus();
		t.setSelectionRange(caret, caret);
		t.dispatchEvent(new Event("input"));
		this.hideSug();
	}

	// Tapping a name in the chat drops "@Name " into the message box at the cursor.
	insertMention(name) {
		const t = this.$ta;
		if (!t || !name) return;
		const a = t.selectionStart ?? t.value.length;
		const b = t.selectionEnd ?? a;
		const prev = t.value.slice(0, a);
		const lead = prev && !/\s$/.test(prev) ? " " : "";
		const ins = `${lead}@${name} `;
		t.setRangeText(ins, a, b, "end");
		this.sugSkip = t.value;
		t.dispatchEvent(new Event("input"));
		this.hideSug();
		t.focus();
		this.syncFab();
	}

	msgUser(m) {
		return { id: m.user_id, name: m.name, avatar_url: m.avatar_url, verified: m.verified, acode_pro: m.acode_pro, is_admin: m.is_admin };
	}

	chatPlaceholder() {
		const c = this.state.channel;
		if (!c) return "Message";
		if (this.pend) return "Add a caption…";
		if (this.editing) return "Edit message";
		return c.kind === "dm" ? `Message @${c.name}` : `Message #${c.name}`;
	}

	addEmoji(e) {
		const t = this.$ta;
		t.setRangeText(e, t.selectionStart, t.selectionEnd, "end");
		t.dispatchEvent(new Event("input"));
	}

	// The + button: things you can add to a message.
	plusMenu() {
		const c = this.state.channel;
		if (!c) return;
		if (c.kind !== "dm" && this.isMuted(this.group)) return this.flash(`You're muted ${this.untilText(this.group.muted_until)}`);
		const inCall = !!this.voice && this.voice.slug === c.slug;
		this.sheet(
			"Add to message",
			this.item("image", "Photo", () => {
				this.closeSheet();
				this.pickPhoto();
			}, "", "Choose a picture from your gallery"),
			this.item("mic", "Voice message", () => {
				this.closeSheet();
				this.recStart();
			}, "", "Record a clip and send it"),
			this.item("headset", inCall ? "Open voice chat" : "Voice chat", () => this.voicePanel(), "", inCall ? "You're connected" : "Talk live with everyone in this chat"),
		);
	}

	// Channel / group settings: tap the channel name at the top.
	channelMenu() {
		const c = this.state.channel;
		if (!c) return;
		if (c.kind === "dm") {
			this.sheet(
				c.name,
				this.item("user", "View profile", () => this.profile(c.peer)),
				this.item("chat", "Back to messages", () => {
					this.closeSheet();
					this.showHome();
				}),
			);
			return;
		}
		const g = this.group ? this.fresh(this.group) : null;
		const info = this.chanInfo();
		this.sheet(
			`# ${c.name}`,
			g ? this.roleLine(g) : null,
			info?.topic ? this.el("div", { class: "am-sub", style: "margin:0 14px 8px", text: info.topic }) : null,
			this.item("hash", "Switch channel", () => this.channelPicker()),
			g && info && this.can(g, "manage_channels") ? this.item("sliders", "Channel settings", () => this.channelSettings(g, info), "", "Name, topic, slowmode and who can use it") : null,
			this.item("users", "Members", () => g && this.showMembers(g)),
			g ? this.copyItem("link", `Invite code: ${g.invite_code}`, g.invite_code) : null,
			...(g ? this.manageItems(g) : []),
			this.item("chat", "Home", () => {
				this.closeSheet();
				this.showHome();
			}),
			...(g ? this.dangerItems(g) : []),
		);
	}

	channelPicker() {
		const g = this.group;
		if (!g) return;
		this.sheet(
			"Channels",
			...g.channels.map((ch) =>
				this.item(ch.private ? "lock" : "hash", ch.name, () => {
					this.closeSheet();
					if (ch.slug !== this.state.channel.slug) this.openChannel({ slug: ch.slug, name: ch.name, kind: "text", group_id: g.id });
				}, "", ch.slug === this.state.channel.slug ? "Current channel" : ""),
			),
		);
	}

	async poll(first) {
		const ch = this.state.channel;
		if (!ch || !this.$page || this.view !== "chat") return;
		let more = false;
		try {
			const after = this.lastId;
			const { messages } = await this.api(`messages?channel=${encodeURIComponent(ch.slug)}&after=${after}`);
			await this.decryptMessages(ch, messages);
			if (ch !== this.state.channel) return;
			if (first && !messages.length) {
				if (this.lastId) this.$list.querySelectorAll(".am-skwrap").forEach((n) => n.remove());
				else this.chatNote("No messages yet. Say hi!");
			}
			if (messages.length) this.append(messages, first);
			more = !!after && messages.length >= 100;
		} catch (e) {
			if (first && !this.lastId) this.chatNote(`Could not load messages (${e.message}).`);
		}
		if (this.$page && this.view === "chat" && ch === this.state.channel) {
			this.syncN = (this.syncN || 0) + 1;
			if (this.syncN % 6 === 0) this.reconcile();
			this.pollTimer = setTimeout(() => this.poll(), more ? 0 : document.hidden ? 8000 : POLL_MS);
		}
	}

	saveMsgs() {
		const ch = this.state.channel;
		if (!ch) return;
		clearTimeout(this.saveT);
		this.saveT = setTimeout(() => ls.set(`am-msgs:${ch.slug}`, { at: Date.now(), list: this.msgBuf }), 800);
	}

	append(messages, forceStick) {
		const L = this.$list;
		const stick = forceStick || L.scrollHeight - L.scrollTop - L.clientHeight < 160;
		L.querySelectorAll(".am-note,.am-skwrap").forEach((n) => n.remove());
		const animate = this.lastId > 0;
		for (const m of messages) {
			if (Number(m.id) <= this.lastId) continue;
			this.lastId = Math.max(this.lastId, Number(m.id));
			if (m.deleted) continue;
			this.msgBuf.push(m);
			L.append(...this.rowNodes(m, animate));
		}
		if (this.msgBuf.length > MSG_CACHE) this.msgBuf = this.msgBuf.slice(-MSG_CACHE);
		this.saveMsgs();
		if (stick) L.scrollTop = L.scrollHeight;
	}

	// Everything one message adds to the list: an optional day divider plus the Discord-style row.
	rowNodes(m, animate) {
		const out = [];
		const t = new Date(m.created_at);
		const day = t.toDateString();
		if (day !== this.lastDay) {
			out.push(this.el("div", { class: "am-day", text: this.dayLabel(t) }));
			this.lastDay = day;
			this.lastAuthor = null;
		}
		const uid = String(m.user_id);
		const rp = this.replyOf(m);
		const cont = !rp && this.lastAuthor && this.lastAuthor.id === uid && t - this.lastAuthor.t < 7 * 60 * 1000;
		out.push(this.msgRow(m, t, cont, rp, animate));
		this.lastAuthor = { id: uid, t };
		return out;
	}

	// Finds what a message replies to: the server may send an object (m.reply) or just an id (m.reply_to).
	replyOf(m) {
		const r = m.reply && typeof m.reply === "object" ? m.reply : null;
		const id = r?.id ?? m.reply_to ?? m.reply_to_id ?? null;
		if (id == null && !r) return null;
		const src = this.msgBuf.find((x) => String(x.id) === String(id));
		const o = r || src;
		if (!o) return { id, dead: true };
		return { id, name: o.name, avatar_url: o.avatar_url, user_id: o.user_id, text: this.previewText(o), dead: !!o.deleted };
	}

	previewText(m) {
		const k = m.kind || "text";
		if (k === "image") return m.content && m.content !== "📷 Photo" ? `📷 ${m.content}` : "📷 Photo";
		if (k === "voice") return "🎤 Voice message";
		return this.plainPreview(m.content).replace(/\s+/g, " ");
	}

	msgRow(m, t, cont, rp, animate) {
		const el = this.el.bind(this);
		const own = String(m.user_id) === String(this.me.id);
		const mine = this.mentionsMe(m);
		const $row = el("div", { class: `am-row${cont ? " cont" : " first"}${rp ? " hasrp" : ""}${mine ? " mention" : ""}${animate ? " new" : ""}`, "data-id": String(m.id), "data-own": own ? "1" : "" });
		$row._m = m;
		if (rp) {
			const $rp = el("div", { class: `am-rp${rp.dead && !rp.name ? " dead" : ""}`, onclick: () => this.jumpTo(rp.id) });
			if (rp.name) $rp.append(this.avatar({ name: rp.name, avatar_url: rp.avatar_url }, 16), el("b", { text: `@${rp.name}`, style: `color:hsl(${this.hue(rp.name)} 60% 66%)` }), el("span", { text: rp.text || "" }));
			else $rp.append(el("span", { text: "Original message was deleted" }));
			$row.append($rp);
		}
		let lead;
		let head = null;
		if (cont) lead = el("div", { class: "am-sp" });
		else {
			lead = this.avatar(m, 40);
			lead.onclick = (e) => {
				e.stopPropagation();
				this.profile(this.msgUser(m), own);
			};
			const nm = el("span", { class: "am-who", text: m.name });
			nm.style.color = `hsl(${this.hue(m.name)} 60% 62%)`;
			nm.onclick = (e) => {
				e.stopPropagation();
				if (!own) this.insertMention(m.name);
			};
			head = el("div", { class: "am-mh" }, nm, ...this.badges(m), el("span", { class: "am-mt", text: t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }));
		}
		$row.append(el("div", { class: "am-mr" }, lead, el("div", { class: "am-mb" }, head, this.bubble(m, null, t, own))));
		return $row;
	}

	mentionsMe(m) {
		const n = this.me?.name;
		if (!n || String(m.user_id) === String(this.me.id) || (m.kind && m.kind !== "text")) return false;
		const r = this.replyOf(m);
		if (r && String(r.user_id) === String(this.me.id)) return true;
		return String(m.content || "").toLowerCase().includes(`@${n.toLowerCase()}`);
	}

	// Text with @mentions highlighted in blue. Names with spaces ("@Aadin Kc") are matched whole.
	// Built from nodes, never innerHTML. Tap a mention to open that person's profile.
	richInline(text) {
		const f = document.createDocumentFragment();
		const names = this.mentionNames();
		const low = text.toLowerCase();
		const word = /[\p{L}\p{N}_]/u;
		let last = 0;
		let i = 0;
		while ((i = text.indexOf("@", i)) !== -1) {
			if (i > 0 && /[\w@]/.test(text[i - 1])) {
				i++;
				continue;
			}
			let len = 0;
			for (const [n, ln] of names) {
				if (low.startsWith(ln, i + 1) && !word.test(text[i + 1 + n.length] || " ")) {
					len = n.length;
					break;
				}
			}
			if (!len) len = (/^[^\s@]{1,32}/.exec(text.slice(i + 1)) || [""])[0].length;
			if (!len) {
				i++;
				continue;
			}
			if (i > last) f.append(text.slice(last, i));
			const tok = text.slice(i, i + 1 + len);
			const who = this.findPerson(tok.slice(1));
			const $m = this.el("span", { class: `am-mn${who?.self ? " me" : ""}`, text: tok });
			if (who) {
				$m.onclick = (e) => {
					e.stopPropagation();
					this.profile(who, !!who.self);
				};
			}
			f.append($m);
			last = i + 1 + len;
			i = last;
		}
		if (last < text.length) f.append(text.slice(last));
		return f;
	}

	jumpTo(id) {
		const $r = this.$list.querySelector(`.am-row[data-id="${id}"]`);
		if (!$r) return this.flash("That message is too far back");
		$r.scrollIntoView({ block: "center", behavior: "smooth" });
		$r.classList.add("hl");
		setTimeout(() => $r.classList.remove("hl"), 1200);
	}
}
