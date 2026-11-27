import { ID } from "./constants.js";
import { AcodeMessages } from "./plugin.js";

if (window.acode) {
	const plugin = new AcodeMessages();
	acode.setPluginInit(ID, async (baseUrl) => plugin.init(baseUrl), plugin.settingsUi);
	acode.setPluginUnmount(ID, () => plugin.destroy());
}
