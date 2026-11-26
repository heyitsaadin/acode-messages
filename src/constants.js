// Settings and fixed values shared across the plugin.
export const ID = "dev.heyitsaadin.messages";
export const VERSION = "__PLUGIN_VERSION__"; // filled in by build.js from plugin.json
export const ICON_CLASS = "acode-messages-icon";
export const DEFAULT_API = "https://acode-messages-server.vercel.app";
export const POLL_MS = 2500;
export const HOME_MS = 15000;
export const TOKEN_MS = 5 * 60 * 1000;
export const SHARE_MS = 30 * 60 * 1000;
export const HEAT_DAYS = 182;
export const MSG_CACHE = 40;
export const MAX_VOICE_MS = 120000; // longest voice message
export const PHOTO_B64_MAX = 520000; // server accepts up to 560000
export const ACTIVITY_KEY = "acode-activity-v1";
export const MAX_ROLES = 10;
export const PERMS = [
	["manage_group", "Manage group", "Rename the group and change its picture and banner"],
	["delete_group", "Delete group", "Permanently delete the group"],
	["manage_roles", "Manage roles", "Create roles and give them to people ranked below"],
	["manage_channels", "Manage channels", "Create, edit and delete channels and choose who can use them"],
	["kick", "Kick members", "Remove people from the group"],
	["mute", "Mute members", "Stop people from sending messages"],
];
// What a channel override can allow or deny.
export const CH_PERMS = [
	["view", "View channel", "Lets them see this channel and read it"],
	["send", "Send messages", "Lets them post in this channel"],
];
export const SLOWMODES = [["Off", 0], ["5 seconds", 5], ["10 seconds", 10], ["30 seconds", 30], ["1 minute", 60], ["5 minutes", 300], ["15 minutes", 900], ["1 hour", 3600]];
export const ROLE_COLORS = ["#e0a800", "#3ba55d", "#5865f2", "#ed4245", "#eb459e", "#9b59b6", "#1abc9c", "#e67e22", "#3498db", "#95a5a6"];
export const MUTE_CHOICES = [["10 minutes", 10], ["1 hour", 60], ["1 day", 1440], ["1 week", 10080], ["Until I unmute them", -1]];
