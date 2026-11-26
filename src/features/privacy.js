import { ls } from "../util.js";

// Who can see what on a profile.
// public:  banner, about me and activity are visible to everyone.
// private: only friends see them. Everyone else sees just the name and picture.
export const VISIBILITY = [
	{ id: "public", icon: "globe", title: "Public", text: "Anyone on Acode Messages can see your banner, about me and activity." },
	{ id: "private", icon: "lock", title: "Private", text: "Only friends can see them. Everyone else sees just your name and picture." },
];

export class PrivacyMethods {
	/* ---------- public / private profile ---------- */

	// Two big tappable choices. onpick(id) fires on every change. The returned node has .set(id) to move the choice back (for example when saving fails).
	visPicker(current, onpick) {
		const el = this.el.bind(this);
		const $box = el("div", { class: "am-visw", role: "radiogroup" });
		let cur = current === "private" ? "private" : "public";
		const paint = () => {
			this.put(
				$box,
				...VISIBILITY.map((v) =>
					el(
						"div",
						{
							class: `am-vis${cur === v.id ? " on" : ""}`,
							role: "radio",
							"aria-checked": String(cur === v.id),
							onclick: () => {
								if (cur === v.id) return;
								cur = v.id;
								paint();
								onpick(v.id);
							},
						},
						el("span", { class: "ic" }, this.ico(v.icon, 22)),
						el("div", { class: "tx" }, el("b", { text: v.title }), el("small", { text: v.text })),
						el("span", { class: "rd" }),
					),
				),
			);
		};
		paint();
		$box.set = (v) => {
			cur = v === "private" ? "private" : "public";
			paint();
		};
		return $box;
	}

	// "Who can see your profile" card on your own profile. Saves as soon as you tap.
	// Hidden when the server doesn't report a visibility (an older server without migration 012).
	visibilityCard(ctx) {
		const cur = ctx.data?.user?.visibility;
		if (!cur) return null;
		const el = this.el.bind(this);
		const $err = el("div", { class: "am-ferr", style: "margin:8px 0 0" });
		const $pick = this.visPicker(cur, async (v) => {
			$err.textContent = "";
			try {
				await this.api("me", { method: "POST", body: JSON.stringify({ visibility: v }) });
				ctx.data.user.visibility = v;
				ls.set(`am-prof:${ctx.id}`, ctx.data);
			} catch (e) {
				$pick.set(ctx.data.user.visibility);
				$err.textContent = e.message;
			}
		});
		return el("div", { class: "am-card" }, el("h4", { text: "Who can see your profile" }), $pick, $err);
	}

	// What you see on someone else's private profile when you're not their friend.
	privateCard(info) {
		const el = this.el.bind(this);
		return el(
			"div",
			{ class: "am-card am-priv" },
			el("span", { class: "ring" }, this.ico("lock", 28)),
			el("b", { text: "This profile is private" }),
			el("span", { class: "t", text: `Become friends with ${info.name || "them"} to see their banner, about me and activity.` }),
		);
	}
}
