import {PluginInputHandler} from "./index";
import {fishEncryptPayload} from "../../utils/fish";

const commands = ["notice"];

const input: PluginInputHandler = function (network, chan, cmd, args) {
	if (!args[1]) {
		return;
	}

	let targetName = args[0];
	let message = args.slice(1).join(" ");

	// Encrypt if a FiSH key is set for the target channel/query
	const targetChan = network.getChannel(targetName) || (chan.name === targetName ? chan : undefined);
	const key = targetChan?.blowfishKey;
	const toSend = key ? "+OK " + fishEncryptPayload(message, key) : message;

	network.irc.notice(targetName, toSend);

	// If the IRCd does not support echo-message, simulate the message
	// being sent back to us.
	if (!network.irc.network.cap.isEnabled("echo-message")) {
		let targetGroup;
		const parsedTarget = network.irc.network.extractTargetGroup(targetName);

		if (parsedTarget) {
			targetName = parsedTarget.target;
			targetGroup = parsedTarget.target_group;
		}

		const targetChan2 = network.getChannel(targetName);

		let displayMessage = toSend;
		if (typeof targetChan2 === "undefined") {
			displayMessage = "{to " + args[0] + "} " + message;
		}

		network.irc.emit("notice", {
			nick: network.irc.user.nick,
			target: targetName,
			group: targetGroup,
			message: displayMessage,
		});
	}

	return true;
};

export default {
	commands,
	input,
};
