// Small helpers that don't touch the UI.
// Tiny localStorage wrapper: every read/write is safe, values are JSON.
export const ls = {
	get(k, d = null) {
		try {
			const v = localStorage.getItem(k);
			return v == null ? d : JSON.parse(v);
		} catch {
			return d;
		}
	},
	set(k, v) {
		try {
			localStorage.setItem(k, JSON.stringify(v));
		} catch {}
	},
};

export const normUser = (u) => (u ? { ...u, is_admin: u.is_admin ?? u.isAdmin ?? false } : null);
// Home rows describe the other person as peer_id; everywhere else it's id.
export const peerOf = (d) => ({
	id: d.peer_id ?? d.id,
	name: d.name,
	avatar_url: d.avatar_url,
	avatar_decoration: d.avatar_decoration,
	verified: d.verified,
	acode_pro: d.acode_pro,
	is_admin: d.is_admin,
	online: d.online,
});
