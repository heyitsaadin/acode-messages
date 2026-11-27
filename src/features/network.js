import { TOKEN_MS } from "../constants.js";
import { ls, normUser } from "../util.js";

export class NetworkMethods {
	/* ---------- network ---------- */

	get authBase() {
		return this.config?.API_BASE || "https://acode.app/api";
	}

	// Same call Acode itself makes; retry with cookies if the plain one is refused.
	async authFetch(path) {
		let res;
		try {
			res = await fetch(`${this.authBase}/${path}`);
		} catch (e) {
			this.loginError = e.message || "network error";
		}
		if (!res || !res.ok) {
			try {
				res = await fetch(`${this.authBase}/${path}`, { credentials: "include" });
			} catch (e) {
				this.loginError = e.message || "network error";
				return null;
			}
		}
		if (!res.ok) this.loginError = `HTTP ${res.status}`;
		return res.ok ? res : null;
	}

	// Your custom name / picture (set in Edit profile) win over what the Acode account says.
	withMine(u) {
		const m = ls.get("am-me");
		if (!u || !m || String(m.uid) !== String(u.id)) return u;
		const out = { ...u };
		if (m.name) out.name = m.name;
		if (m.avatar_url) out.avatar_url = m.avatar_url;
		return out;
	}

	cachedUser() {
		const u = ls.get("cached-logged-in-user");
		return u && u.id ? this.withMine(normUser(u)) : null;
	}

	async getUser() {
		this.loginError = "";
		try {
			const res = await this.authFetch("login");
			if (!res) return this.cachedUser();
			const u = await res.json();
			if (!u || !u.id) {
				this.loginError = "not logged in";
				return this.cachedUser();
			}
			return normUser(u);
		} catch (e) {
			this.loginError = e.message;
			return this.cachedUser();
		}
	}

	// One shared token request, so ten parallel calls don't make ten logins.
	getToken() {
		const age = Date.now() - this.tokenAt;
		const fresh = !!this.token && age < TOKEN_MS;
		// Past 60% of its life, renew it quietly so a send never has to wait for a new login.
		if (fresh && age > TOKEN_MS * 0.6) this.renewToken().catch(() => {});
		return fresh ? Promise.resolve(this.token) : this.renewToken();
	}

	renewToken() {
		if (!this.tokenP) {
			this.tokenP = (async () => {
				let t = null;
				try {
					const r = await this.authFetch("chat-token");
					t = r ? (await r.json()).token || null : null;
				} catch {}
				this.token = t;
				// On failure, try again in 30s rather than 5 minutes.
				this.tokenAt = t ? Date.now() : Date.now() - TOKEN_MS + 30000;
				if (t) ls.set("am-token", { t, at: Date.now() });
				return t;
			})().finally(() => {
				this.tokenP = null;
			});
		}
		return this.tokenP;
	}

	async headers() {
		const h = { "Content-Type": "application/json" };
		const u = this.state.user;
		const token = await this.getToken();
		if (token) h.Authorization = `Bearer ${token}`;
		else if (u) {
			// Unsigned dev mode, only honoured if the server allows it.
			h["x-acode-user"] = encodeURIComponent(
				JSON.stringify({ id: u.id, name: u.name, avatar_url: u.avatar_url, verified: !!u.verified, acode_pro: !!u.acode_pro, is_admin: !!u.is_admin }),
			);
		}
		return h;
	}

	async api(path, options = {}, retried = false) {
		const ctl = typeof AbortController === "function" ? new AbortController() : null;
		const timer = ctl && setTimeout(() => ctl.abort(), 20000);
		let res;
		try {
			res = await fetch(`${this.base}/api/${path}`, { ...options, headers: await this.headers(), signal: ctl?.signal });
		} catch (e) {
			throw new Error(e?.name === "AbortError" ? "timed out" : e?.message || "network error");
		} finally {
			clearTimeout(timer);
		}
		if (res.status === 401 && !retried) {
			this.token = null;
			this.tokenAt = 0;
			return this.api(path, options, true);
		}
		if (!res.ok) {
			let msg = `HTTP ${res.status}`;
			try {
				msg = (await res.json()).error || msg;
			} catch {}
			throw new Error(msg);
		}
		return res.json();
	}
}
