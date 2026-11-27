// Unread badges, Discord style. The server counts them (api/home.js): every DM, channel and group in the home data
// carries `unread`, and groups and their channels also carry `mentions` (messages that @mention you or reply to you).
// Opening a chat clears its badges at once; markRead() then tells the server so they stay cleared on every device.
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

	// Called as a chat opens: its badges go away straight away, without waiting for the server.
	// The rail is redrawn; the row in the list is only touched up, so nothing flickers or re-decrypts.
	clearUnread(c) {
		if (!this.dropUnread(this.state.home, c)) return;
		this.paintRail();
		const $row = [...(this.$plist?.querySelectorAll("[data-slug]") || [])].find((n) => n.dataset.slug === c.slug);
		if (!$row) return;
		$row.classList.remove("unread", "ment");
		$row.querySelectorAll(".am-ub,.am-ud,.am-um").forEach((n) => n.remove());
	}

	// Whatever the server counted for the chat that is open and in front has been read by definition.
	settleUnread(home) {
		if (this.watching()) this.dropUnread(home, this.state.channel);
	}

	// Tells the server the open chat is read up to the newest message on screen, so the badges clear everywhere.
	// Called after every poll; it does nothing unless there is something new to report.
	markRead() {
		const ch = this.state.channel;
		if (!ch || !this.lastId || !this.watching()) return;
		const slug = ch.slug;
		const upTo = this.lastId;
		this.readSent = this.readSent || {};
		if (this.readSent[slug] >= upTo) return;
		this.readSent[slug] = upTo;
		this.clearUnread(ch);
		const p = this.api("messages", { method: "POST", body: JSON.stringify({ read: true, channel: slug, up_to: upTo }) })
			.then(() => {
				this.readFails = 0;
			})
			.catch(() => {
				// Try again on the next poll, but give up after a few failures (an old server would refuse this every time).
				if (this.readSent[slug] !== upTo) return;
				this.readFails = (this.readFails || 0) + 1;
				if (this.readFails <= 3) delete this.readSent[slug];
			})
			.then(() => {
				if (this.readP === p) this.readP = null;
			});
		this.readP = p;
	}
}
