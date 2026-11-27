// Reactions on messages. Press and hold a message, tap an emoji, and everyone in the chat sees a little pill with that
// emoji and a count under the message. Tap a pill to add your own or take it back.
// The server only accepts a short fixed list of emoji, so REACTIONS has to match the one in api/messages.js.
export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

const noVS = (s) => String(s).replace(/\uFE0F/g, ""); // ❤ and ❤️ are the same reaction

export class ReactionsMethods {
	/* ---------- reactions ---------- */

	// What is known about the chat that is open: { slug, map: { [messageId]: [{ e, n, me }] }, pend: { [messageId]: taps not answered yet } }
	rxState() {
		const slug = this.state.channel?.slug;
		if (!this.rx || this.rx.slug !== slug) this.rx = { slug, map: {}, pend: {}, n: 0 };
		return this.rx;
	}

	// Draws, redraws or removes the pills under one message row.
	paintReactRow($row) {
		const $mb = $row?.querySelector?.(".am-mb");
		if (!$mb) return;
		const list = this.rxState().map[$row.dataset.id] || [];
		let $bar = $mb.querySelector(".am-rx");
		if (!list.length) {
			$bar?.remove();
			return;
		}
		const sig = list.map((r) => `${r.e}${r.n}${r.me ? "*" : ""}`).join("|");
		if ($bar && $bar.dataset.sig === sig) return;
		if (!$bar) {
			$bar = this.el("div", { class: "am-rx" });
			$mb.append($bar);
		}
		$bar.dataset.sig = sig;
		$bar.replaceChildren(
			...list.map((r) =>
				this.el(
					"button",
					{
						class: `am-rc${r.me ? " on" : ""}`,
						onclick: (e) => {
							e.stopPropagation();
							const m = $row._m;
							if (m) this.rxSet(m, r.e, !r.me);
						},
					},
					this.el("span", { class: "e", text: r.e }),
					this.el("span", { class: "n", text: String(r.n) }),
				),
			),
		);
	}

	// Redraws the pills of the given messages and keeps the chat at the bottom if you were reading the end of it.
	rxRepaint(ids) {
		const L = this.$list;
		if (!L) return;
		const stick = L.scrollHeight - L.scrollTop - L.clientHeight < 160;
		for (const id of ids) this.paintReactRow(L.querySelector(`.am-row[data-id="${id}"]`));
		if (stick) L.scrollTop = L.scrollHeight;
	}

	// Called after every message poll. Asks for the reactions on the first poll of a chat, then every other poll.
	rxTick() {
		if (this.rxOff) return;
		const rx = this.rxState();
		rx.n += 1;
		if (!rx.got || rx.n % 2 === 0) this.rxPull();
	}

	// Reads the reactions of the recent messages from the server and updates whatever changed.
	async rxPull() {
		const ch = this.state.channel;
		if (!ch || !this.$page || this.view !== "chat" || this.rxBusy) return;
		this.rxBusy = true;
		try {
			const res = await this.api(`messages?channel=${encodeURIComponent(ch.slug)}&reactions=1`);
			if (ch !== this.state.channel) return;
			if (!res || typeof res.reactions !== "object" || !res.reactions) {
				if (res && !("reactions" in res)) this.rxOff = true; // an older server: stop asking and hide the emoji row
				return;
			}
			const rx = this.rxState();
			rx.got = true;
			const changed = new Set();
			for (const id of new Set([...Object.keys(rx.map), ...Object.keys(res.reactions)])) {
				if (rx.pend[id]) continue; // I am in the middle of changing this one: what is on screen stays until the server has caught up
				const next = res.reactions[id] || [];
				if (JSON.stringify(next) !== JSON.stringify(rx.map[id] || [])) changed.add(id);
				if (next.length) rx.map[id] = next;
				else delete rx.map[id];
			}
			if (changed.size) this.rxRepaint(changed);
		} catch {
			// offline or a hiccup: the next poll tries again
		} finally {
			this.rxBusy = false;
		}
	}

	// Adds (on = true) or takes back (on = false) my reaction. The pill changes at once; if the server says no it goes back.
	rxSet(m, emoji, on) {
		const ch = this.state.channel;
		if (!ch || !m || m._tmp) return;
		if (ch.kind !== "dm" && this.group && this.isMuted(this.group)) return this.flash(`You're muted ${this.untilText(this.group.muted_until)}`);
		const e = REACTIONS.find((r) => noVS(r) === noVS(emoji));
		if (!e) return;
		const rx = this.rxState();
		const id = String(m.id);
		const before = rx.map[id] || [];
		const had = !!before.find((r) => r.e === e)?.me;
		if (on === undefined) on = !had;
		if (on === had) return;
		let after = before.map((r) => ({ ...r }));
		const t = after.find((r) => r.e === e);
		if (on) {
			if (t) {
				t.n += 1;
				t.me = true;
			} else after.push({ e, n: 1, me: true });
		} else if (t) {
			t.n -= 1;
			t.me = false;
			after = after.filter((r) => r.n > 0);
		}
		if (after.length) rx.map[id] = after;
		else delete rx.map[id];
		rx.pend[id] = (rx.pend[id] || 0) + 1;
		this.rxRepaint([id]);
		// One request at a time, in the order of the taps, so quick taps can't overtake each other.
		this.rxQ = (this.rxQ || Promise.resolve()).then(async () => {
			let ok = true;
			try {
				const r = await this.api("messages", { method: "POST", body: JSON.stringify({ react: true, channel: ch.slug, message_id: m.id, emoji: e, on }) });
				rx.pend[id] -= 1;
				if (!rx.pend[id] && Array.isArray(r?.reactions)) {
					if (r.reactions.length) rx.map[id] = r.reactions;
					else delete rx.map[id];
				}
			} catch (err) {
				ok = false;
				rx.pend[id] -= 1;
				if (before.length) rx.map[id] = before;
				else delete rx.map[id];
				const msg = /bad content/i.test(err.message) ? "Reactions need a server update" : err.message;
				this.flash(`Couldn't react (${msg})`);
			}
			if (this.rx === rx && (ok || !rx.pend[id])) this.rxRepaint([id]);
		});
	}

	// The row of emoji at the top of the long-press menu. Tap one to react; tap one you already used to take it back.
	rxQuick(m, close) {
		const mine = new Set((this.rxState().map[String(m.id)] || []).filter((r) => r.me).map((r) => r.e));
		return this.el(
			"div",
			{ class: "am-rxq" },
			...REACTIONS.map((e) => this.el("button", { class: mine.has(e) ? "on" : "", text: e, onclick: close(() => this.rxSet(m, e, !mine.has(e))) })),
		);
	}
}
