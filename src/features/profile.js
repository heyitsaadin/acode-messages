import { SHARE_MS, HEAT_DAYS, ACTIVITY_KEY } from "../constants.js";
import { ls } from "../util.js";

export class ProfileMethods {
	/* ---------- profile (rich card) ---------- */

	// Read the coding-activity tracker that lives in your Acode build (localStorage, this device only).
	localActivity() {
		const days = ls.get(ACTIVITY_KEY)?.days;
		if (!days || typeof days !== "object") return null;
		const pad = (n) => String(n).padStart(2, "0");
		const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		const level = (d) => {
			const s = (d.ms || 0) / 60000 + (d.lines || 0) / 4 + (d.files || 0) * 2;
			return s >= 60 ? 4 : s >= 30 ? 3 : s >= 10 ? 2 : s >= 1 ? 1 : 0;
		};
		const now = new Date();
		const run = [];
		let ms = 0;
		let lines = 0;
		let files = 0;
		let activeDays = 0;
		let longest = 0;
		let streak = 0;
		const langs = {};
		for (let i = 364; i >= 0; i--) {
			const d = days[key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))] || {};
			const lv = level(d);
			run.push({ lv, ms: d.ms || 0 });
			ms += d.ms || 0;
			lines += d.lines || 0;
			files += d.files || 0;
			if (lv) {
				activeDays++;
				streak++;
				longest = Math.max(longest, streak);
			} else streak = 0;
			for (const [n, v] of Object.entries(d.code || {})) langs[n] = (langs[n] || 0) + (Number(v) || 0);
		}
		if (!ms && !lines && !files) return null;
		let current = 0;
		let i = run.length - 1;
		if (!run[i].lv) i--;
		for (; i >= 0 && run[i].lv; i--) current++;
		const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
		const first = Object.keys(days).filter((k) => days[k] && (days[k].ms || days[k].lines || days[k].files)).sort()[0];
		return {
			since: first ? new Date(`${first}T12:00:00`).toISOString() : null,
			ms,
			lines,
			files,
			activeDays,
			current,
			longest,
			languages: Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, v]) => ({ name, share: v / total })),
			week: run.slice(-7).map((r) => r.ms),
			heat: run.slice(-HEAT_DAYS).map((r) => r.lv).join(""),
			at: new Date().toISOString(),
		};
	}

	// Keep what others see of you fresh (only if you chose to share).
	async pushShare(force) {
		if (!force && (!ls.get("am-share", false) || Date.now() - ls.get("am-share-at", 0) < SHARE_MS)) return;
		const a = this.localActivity();
		const body = { share: true, website: ls.get("am-site", "") };
		if (a) {
			const { since, at, ...activity } = a;
			body.since = since;
			body.activity = activity;
		}
		await this.api("profile", { method: "POST", body: JSON.stringify(body) });
		ls.set("am-share-at", Date.now());
	}

	profile(u, self) {
		const id = Number(u.id ?? u.peer_id);
		const $box = this.el("div", { class: "am-pf" });
		const cached = ls.get(`am-prof:${id}`);
		const ctx = { u, id, self, $box, data: cached, loading: !cached, shared: self ? (cached ? !!cached.profile : !!ls.get("am-share", false)) : false };
		ctx.refresh = () => this.put($box, ...this.profileNodes(ctx));
		const t0 = Date.now();
		ctx.reload = async () => {
			try {
				const data = await this.api(`profile?user=${id}`, { cache: "no-store" });
				ls.set(`am-prof:${id}`, data);
				ctx.data = data;
				if (self) ctx.shared = !!data.profile;
			} catch {}
			ctx.loading = false;
			// let the opening animation finish before swapping in fresh data, and never replay it
			const wait = 800 - (Date.now() - t0);
			if (wait > 0) await new Promise((r) => setTimeout(r, wait));
			$box.classList.add("seen");
			if ($box.isConnected) ctx.refresh();
		};
		ctx.refresh();
		this.openSheet(true, "", [$box]);
		ctx.reload();
	}

	kv(k, v, onclick) {
		const $v = this.el("span", { text: v });
		if (onclick) {
			$v.style.cssText = "color:var(--active-color,#5b8cff);text-decoration:underline";
			$v.onclick = onclick;
		}
		return this.el("div", { class: "am-kv" }, this.el("span", { text: k }), $v);
	}

	// How you stand with this person: server value when it sends one, else worked out from the home lists.
	friendRel(ctx) {
		if (ctx.rel) return ctx.rel;
		if (ctx.data?.rel) return ctx.data.rel;
		const id = String(ctx.id);
		const h = this.state.home;
		if ((h.friends || []).some((f) => String(f.peer_id) === id)) return "friends";
		if ((h.requests || []).some((r) => String(r.peer_id) === id)) return "received";
		return "none";
	}

	// Add friend / Cancel request / Accept request / Friends (tap to remove), right on the profile.
	friendBtn(ctx) {
		const rel = this.friendRel(ctx);
		const u = { id: ctx.id };
		const set = (r) => {
			ctx.rel = r;
			ctx.$box?.classList.add("seen");
			ctx.refresh();
		};
		const run = async (action) => {
			try {
				set((await this.friendAct(action, u)).rel);
			} catch (e) {
				this.flash(this.friendErr(e));
				ctx.refresh();
			}
		};
		const mk = (icon, label, cls, fn) =>
			this.el("button", { class: `am-pbtn ${cls}`.trim(), onclick: (e) => {
				e.currentTarget.disabled = true;
				fn();
			} }, this.ico(icon, 20), this.el("span", { text: label }));
		if (rel === "friends") {
			return mk("user", "Friends ✓", "alt", () => {
				ctx.refresh();
				this.confirm("Remove friend?", `${ctx.u.name || "This person"} will be removed from your friends.`, "Remove", async () => {
					await this.friendAct("remove", u);
					this.closeSheet();
				}, null, "user");
			});
		}
		if (rel === "sent") return mk("close", "Cancel friend request", "alt", () => run("cancel"));
		if (rel === "received") return mk("user", "Accept friend request", "ok", () => run("accept"));
		return mk("plus", "Add friend", "alt", () => run("request"));
	}

	profileNodes(ctx) {
		const el = this.el.bind(this);
		const { u, self, data, loading } = ctx;
		const info = { ...u, ...(data?.user || {}) };
		const $ban = el("div", { class: "am-pf-ban" });
		if (info.banner) {
			const $bi = document.createElement("img");
			$bi.alt = "";
			$bi.onerror = () => $bi.remove();
			$bi.src = this.bannerSrc(info.banner);
			$ban.append($bi);
		}
		const online = self ? true : !!info.online;
		const status = online ? "Online" : info.last_seen ? `Last seen ${this.ago(info.last_seen)}` : "Offline";
		const out = [
			$ban,
			el("div", { class: "am-pf-top" }, this.avw(info, 90, online)),
			el("h2", {}, info.name || "?", ...this.badges(info)),
			el("div", { class: "sub", text: `@${info.name} · ${status}` }),
			self
				? el("button", { class: "am-pbtn", onclick: () => this.editProfile(data?.user) }, this.ico("edit", 20), el("span", { text: "Edit profile" }))
				: el("button", { class: "am-pbtn", onclick: () => this.openDm(info) }, this.ico("chat", 20), el("span", { text: "Message" })),
			...(self ? [] : [this.friendBtn(ctx)]),
		];

		// About
		const rows = [];
		if (info.about) rows.push(el("div", { class: "am-abt", text: info.about }));
		if (data?.user?.first_seen) rows.push(this.kv("Member since", new Date(data.user.first_seen).toLocaleDateString([], { month: "short", year: "numeric" })));
		const p = data?.profile;
		if (p?.since) rows.push(this.kv("Coding since", new Date(p.since).toLocaleDateString([], { month: "short", year: "numeric" })));
		const site = p?.website || (self ? ls.get("am-site", "") : "");
		if (site) rows.push(this.kv("Website", site.replace(/^https?:\/\//, ""), /^https?:\/\//.test(site) ? () => window.open(site, "_system") : null));
		if (data?.stats?.last_message) rows.push(this.kv("Last message", this.ago(data.stats.last_message)));
		if (rows.length) out.push(el("div", { class: "am-card" }, el("h4", { text: "About" }), ...rows));
		else if (loading) out.push(el("div", { class: "am-card" }, el("h4", { text: "About" }), this.sk("70%", 14, 6), el("div", { style: "height:9px" }), this.sk("50%", 14, 6)));

		// Mutual groups
		if (!self && data?.mutual?.length) out.push(el("div", { class: "am-card" }, el("h4", { text: `Groups in common — ${data.mutual.length}` }), el("div", { class: "am-chips" }, ...data.mutual.map((g) => el("span", { class: "am-chip", text: g.name })))));

		if (self) out.push(this.shareCard(ctx));
		return out;
	}

	activityCard(a, at, note) {
		const el = this.el.bind(this);
		const tile = (n, l) => el("div", { class: "am-stat" }, el("b", { text: n }), el("small", { text: l }));
		const card = el(
			"div",
			{ class: "am-card" },
			el("h4", { text: "Coding activity" }),
			el("div", { class: "am-stats" }, tile(this.fmtMs(a.ms), "coded"), tile(`${a.current}d 🔥`, "streak"), tile(`${a.longest}d`, "best streak")),
			el("div", { class: "am-sub", text: `${a.activeDays} active day${a.activeDays === 1 ? "" : "s"} · ${Number(a.lines).toLocaleString()} lines · ${Number(a.files).toLocaleString()} file${a.files === 1 ? "" : "s"} created` }),
		);
		if (a.heat) {
			const $h = el("div");
			$h.innerHTML = this.heatSvg(a.heat, at);
			card.append($h);
		}
		if (a.week?.length === 7 && a.week.some((v) => v > 0)) {
			const max = Math.max(...a.week) || 1;
			const d0 = at ? new Date(at) : new Date();
			const names = ["S", "M", "T", "W", "T", "F", "S"];
			card.append(
				el("div", { class: "am-lbl", style: "padding:14px 0 0", text: "Last 7 days" }),
				el(
					"div",
					{ class: "am-week" },
					...a.week.map((v, i) => {
						const $i = el("i");
						$i.style.height = `${Math.max(3, Math.round((v / max) * 100))}%`;
						$i.style.opacity = v ? "1" : ".25";
						return el("div", { class: "col" }, el("div", { class: "wrap" }, $i), el("span", { text: names[new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - (6 - i)).getDay()] }));
					}),
				),
			);
		}
		if (a.languages?.length) {
			const bar = el("div", { class: "am-langbar" });
			const leg = el("div", { class: "am-leg" });
			for (const l of a.languages) {
				const c = `hsl(${this.hue(l.name)} 62% 55%)`;
				const seg = el("div");
				seg.style.cssText = `flex:${Math.max(l.share, 0.02)};background:${c}`;
				bar.append(seg);
				const dot = el("i");
				dot.style.background = c;
				leg.append(el("span", {}, dot, `${l.name} ${Math.round(l.share * 100)}%`));
			}
			card.append(el("div", { class: "am-lbl", style: "padding:14px 0 0", text: "Top languages" }), bar, leg);
		}
		if (note) card.append(el("div", { class: "am-sub", text: note }));
		return card;
	}

	heatSvg(heat, at) {
		const n = heat.length;
		const dow = (at ? new Date(at) : new Date()).getDay();
		const pad = (((dow - (n - 1)) % 7) + 7) % 7;
		const S = 10;
		const G = 3;
		const P = S + G;
		let rects = "";
		for (let i = 0; i < n; i++) {
			const p = pad + i;
			rects += `<rect class="l${heat[i]}" x="${Math.floor(p / 7) * P}" y="${(p % 7) * P}" width="${S}" height="${S}" rx="2.5"/>`;
		}
		const cols = Math.ceil((pad + n) / 7);
		return `<svg class="am-heat" viewBox="0 0 ${cols * P - G} ${7 * P - G}" preserveAspectRatio="xMinYMin meet">${rects}</svg>`;
	}

	shareCard(ctx) {
		const el = this.el.bind(this);
		const $sw = el("div", { class: `am-sw${ctx.shared ? " on" : ""}` });
		const $err = el("div", { class: "am-ferr", style: "margin:6px 0 0" });
		const toggle = async () => {
			const on = !ctx.shared;
			$sw.classList.toggle("on", on);
			$err.textContent = "";
			try {
				if (on) {
					ls.set("am-share", true);
					await this.pushShare(true);
				} else {
					ls.set("am-share", false);
					await this.api("profile", { method: "POST", body: JSON.stringify({ share: false }) });
				}
				await ctx.reload();
			} catch (e) {
				ls.set("am-share", !on);
				$sw.classList.toggle("on", !on);
				$err.textContent = e.message;
			}
		};
		const $site = el("input", { class: "am-inp", placeholder: "Website (optional)", autocapitalize: "off", inputmode: "url", maxlength: "100", value: ls.get("am-site", "") });
		$site.onchange = async () => {
			let v = $site.value.trim();
			if (v && !/^[a-z]+:\/\//i.test(v)) v = `https://${v}`;
			$site.value = v;
			ls.set("am-site", v);
			if (ctx.shared) {
				try {
					await this.pushShare(true);
					await ctx.reload();
				} catch (e) {
					$err.textContent = e.message;
				}
			}
		};
		return el(
			"div",
			{ class: "am-card" },
			el("h4", { text: "Your profile" }),
			el("div", { class: "am-it", onclick: toggle }, el("div", {}, el("span", { text: "Share my coding activity" }), el("small", { text: "Shows your streak, heatmap and top languages to people you share a group with. Never your code or file names." })), $sw),
			$site,
			$err,
		);
	}
}
