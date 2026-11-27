import { ID, DEFAULT_API, TOKEN_MS } from "./constants.js";
import { ls } from "./util.js";
import { mixin } from "./mixin.js";
import { LauncherMethods } from "./features/launcher.js";
import { NetworkMethods } from "./features/network.js";
import { UiHelpersMethods } from "./features/ui-helpers.js";
import { PageMethods } from "./features/page.js";
import { HomeMethods } from "./features/home.js";
import { SheetsMethods } from "./features/sheets.js";
import { DiscoverMethods } from "./features/discover.js";
import { PermissionsMethods } from "./features/permissions.js";
import { ServerPanelMethods } from "./features/server-panel.js";
import { BannerMethods } from "./features/banner.js";
import { GroupIconMethods } from "./features/group-icon.js";
import { MembersMethods } from "./features/members.js";
import { ChannelsMethods } from "./features/channels.js";
import { FriendsMethods } from "./features/friends.js";
import { ProfileMethods } from "./features/profile.js";
import { EditProfileMethods } from "./features/edit-profile.js";
import { ChatMethods } from "./features/chat.js";
import { MentionsMethods } from "./features/mentions.js";
import { MessageActionsMethods } from "./features/message-actions.js";
import { PhotosMethods } from "./features/photos.js";
import { VoiceMessagesMethods } from "./features/voice-messages.js";
import { VoiceChatMethods } from "./features/voice-chat.js";
import { CodeShareMethods } from "./features/code-share.js";
import { EncryptionMethods } from "./features/encryption.js";
import { PrivacyMethods } from "./features/privacy.js";
import { OnboardingMethods } from "./features/onboarding.js";
import { SoundMethods } from "./features/sounds.js";

// The class itself only holds the constructor and settings. Everything else lives in
// features/*.js and is attached below, so `this` works the same across all files.
export class AcodeMessages {
	constructor() {
		this.appSettings = acode.require("settings");
		this.config = acode.require("config") || acode.require("constants") || {};
		this.Page = acode.require("page");
		this.actionStack = acode.require("actionStack") || window.actionStack;
		this.state = { user: null, home: { groups: [], dms: [], friends: [], requests: [] }, tab: "dm", channel: null };
		this.view = "home";
		this.lastId = 0;
		this.members = {};
		this.gdata = {};
		const t = ls.get("am-token");
		this.token = t && Date.now() - t.at < TOKEN_MS - 60000 ? t.t : null;
		this.tokenAt = this.token ? t.at : 0;
	}

	get settings() {
		const all = this.appSettings.value;
		if (!all[ID]) {
			all[ID] = { apiUrl: DEFAULT_API };
			this.appSettings.update(false);
		} else if (/heyitsaadins-projects\.vercel\.app/.test(all[ID].apiUrl || "")) {
			all[ID].apiUrl = DEFAULT_API;
			this.appSettings.update(false);
		}
		return all[ID];
	}

	get base() {
		return String(this.settings.apiUrl || DEFAULT_API).replace(/\/$/, "");
	}

	get settingsUi() {
		return {
			list: [
				{
					key: "editProfile",
					text: "Edit profile",
					info: "Change your picture, banner, name, about me and who can see your profile.",
				},
				{
					key: "sendSound",
					text: "Send sound",
					info: "Play a short sound when a message is sent.",
					checkbox: this.settings.sendSound !== false,
				},
				{
					key: "apiUrl",
					text: "Server URL",
					info: "Advanced: only change this to use your own server.",
					value: this.settings.apiUrl || DEFAULT_API,
					prompt: "Server URL",
					promptType: "text",
				},
			],
			cb: (key, value) => {
				if (key === "editProfile") {
					this.openEditProfile();
					return;
				}
				if (key === "sendSound") {
					this.settings.sendSound = !!value;
					this.appSettings.update();
					if (value) this.playSendSound();
					return;
				}
				this.settings[key] = String(value || "").trim() || DEFAULT_API;
				this.appSettings.update();
			},
		};
	}
}

mixin(AcodeMessages, [
	LauncherMethods,
	NetworkMethods,
	UiHelpersMethods,
	PageMethods,
	HomeMethods,
	SheetsMethods,
	DiscoverMethods,
	PermissionsMethods,
	ServerPanelMethods,
	BannerMethods,
	GroupIconMethods,
	MembersMethods,
	ChannelsMethods,
	FriendsMethods,
	ProfileMethods,
	EditProfileMethods,
	ChatMethods,
	MentionsMethods,
	MessageActionsMethods,
	PhotosMethods,
	VoiceMessagesMethods,
	VoiceChatMethods,
	CodeShareMethods,
	EncryptionMethods,
	PrivacyMethods,
	OnboardingMethods,
	SoundMethods,
]);
