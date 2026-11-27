import { MSG_CACHE } from "../constants.js";

// Sending text without waiting for the server. The message shows up straight away, dimmed, and turns
// normal once the server has it. If the server refuses it, the row turns red and a tap retries.
// Only plain text typed in the message box goes through here; photos, voice clips and shared files
// still wait for the server (see postMessage).
export class OutboxMethods {
	/* ---------- optimistic text sends ---------- */

	outQueue(content) {
		const ch = this.state.channel;
		if (!ch || this.view !== "chat") return;
		const replied = this.replyTo;
		const job = { ch, content, replied, tmpId: `tmp${(this.outN = (this.outN || 0) + 1)}`, started: false, done: false, failed: false };
		job.$row = this.outRow(this.outMessage(job));
		this.playSendSound();
		// the box is free again straight away
		this.clearCtx();
		this.$ta.value = "";
		this.$ta.style.height = "48px";
		this.typAt = 0; // the next message you type shows as "typing" right away
		this.syncFab();
		if (!this.outbox) this.outbox = [];
		this.outbox.push(job);
		this.outRun(job);
	}

	// What the row shows before the server has answered, built from my own details.
	outMessage(job) {
		const me = this.me;
		const mine = [...(this.msgBuf || [])].reverse().find((x) => String(x.user_id) === String(me.id));
		return {
			id: job.tmpId,
			_tmp: true,
			user_id: me.id,
			name: me.name,
			avatar_url: me.avatar_url,
			avatar_decoration: me.avatar_decoration,
			verified: me.verified ?? mine?.verified,
			acode_pro: me.acode_pro ?? mine?.acode_pro,
			is_admin: me.is_admin ?? mine?.is_admin,
			is_plugin_admin: me.is_plugin_admin ?? mine?.is_plugin_admin,
			kind: "text",
			content: job.content,
			reply_to: job.replied ? job.replied.id : null,
			created_at: new Date().toISOString(),
		};
	}

	outRow(m) {
		const L = this.$list;
		L.querySelectorAll(".am-note,.am-skwrap").forEach((n) => n.remove());
		const nodes = this.rowNodes(m, true);
		const $row = nodes[nodes.length - 1];
		$row.classList.add("sending");
		L.append(...nodes);
		L.scrollTop = L.scrollHeight;
		return $row;
	}

	// Messages go out one at a time, in the order they were typed.
	outRun(job) {
		const go = () => this.outSend(job);
		this.outChain = (this.outChain || Promise.resolve()).then(go, go);
	}

	async outSend(job) {
		if (job.done) return;
		job.started = true;
		job.failed = false;
		const { ch, content, replied } = job;
		try {
			const wire = await this.e2eWire(ch, content); // DMs go out as an encrypted envelope
			const { message } = await this.api("messages", {
				method: "POST",
				body: JSON.stringify({ channel: ch.slug, content: wire, ...(replied ? { reply_to: replied.id } : {}) }),
			});
			await this.decryptMessages(ch, [message]);
			if (replied && message.reply_to == null && !message.reply && message.reply_to_id == null) message.reply_to = replied.id;
			this.outSettle(job, message);
		} catch (e) {
			job.started = false;
			this.outFail(job, e);
		}
	}

	// The server has the message: the dimmed row becomes a normal one, in the same place.
	outSettle(job, m) {
		if (job.done) return;
		job.done = true;
		this.outbox = (this.outbox || []).filter((j) => j !== job);
		const $r = job.$row;
		if (!$r?.isConnected) return; // the chat was closed meanwhile; opening it again loads the message
		if (this.$list.querySelector(`.am-row[data-id="${m.id}"]`)) {
			// the poll already drew the real row
			$r.remove();
			this.relast();
			return;
		}
		$r.dataset.id = String(m.id);
		$r._m = m;
		$r.classList.remove("sending", "failed");
		$r.querySelector(".am-fail")?.remove();
		const t = new Date(m.created_at);
		const $t = $r.querySelector(".am-mt");
		if ($t) $t.textContent = t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
		if (String(m.content) !== job.content) {
			const $mc = $r.querySelector(".am-mc");
			if ($mc) $mc.replaceWith(this.bubble(m, null, t, true));
		}
		this.lastId = Math.max(this.lastId, Number(m.id));
		this.msgBuf.push(m);
		if (this.msgBuf.length > MSG_CACHE) this.msgBuf = this.msgBuf.slice(-MSG_CACHE);
		this.saveMsgs();
	}

	// A message of mine that the poll brought back while its row was still waiting: that row becomes the real one.
	outAdopt(m) {
		if (!this.outbox?.length || String(m.user_id) !== String(this.me.id) || (m.kind && m.kind !== "text")) return false;
		const job = this.outbox.find((j) => !j.done && (j.started || j.failed) && j.content === m.content && j.$row?.isConnected);
		if (!job) return false;
		this.outSettle(job, m);
		return true;
	}

	outFail(job, e) {
		if (job.done) return;
		job.failed = true;
		const $r = job.$row;
		if ($r?.isConnected) {
			$r.classList.remove("sending");
			$r.classList.add("failed");
			if (!$r.querySelector(".am-fail")) {
				$r.querySelector(".am-mb")?.append(this.el("button", { class: "am-fail", text: "Not sent. Tap to retry", onclick: () => this.outRetry(job) }));
			}
		}
		this.flash(`Message not sent (${e.message})`);
		if (/muted/i.test(e.message)) this.refreshHome().then(() => this.syncMute());
	}

	outRetry(job) {
		if (job.done || !job.failed) return;
		job.failed = false;
		const $r = job.$row;
		$r?.classList.remove("failed");
		$r?.classList.add("sending");
		$r?.querySelector(".am-fail")?.remove();
		this.outRun(job);
	}

	outDiscard(job) {
		job.done = true;
		this.outbox = (this.outbox || []).filter((j) => j !== job);
		const $r = job.$row;
		if (!$r?.isConnected) return;
		const $n = $r.nextElementSibling;
		const wasFirst = $r.classList.contains("first");
		$r.remove();
		if (wasFirst && $n?.classList?.contains("cont")) this.promote($n);
		this.relast();
	}

	// Long press on a row that has not reached the server: only a failed one has anything to offer.
	outMenu($r) {
		const job = (this.outbox || []).find((j) => j.$row === $r);
		if (!job || !job.failed) {
			$r.classList.remove("hl");
			return;
		}
		const close = (fn) => () => {
			this.closeSheet();
			$r.classList.remove("hl");
			fn();
		};
		this.sheet(
			"",
			this.el("div", { class: "am-mhint", text: "This message wasn't sent" }),
			this.el("div", { class: "am-mg" }, this.item("reply", "Retry", close(() => this.outRetry(job))), this.item("copy", "Copy Text", close(() => this.copy(job.content)))),
			this.el("div", { class: "am-mg" }, this.item("trash", "Delete Message", close(() => this.outDiscard(job)), "danger")),
		);
		const off = setInterval(() => {
			if (!this.$sheet?.classList.contains("open")) {
				$r.classList.remove("hl");
				clearInterval(off);
			}
		}, 250);
	}
}
