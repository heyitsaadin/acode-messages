import { PHOTO_B64_MAX } from "../constants.js";

export class PhotosMethods {
	/* ---------- photos ---------- */

	pickPhoto() {
		const c = this.state.channel;
		if (!c) return;
		if (c.kind !== "dm" && (this.isMuted(this.group) || this.chanInfo()?.can_send === false)) return this.syncMute();
		const $f = document.createElement("input");
		$f.type = "file";
		$f.accept = "image/*";
		$f.style.display = "none";
		$f.onchange = async () => {
			const f = $f.files?.[0];
			$f.remove();
			if (!f) return;
			try {
				this.setPending(await this.prepPhoto(f));
			} catch (e) {
				this.flash(e.message || "Could not read that picture");
			}
		};
		this.$root.append($f);
		$f.click();
	}

	// Scale down (long side 1280) and squeeze under the server's limit. Transparent areas become white.
	prepPhoto(file) {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				URL.revokeObjectURL(url);
				try {
					let max = 1280;
					for (let attempt = 0; attempt < 5; attempt++) {
						const k = Math.min(1, max / Math.max(img.width, img.height));
						const W = Math.max(1, Math.round(img.width * k));
						const H = Math.max(1, Math.round(img.height * k));
						const c = document.createElement("canvas");
						c.width = W;
						c.height = H;
						const cx = c.getContext("2d");
						cx.fillStyle = "#fff";
						cx.fillRect(0, 0, W, H);
						cx.drawImage(img, 0, 0, W, H);
						for (const q of [0.82, 0.7, 0.58, 0.46]) {
							const out = c.toDataURL("image/jpeg", q);
							const b64 = out.slice(out.indexOf(",") + 1);
							if (b64.length <= PHOTO_B64_MAX) return resolve({ b64, w: W, h: H, url: out });
						}
						max = Math.round(max * 0.75);
					}
					reject(new Error("That picture is too large"));
				} catch (e) {
					reject(e);
				}
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error("Could not read that picture"));
			};
			img.src = url;
		});
	}

	// A picked photo waits in a small tray above the message box, so a caption can be added before sending.
	setPending(p) {
		this.pend = p;
		this.put(
			this.$pend,
			this.el("img", { src: p.url, alt: "" }),
			this.el("div", { class: "tx", text: "Photo ready. Add a caption or just send it." }),
			this.el("button", { class: "am-btn", onclick: () => this.clearPending() }, this.ico("close", 20)),
		);
		this.$pend.classList.add("show");
		this.syncMute();
		this.syncFab();
	}

	clearPending() {
		this.pend = null;
		this.$pend?.classList.remove("show");
		this.syncMute();
		this.syncFab();
	}

	viewImage(src) {
		const $v = this.el("div", { class: "am-view", onclick: () => $v.remove() }, this.el("img", { src, alt: "" }), this.el("button", { class: "am-btn x" }, this.ico("close", 26)));
		this.$root.append($v);
	}

	// The body of one message, Discord style: plain text, a photo or a voice clip (no bubble).
	bubble(m, who, t, own) {
		const el = this.el.bind(this);
		const kind = m.kind || "text";
		if (kind === "image" && m.media_url) {
			const cap = m.content && m.content !== "📷 Photo" ? m.content : "";
			const ratio = m.w && m.h ? Math.min(2, Math.max(0.6, m.w / m.h)) : 1;
			const $i = el("img", { class: "am-img", alt: "Photo", loading: "lazy", style: `aspect-ratio:${ratio}` });
			$i.onload = () => {
				const L = this.$list;
				if (L && L.scrollHeight - L.scrollTop - L.clientHeight < 500) L.scrollTop = L.scrollHeight;
			};
			$i.onerror = () => $i.replaceWith(el("div", { class: "am-imgx", text: "Photo unavailable" }));
			$i.onclick = () => this.viewImage($i.src);
			$i.src = this.bannerSrc(m.media_url);
			return el("div", { class: "am-mc" }, cap ? el("div", {}, this.richText(cap)) : null, el("div", { class: "am-imgw" }, $i));
		}
		if (kind === "voice" && m.media_url) return el("div", { class: "am-mc" }, this.voiceMsg(m));
		const $c = el("div", { class: "am-mc" }, this.richText(String(m.content || "")));
		if (m.edited_at || m.edited) $c.append(el("span", { class: "am-ed", text: "(edited)" }));
		return $c;
	}
}
