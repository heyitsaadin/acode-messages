// A full-screen "move and zoom" screen for choosing which part of a picture is used.
// Shows the picture under a frame with the shape of the result (a circle for square pictures like
// profile and group icons, a wide rectangle for banners). Drag to move, pinch or use the slider to zoom.
export class CropperMethods {
	/* ---------- picture cropper ---------- */

	// img: a loaded Image. W, H: the size of the picture to produce (only its shape is used here).
	// Resolves with the chosen part of the image { sx, sy, sw, sh }, in the image's own pixels.
	// Rejects with an error that has .cancelled = true if the person backs out.
	cropPicture(img, W, H) {
		return new Promise((resolve, reject) => {
			const el = this.el.bind(this);
			const iw = img.naturalWidth || img.width;
			const ih = img.naturalHeight || img.height;
			const round = W === H;

			const $img = document.createElement("img");
			$img.alt = "";
			$img.draggable = false;
			$img.src = img.src;
			$img.style.width = `${iw}px`;
			$img.style.height = `${ih}px`;
			const $frame = el("div", { class: `am-crop-frame${round ? " round" : ""}` });
			const $stage = el("div", { class: "am-crop-stage" }, $img, $frame);
			const $zoom = el("input", { type: "range", min: "1", max: "6", step: "0.01", value: "1", "aria-label": "Zoom" });

			// frame (fx, fy, fw, fh) and picture position (ox, oy, scale s), all in stage pixels
			let fx = 0;
			let fy = 0;
			let fw = 0;
			let fh = 0;
			let min = 1;
			let s = 1;
			let ox = 0;
			let oy = 0;
			let ready = false;

			const clamp = () => {
				s = Math.min(Math.max(s, min), min * 6);
				ox = Math.min(fx, Math.max(fx + fw - iw * s, ox));
				oy = Math.min(fy, Math.max(fy + fh - ih * s, oy));
			};
			const paint = () => {
				$img.style.transform = `translate(${ox}px,${oy}px) scale(${s})`;
				$zoom.value = String(s / min);
			};
			const zoomAt = (ns, px, py) => {
				ns = Math.min(Math.max(ns, min), min * 6);
				ox = px - (px - ox) * (ns / s);
				oy = py - (py - oy) * (ns / s);
				s = ns;
				clamp();
				paint();
			};
			const layout = () => {
				const r = $stage.getBoundingClientRect();
				if (!r.width || !r.height) return false;
				const a = W / H;
				fw = Math.min(r.width - 32, (r.height - 32) * a);
				fh = fw / a;
				fx = (r.width - fw) / 2;
				fy = (r.height - fh) / 2;
				Object.assign($frame.style, { left: `${fx}px`, top: `${fy}px`, width: `${fw}px`, height: `${fh}px` });
				min = Math.max(fw / iw, fh / ih);
				s = min;
				ox = fx + (fw - iw * s) / 2;
				oy = fy + (fh - ih * s) / 2;
				clamp();
				paint();
				ready = true;
				return true;
			};

			// drag with one finger, pinch with two
			const ptrs = new Map();
			let pinch = 0;
			$stage.addEventListener("pointerdown", (e) => {
				try {
					$stage.setPointerCapture(e.pointerId);
				} catch {}
				ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
				pinch = 0;
			});
			$stage.addEventListener("pointermove", (e) => {
				const p = ptrs.get(e.pointerId);
				if (!p || !ready) return;
				if (ptrs.size === 1) {
					ox += e.clientX - p.x;
					oy += e.clientY - p.y;
					p.x = e.clientX;
					p.y = e.clientY;
					clamp();
					paint();
					return;
				}
				p.x = e.clientX;
				p.y = e.clientY;
				if (ptrs.size === 2) {
					const [a, b] = [...ptrs.values()];
					const d = Math.hypot(a.x - b.x, a.y - b.y);
					const r = $stage.getBoundingClientRect();
					if (pinch && d) zoomAt((s * d) / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
					pinch = d;
				}
			});
			const lift = (e) => {
				ptrs.delete(e.pointerId);
				pinch = 0;
			};
			$stage.addEventListener("pointerup", lift);
			$stage.addEventListener("pointercancel", lift);
			$stage.addEventListener(
				"wheel",
				(e) => {
					e.preventDefault();
					const r = $stage.getBoundingClientRect();
					zoomAt(s * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
				},
				{ passive: false },
			);
			$zoom.addEventListener("input", () => zoomAt(min * Number($zoom.value), fx + fw / 2, fy + fh / 2));

			const close = () => {
				this.cropCancel = null;
				$crop.remove();
			};
			const cancel = () => {
				close();
				reject(Object.assign(new Error("cancelled"), { cancelled: true }));
			};
			const done = () => {
				if (!ready) return;
				const w = Math.min(fw / s, iw);
				const h = Math.min(fh / s, ih);
				const sx = Math.max(0, Math.min((fx - ox) / s, iw - w));
				const sy = Math.max(0, Math.min((fy - oy) / s, ih - h));
				close();
				resolve({ sx, sy, sw: w, sh: h });
			};
			this.cropCancel = cancel; // the phone's back button cancels the cropper

			const minus = el("span", { class: "z", text: "−" });
			const plus = el("span", { class: "z", text: "+" });
			const $crop = el(
				"div",
				{ class: "am-crop" },
				el("div", { class: "am-crop-top" }, el("button", { class: "am-btn", onclick: cancel }, this.ico("close", 24)), el("b", { text: "Move and zoom" }), el("button", { class: "am-crop-ok", text: "Done", onclick: done })),
				$stage,
				el("div", { class: "am-crop-hint", text: "Drag to move, pinch to zoom" }),
				el("div", { class: "am-crop-bot" }, minus, $zoom, plus),
			);
			this.$root.append($crop);

			// the stage has no size until it is on screen, so lay it out on the next frames
			let tries = 0;
			const start = () => {
				if (!layout() && tries++ < 30) requestAnimationFrame(start);
			};
			requestAnimationFrame(start);
		});
	}
}
