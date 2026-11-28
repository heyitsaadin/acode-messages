import { DECO_LIMITS, cleanDecoName, decoInfo, decoProblem } from "../deco-image.js";

// The decoration shop: community-made pictures that frame a profile picture, free for now.
// The server side is lib/shop.js in acode-messages-server (reached as /api/shop). Equipping one goes through POST /api/me.
// Every file in src/ is bundled into one scope, so the top-level names here start with "shop".

// The template picture (transparent 288x288 PNG) lives in the repo at project/decoration-template.png.
const SHOP_TEMPLATE = "https://raw.githubusercontent.com/heyitsaadin/acode-messages/main/project/decoration-template.png";
const SHOP_STILLS = 120; // first frames kept in memory

const shopReadBytes = (file) =>
	new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(new Uint8Array(r.result));
		r.onerror = () => reject(new Error("Could not read that file."));
		r.readAsArrayBuffer(file);
	});

const shopBase64 = (b) => {
	let s = "";
	for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
	return btoa(s);
};

export class ShopMethods {
	/* ---------- decoration pictures ---------- */

	// The picture laid over an avatar. styles.css sizes it at 120% of the avatar: the 288px picture has the 240px circle in the middle.
	decoLayer(src) {
		const $d = this.el("span", { class: "am-deco-img" });
		$d.style.backgroundImage = `url("${this.bannerSrc(src)}")`;
		return $d;
	}

	// Where a shop item's picture lives. Unapproved ones (your own, or in the review queue) are found by their secret token.
	shopImg(item) {
		if (typeof item.token === "string" && /^[0-9a-f-]{36}$/.test(item.token)) return `/api/shop?img=${item.token}`;
		return `/api/shop?deco=${Number(item.id)}`;
	}

	// The first frame of a picture as a still image, so a grid of animated decorations stays calm and light.
	// Calls done(dataUrl), or done(null) when it can't be made (the caller then just shows the live picture).
	shopStill(src, done) {
		const keep = src.startsWith("/");
		if (!this.shopStills) this.shopStills = new Map();
		if (keep && this.shopStills.has(src)) return done(this.shopStills.get(src));
		const im = new Image();
		im.crossOrigin = "anonymous";
		im.onload = () => {
			let out = null;
			try {
				const c = document.createElement("canvas");
				c.width = im.naturalWidth || 288;
				c.height = im.naturalHeight || 288;
				c.getContext("2d").drawImage(im, 0, 0);
				out = c.toDataURL("image/png");
			} catch {}
			if (keep) {
				this.shopStills.set(src, out);
				if (this.shopStills.size > SHOP_STILLS) this.shopStills.delete(this.shopStills.keys().next().value);
			}
			done(out);
		};
		im.onerror = () => done(null);
		im.src = this.bannerSrc(src);
	}

	// Your own avatar with a decoration picture on it. Animated ones show their first frame until you tap the little play button.
	shopPreview(src, animated, size, key) {
		const el = this.el.bind(this);
		const $a = this.avatar({ name: this.me.name, avatar_url: this.me.avatar_url }, size);
		$a.dataset.deco = key; // only so the picture may stick out past the avatar's circle
		const $layer = this.decoLayer(src);
		$a.append($layer);
		const $pv = el("div", { class: "am-shop-pv" }, $a);
		if (!animated) return $pv;
		const live = $layer.style.backgroundImage;
		let playing = false;
		const still = () =>
			this.shopStill(src, (s) => {
				if (!playing) $layer.style.backgroundImage = s ? `url("${s}")` : live;
			});
		$layer.style.backgroundImage = "none";
		still();
		const $btn = el("button", { class: "am-shop-an", type: "button", "aria-label": "Play or pause the animation", text: "\u25B6" });
		$btn.onclick = () => {
			playing = !playing;
			$btn.textContent = playing ? "\u25A0" : "\u25B6";
			if (playing) $layer.style.backgroundImage = live;
			else still();
		};
		$pv.append($btn);
		return $pv;
	}

	/* ---------- the shop page (Shop button on your profile) ---------- */

	shopPage() {
		const el = this.el.bind(this);
		const ui = (this.shopUi = { $tabs: el("div", { class: "am-shop-tabs" }), $msg: el("div"), $body: el("div") });
		if (this.shopTab !== "mine" && !(this.shopTab === "review" && this.shopAdmin)) this.shopTab = "browse";
		const note = this.shopNote;
		this.shopNote = "";
		this.shopPaintTabs();
		if (note) this.shopSay(note, true);
		this.shopShow(this.shopTab);
		return [ui.$tabs, ui.$msg, ui.$body];
	}

	shopPaintTabs() {
		const ui = this.shopUi;
		if (!ui) return;
		const tabs = [["browse", "Browse"], ["mine", "Mine"]];
		if (this.shopAdmin) tabs.push(["review", "Review"]);
		this.put(
			ui.$tabs,
			...tabs.map(([k, label]) => this.el("button", { class: `am-shop-tab${this.shopTab === k ? " on" : ""}`, type: "button", text: label, onclick: () => this.shopShow(k) })),
		);
	}

	// A line under the tabs: red for a problem, plain for good news. Empty text clears it.
	shopSay(text, good) {
		const $m = this.shopUi?.$msg;
		if (!$m) return;
		$m.textContent = text || "";
		$m.className = text ? (good ? "am-snote" : "am-ferr") : "";
	}

	async shopShow(tab) {
		const ui = this.shopUi;
		if (!ui) return;
		this.shopTab = tab;
		this.shopPaintTabs();
		this.shopSay("");
		if (this.shopCache?.[tab]) this.shopRender();
		else {
			const card = () => this.el("div", { class: "am-shop-card" }, this.sk(64, 64, 32), this.sk("70%", 12, 6), this.sk("50%", 10, 6));
			this.put(ui.$body, this.el("div", { class: "am-shop-grid" }, card(), card(), card(), card()));
		}
		const path = tab === "mine" ? "shop?view=mine" : tab === "review" ? "shop?view=pending" : "shop?sort=new&limit=60";
		try {
			const data = await this.api(path, { cache: "no-store" });
			if (this.shopUi !== ui || this.shopTab !== tab) return;
			this.shopCache = { ...(this.shopCache || {}), [tab]: data };
			if (typeof data.admin === "boolean" && data.admin !== this.shopAdmin) {
				this.shopAdmin = data.admin;
				this.shopPaintTabs();
			}
			this.shopRender();
		} catch (e) {
			if (this.shopUi !== ui || this.shopTab !== tab) return;
			if (!this.shopCache?.[tab]) this.put(ui.$body);
			this.shopSay(/HTTP 404/.test(e.message) ? "Your server doesn't have the shop yet. Update acode-messages-server first." : e.message);
		}
	}

	// Runs one action, shows any error under the tabs, then redraws from what is cached.
	async shopDo(fn) {
		this.shopSay("");
		try {
			await fn();
		} catch (e) {
			this.shopSay(e.message);
		}
		this.shopRender();
	}

	shopRender() {
		const ui = this.shopUi;
		const data = this.shopCache?.[this.shopTab];
		if (!ui || !data) return;
		const el = this.el.bind(this);
		const grid = (items, make) => el("div", { class: "am-shop-grid" }, ...items.map(make));
		const empty = (title, text) => el("div", { class: "am-empty" }, el("span", { class: "ring" }, this.ico("shop", 40)), el("b", { text: title }), el("span", { class: "t", text }));
		const create = () => el("div", { class: "am-shop-top" }, el("button", { class: "am-pillb", type: "button", text: "+ Create a decoration", onclick: () => this.pfsOpen("shopnew") }));
		const api = (body) => this.api("shop", { method: "POST", body: JSON.stringify(body) });

		if (this.shopTab === "browse") {
			const takeDown = (it) =>
				this.shopDo(async () => {
					await api({ action: "review", id: it.id, approve: false, reason: "Taken down" });
					data.items = data.items.filter((x) => x.id !== it.id);
				});
			const out = [create()];
			if (!data.items.length) out.push(empty("Nothing here yet", "Be the first to make a decoration for everyone to use."));
			else out.push(grid(data.items, (it) => this.shopCardEl(it, this.shopUseBtn(it), this.shopAdmin ? this.shopSureBtn("Take down", "Tap again to confirm", () => takeDown(it)) : null)));
			if (data.more) {
				out.push(
					el("div", { class: "am-shop-top" }, el("button", {
						class: "am-pillb",
						type: "button",
						text: "Show more",
						onclick: () =>
							this.shopDo(async () => {
								const d = await this.api(`shop?sort=new&limit=60&offset=${data.items.length}`, { cache: "no-store" });
								data.items.push(...d.items);
								data.more = !!d.more;
							}),
					})),
				);
			}
			this.put(ui.$body, ...out);
			return;
		}

		if (this.shopTab === "mine") {
			const remove = (it) =>
				this.shopDo(async () => {
					await api({ action: "remove", id: it.id });
					data.created = data.created.filter((x) => x.id !== it.id);
					data.owned = data.owned.filter((x) => x.id !== it.id);
					if (this.shopCache) delete this.shopCache.browse;
					if (this.me.avatar_decoration === it.key) this.state.user = { ...this.state.user, avatar_decoration: null };
				});
			const out = [create(), this.pfsLabel("Your collection")];
			if (this.me.avatar_decoration) {
				out.push(el("div", { class: "am-shop-top" }, el("button", { class: "am-pillb danger", type: "button", text: "Remove current decoration", onclick: () => this.shopDo(() => this.shopEquip(null)) })));
			}
			if (data.owned.length) out.push(grid(data.owned, (it) => this.shopCardEl(it, this.shopUseBtn(it))));
			else out.push(this.pfsNote("Decorations you get from the shop show up here."));
			if (data.created.length) {
				const status = (it) => (it.status === "approved" ? "Live in the shop" : it.status === "pending" ? "Waiting for review" : `Rejected${it.reason ? `: ${it.reason}` : ""}`);
				out.push(
					this.pfsLabel("Submitted by you"),
					grid(data.created, (it) =>
						this.shopCardEl(it, el("small", { class: `am-shop-st ${it.status}`, text: status(it) }), it.status === "approved" ? this.shopUseBtn(it) : null, this.shopSureBtn("Delete", "Tap again to delete", () => remove(it))),
					),
				);
			}
			this.put(ui.$body, ...out);
			return;
		}

		// Review queue (plugin admin only).
		const review = (it, approve, reason) =>
			this.shopDo(async () => {
				await api({ action: "review", id: it.id, approve, reason });
				data.items = data.items.filter((x) => x.id !== it.id);
				if (this.shopCache) delete this.shopCache.browse;
			});
		if (!data.items.length) return this.put(ui.$body, empty("Nothing waiting", "New decorations show up here to be approved."));
		this.put(
			ui.$body,
			grid(data.items, (it) => {
				const $why = el("input", { class: "am-inp", placeholder: "Reason if rejecting (optional)", maxlength: "160", style: "margin:6px 0 0;width:100%" });
				return this.shopCardEl(
					it,
					$why,
					el("div", { class: "am-shop-row" }, el("button", { class: "am-pillb", type: "button", text: "Approve", onclick: () => review(it, true) }), el("button", { class: "am-pillb danger", type: "button", text: "Reject", onclick: () => review(it, false, $why.value.trim()) })),
				);
			}),
		);
	}

	shopCardEl(item, ...kids) {
		const el = this.el.bind(this);
		const by = `by ${item.creator?.name || "someone"}`;
		return el(
			"div",
			{ class: `am-shop-card${this.me.avatar_decoration === item.key ? " on" : ""}` },
			this.shopPreview(this.shopImg(item), item.animated, 64, item.key),
			el("b", { text: item.name }),
			el("small", { text: item.animated ? `${by} \u00B7 animated` : by }),
			...kids,
		);
	}

	// Get it (free) -> Equip -> Unequip.
	shopUseBtn(item) {
		const on = this.me.avatar_decoration === item.key;
		const free = !(item.price > 0);
		const $b = this.el("button", { class: `am-pillb${on ? " danger" : ""}`, type: "button", text: !item.owned ? (free ? "Get it free" : "Not available") : on ? "Unequip" : "Equip" });
		if (!item.owned && !free) $b.disabled = true;
		$b.onclick = () =>
			this.shopDo(async () => {
				if (!item.owned) {
					await this.api("shop", { method: "POST", body: JSON.stringify({ action: "claim", id: item.id }) });
					item.owned = true;
					item.claims = (item.claims || 0) + 1;
					if (this.shopCache) delete this.shopCache.mine; // reload your collection next time
				} else await this.shopEquip(on ? null : item.key);
			});
		return $b;
	}

	// A button that needs a second tap within 3 seconds, for things that can't be undone.
	shopSureBtn(label, sure, run) {
		const $b = this.el("button", { class: "am-pillb danger", type: "button", text: label });
		let armed = false;
		let timer = 0;
		$b.onclick = () => {
			if (!armed) {
				armed = true;
				$b.textContent = sure;
				timer = setTimeout(() => {
					armed = false;
					$b.textContent = label;
				}, 3000);
				return;
			}
			clearTimeout(timer);
			$b.disabled = true;
			run();
		};
		return $b;
	}

	// Put a decoration on (key like "d12") or take it off (null). The server checks you own it.
	async shopEquip(key) {
		const { user: nu } = await this.api("me", { method: "POST", body: JSON.stringify({ decoration: key }) });
		this.applyMe(nu);
		this.paintHome();
		this.refreshHome();
	}

	/* ---------- the template page (a settings page, so it has the back arrow) ---------- */

	shopTemplate() {
		const el = this.el.bind(this);
		const L = DECO_LIMITS;
		const $err = el("div", { class: "am-ferr" });
		const $img = el("img", { alt: "Decoration template: 288 by 288 canvas with a 240 by 240 avatar circle in the middle" });
		$img.style.cssText = "display:block;width:min(100%,288px);aspect-ratio:1;margin:14px auto;background:#fff;border-radius:12px";
		$img.onerror = () => {
			$img.style.display = "none";
			$err.textContent = "Couldn't load the template. Check your connection and try again.";
		};
		$img.src = SHOP_TEMPLATE;

		// Native download: ask where to save (Acode's folder picker), fetch the PNG, write it with Acode's file system.
		// Older Acode without those modules falls back to opening the link in the browser.
		const saveName = "decoration-template.png";
		let busy = false;
		const $dl = this.pfsRow({ icon: "image", title: "Download template", sub: `Pick a folder and save ${saveName}`, onclick: () => save() });
		const say = (t) => {
			const $s = $dl.querySelector("small");
			if ($s) $s.textContent = t;
		};
		const save = async () => {
			if (busy) return;
			let fileBrowser;
			let fs;
			try {
				fileBrowser = acode.require("fileBrowser");
				fs = acode.require("fs");
			} catch {}
			if (typeof fileBrowser !== "function" || typeof fs !== "function") {
				window.open(SHOP_TEMPLATE, "_system");
				return;
			}
			let dir;
			try {
				dir = await fileBrowser("folder", "Choose where to save the template");
			} catch {
				return; // cancelled
			}
			if (!dir?.url) return;
			busy = true;
			say("Saving\u2026");
			try {
				const r = await fetch(SHOP_TEMPLATE, { cache: "no-store" });
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				const buf = await r.arrayBuffer();
				const url = await (await fs(dir.url)).createFile(saveName, "");
				await (await fs(url)).writeFile(buf);
				say(`Saved to ${dir.name || "that folder"} \u2713`);
				this.flash(`Saved ${saveName}`);
			} catch (e) {
				say("Couldn't save it there. Try another folder, or use Open in browser");
				this.flash(`Couldn't save: ${e?.message || e}`);
			}
			busy = false;
		};
		const $done = el("button", { class: "am-go", text: "Done" });
		$done.onclick = () => this.pfsBack();
		return [
			this.pfsNote(`This is the guide for your ${L.side}\u00D7${L.side} picture. The pink circle is where your profile picture sits, so keep it clear. Draw around it, hide or delete the guide, then export a see-through PNG.`),
			$img,
			$err,
			this.pfsGroup(
				$dl,
				this.pfsRow({ icon: "image", title: "Open in browser", sub: "Backup: press and hold the picture there to save it", onclick: () => window.open(SHOP_TEMPLATE, "_system") }),
				this.pfsRow({
					icon: "file",
					title: "Copy link",
					sub: "Link to the template PNG",
					onclick: async () => {
						await this.copy(SHOP_TEMPLATE);
						this.flash("Link copied");
					},
				}),
			),
			$done,
		];
	}

	/* ---------- making one ---------- */

	shopCreate() {
		const el = this.el.bind(this);
		const L = DECO_LIMITS;
		let picked = null; // { image (data URL), info }
		const $pv = el("div", { class: "am-shop-new" });
		const $pick = el("button", { class: "am-pillb", type: "button" });
		const $name = el("input", { class: "am-inp", placeholder: "Name, for example Dark Moon", maxlength: String(L.maxName), autocapitalize: "off" });
		const $err = el("div", { class: "am-ferr" });
		const $go = el("button", { class: "am-go", text: "Submit for review" });
		const paint = () => {
			this.put($pv, picked ? this.shopPreview(picked.image, picked.info.animated, 96, "d0") : el("div", { class: "am-shop-ph", text: "Your picture shows here" }));
			$pick.textContent = picked ? "Choose a different picture" : "Choose picture";
		};
		$pick.onclick = () => {
			$err.textContent = "";
			const $f = document.createElement("input");
			$f.type = "file";
			$f.accept = "image/png,image/webp,.png,.apng,.webp";
			$f.style.display = "none";
			$f.onchange = async () => {
				const f = $f.files?.[0];
				$f.remove();
				if (!f) return;
				try {
					const admin = !!this.shopAdmin; // the plugin admin has no size, shape or length limits (the server agrees)
					if (!admin && f.size > L.bytes) throw new Error(decoProblem(null, f.size));
					if (/gif/i.test(f.type) || /\.gif$/i.test(f.name)) throw new Error("GIF can't be used here, its edges are not smooth. Save the animation as an APNG or WebP instead.");
					const bytes = await shopReadBytes(f);
					const info = decoInfo(bytes);
					const why = admin ? (info ? null : "That file could not be read. Use a PNG, an animated PNG (APNG) or a WebP picture.") : decoProblem(info, bytes.length);
					if (why) throw new Error(why);
					picked = { image: `data:${info.mime};base64,${shopBase64(bytes)}`, info };
				} catch (e) {
					picked = null;
					$err.textContent = e.message;
				}
				paint();
			};
			this.$root.append($f);
			$f.click();
		};
		$go.onclick = async () => {
			const name = cleanDecoName($name.value);
			if (!picked) {
				$err.textContent = "Choose a picture first.";
				return;
			}
			if (!name) {
				$err.textContent = `Give it a name (${L.minName} to ${L.maxName} letters).`;
				return;
			}
			$go.disabled = true;
			$go.textContent = "Submitting\u2026";
			$err.textContent = "";
			try {
				const r = await this.api("shop", { method: "POST", body: JSON.stringify({ action: "create", name, image: picked.image }) });
				this.shopCache = {};
				this.shopTab = "mine";
				this.shopNote = r.item?.status === "approved" ? "Your decoration is live in the shop." : "Submitted! It shows up in the shop once it is approved.";
				this.pfsOpen("shop", "back");
			} catch (e) {
				$err.textContent = /HTTP 404/.test(e.message) ? "Your server doesn't have the shop yet. Update acode-messages-server first." : e.message;
				$go.disabled = false;
				$go.textContent = "Submit for review";
			}
		};
		paint();
		return [
			this.pfsLabel("How to make one"),
			this.pfsNote(`Draw it on a see-through ${L.side}\u00D7${L.side} picture. Your profile picture sits in the middle (240\u00D7240), so keep that area clear. Save it as a PNG, or as an animated PNG (APNG) or WebP to make it move.`),
			this.pfsGroup(this.pfsRow({ icon: "image", title: "Open the template", sub: "A guide with the avatar circle marked", onclick: () => this.pfsOpen("shoptemplate") })),
			this.pfsNote(
				this.shopAdmin
					? "No limits for you as plugin admin: any size, shape or length, as long as it is a PNG, APNG or WebP the server can receive (about 3 MB at most). Pictures that are not 288\u00D7288 may not line up with the avatar."
					: `Limits: ${L.side}\u00D7${L.side}, at most ${Math.round(L.bytes / 1000)} KB. Animations can run ${L.maxMs / 1000} seconds with up to ${L.maxFrames} frames. GIF isn't supported.`,
			),
			this.pfsLabel("Your decoration"),
			$pv,
			el("div", { class: "am-shop-top" }, $pick),
			el("div", { class: "am-fl", text: "Name" }),
			$name,
			$err,
			$go,
			this.pfsNote("Everyone can use it once it is approved. Only upload art that is yours and suitable for everyone."),
		];
	}
}
