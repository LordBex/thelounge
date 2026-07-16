import {PluginInputHandler} from "./index.js";
import Msg from "../../models/msg.js";
import {MessageType} from "../../../shared/types/msg.js";
import {ChanType} from "../../../shared/types/chan.js";
import {createFishMessage, type FishMode} from "../../utils/fish.js";
import Config from "../../config.js";

const commands = ["slap", "me"];

const input: PluginInputHandler = function (network, chan, cmd, args, extras) {
	if (chan.type !== ChanType.CHANNEL && chan.type !== ChanType.QUERY) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: `${cmd} command can only be used in channels and queries.`,
			})
		);

		return;
	}

	const irc = network.irc;
	let text;

	switch (cmd) {
		case "slap":
			text = "slaps " + args[0] + " around a bit with a large trout";
		/* fall through */

		case "me": {
			if (args.length === 0) {
				break;
			}

			text = text || args.join(" ");

			const replyTo = extras?.replyTo;
			const replyTags =
				replyTo && network.serverOptions.supportsReply ? {"+reply": replyTo} : undefined;

			// If FiSH key is set, encrypt CTCP ACTION and send as normal PRIVMSG with +OK
			if (Config.values.fish.enabled && chan.blowfishKey) {
				const mode: FishMode = chan.blowfishMode || "ecb";
				const ctcp = "\x01ACTION " + text + "\x01";
				const toSend = createFishMessage(ctcp, chan.blowfishKey, mode);
				irc.say(chan.name, toSend, replyTags);
			} else {
				irc.action(chan.name, text, replyTags);
			}

			// If the IRCd does not support echo-message, simulate the message
			// being sent back to us.
			if (!irc.network.cap.isEnabled("echo-message")) {
				irc.emit("action", {
					nick: irc.user.nick,
					target: chan.name,
					message: text,
					tags: replyTo ? {"+reply": replyTo} : undefined,
				});
			}

			break;
		}
	}

	return true;
};

export default {
	commands,
	input,
};
