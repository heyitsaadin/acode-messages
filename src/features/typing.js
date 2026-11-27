// "Aadin is typing" in DMs and group channels.
// While you have text in the message box, a small ping tells the server you are typing. Only the fact that you are
// typing is sent, never the text. The poll that already fetches new messages also brings back who else is typing,
// and paintTyping() shows it as animated dots plus a line of text above the message box.
const PING_MS = 3000; // while you keep typing a ping goes out this often; the server shows you as typing for about 6 s

export class TypingMethods {
	/* ---------- typing indicator ---------- */

	// Called on every keystroke; sends at most one ping per PING_MS.
	typingPing() {
		const c = this.state.channel;
		const v = this.$ta?.value || "";
		if (!c || this.view !== "chat" || this.editing || !v.trim() || v.startsWith("/")) return; // nothing to say, editing, or a /command
		if (c.kind !== "dm" && this.group && this.isMuted(this.group)) return;
		const now = Date.now();
		if (now - (this.typAt || 0) < PING_MS) return;
		this.typAt = now;
		this.api("messages", { method: "POST", body: JSON.stringify({ channel: c.slug, typing: true }) }).catch(() => {});
	}

	// list is what the server sent: [{ id, name }] of the other people typing here right now. Empty or missing hides the row.
	paintTyping(list) {
		const $t = this.$typ;
		if (!$t) return;
		const names = (Array.isArray(list) ? list : []).map((p) => String(p?.name || "").trim()).filter(Boolean);
		const key = names.join("\n");
		if (key === this.typKey) return;
		this.typKey = key;
		const L = this.$list;
		const stick = !!L && L.scrollHeight - L.scrollTop - L.clientHeight < 160; // reading the end of the chat: keep it in view
		if (names.length) {
			const text = names.length === 1 ? `${names[0]} is typing` : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : "Several people are typing";
			$t.querySelector(".tx").textContent = text;
		}
		$t.classList.toggle("show", names.length > 0);
		if (stick) L.scrollTop = L.scrollHeight;
	}
}
