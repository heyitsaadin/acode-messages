// Unread badges, Discord style. The server counts them (api/home.js): every DM, channel and group in the home data
// carries `unread`, and groups and their channels also carry `mentions` (messages that @mention you or reply to you).
// Opening a chat clears its badges at once and tells the server right away; markRead() keeps it up to date while the chat is open.
export class UnreadMethods {
	/* ---------- unread badges ---------- */

	// 1 to 99 show as they are, anything above shows as 99+
	unreadText(n) {
		return n > 99 ? "99+" : String(n);
	}

	// The red pill with the number. Nothing at all when there is nothing unread.
	unreadBadge(n, cls = "") {
		n = Number(n) || 0;
		if (n < 1) return null;
		return this.el("span", { class: `am-ub${cls ? ` ${cls}` : ""}`, text: this.unreadText(n), "aria-label": `${n} unread` });
	}

	// Everything unread across all direct messages, for the badge on the chat icon at the top of the rail.
	dmUnread() {
		return (this.state.home.dms || []).reduce((s, d) => s + (Number(d.unread) || 0), 0);
	}

	// Is the person really looking at the open chat? Not while Acode is in the background or another tab is in front.
	watching() {
		return this.view === "chat" && !this.tabBlur && !document.hidden;
	}

	// Takes one chat out of the counts in `home` (a DM, or a channel and so its group's total). True if anything changed.
	dropUnread(home, c) {
		if (!home || !c) return false;
		if (c.kind === "dm") {
			const d = (home.dms || []).find((x) => x.slug === c.slug);
			if (!d || !d.unread) return false;
			d.unread = 0;
			return true;
		}
		const g = (home.groups || []).find((x) => x.id === c.group_id);
		const ch = g?.channels?.find((x) => x.slug === c.slug);
		if (!ch || (!ch.unread && !ch.mentions)) return false;
		g.unread = Math.max(0, (g.unread || 0) - (ch.unread || 0));
		g.mentions = Math.max(0, (g.mentions || 0) - (ch.mentions || 0));
		ch.unread = 0;
		ch.mentions = 0;
		return true;
	}

	// Clears one chat's badges on screen. The rail is redrawn; the row in the list is only touched up,
	// so nothing flickers or re-decrypts. True if there was anything to clear.
	clearUnread(c) {
		if (!this.dropUnread(this.state.home, c)) return false;
		this.paintRail();
		const $row = [...(this.$plist?.querySelectorAll("[data-slug]") || [])].find((n) => n.dataset.slug === c.slug);
		if ($row) {
			$row.classList.remove("unread", "ment");
			$row.querySelectorAll(".am-ub,.am-ud,.am-um").forEach((n) => n.remove());
		}
		return true;
	}

	// A chat was just opened. If it had anything unread, say so to the server straight away: waiting for the messages
	// to load first meant that opening and leaving quickly left the badge on the server, and it came back.
	openRead(c) {
		if (this.clearUnread(c)) this.sendRead(c, 0);
	}

	// Tells the server a chat is read, up to message `upTo` or (0) up to the newest one. Resolves true or false, never fails.
	// Remembers when, so a home answer that was already on its way (and so counted the chat as unread) can be corrected.
	sendRead(c, upTo) {
		this.readAt = this.readAt || {};
		this.readAt[c.slug] = { t: Date.now(), c: { slug: c.slug, kind: c.kind, group_id: c.group_id } };
		const body = { read: true, channel: c.slug };
		if (upTo) body.up_to = upTo;
		const pend = (this.readPend = this.readPend || new Set());
		const p = this.api("messages", { method: "POST", body: JSON.stringify(body) })
			.then(() => true, () => false)
			.then((ok) => {
				pend.delete(p);
				return ok;
			});
		pend.add(p);
		return p;
	}

	// Fixes a freshly loaded home answer: the chat that is open and in front is read by definition, and so is every chat
	// that was marked read after this answer was requested (`since`), because the server may not have known yet.
	settleUnread(home, since = 0) {
		if (this.watching()) this.dropUnread(home, this.state.channel);
		for (const k of Object.keys(this.readAt || {})) {
			const r = this.readAt[k];
			if (r.t >= since) this.dropUnread(home, r.c);
			else if (Date.now() - r.t > 120000) delete this.readAt[k];
		}
	}

	// While a chat is open and in front: report it as read up to the newest message on screen, so the badges stay cleared
	// everywhere. Called after every poll; it does nothing unless there is something new to report.
	markRead() {
		const ch = this.state.channel;
		if (!ch || !this.lastId || !this.watching()) return;
		const slug = ch.slug;
		const upTo = this.lastId;
		this.readSent = this.readSent || {};
		if (this.readSent[slug] >= upTo) return;
		this.readSent[slug] = upTo;
		this.clearUnread(ch);
		this.sendRead(ch, upTo).then((ok) => {
			if (ok) {
				this.readFails = 0;
				return;
			}
			// Try again on the next poll, but give up after a few failures (an old server would refuse this every time).
			if (this.readSent[slug] !== upTo) return;
			this.readFails = (this.readFails || 0) + 1;
			if (this.readFails <= 3) delete this.readSent[slug];
		});
	}
}
