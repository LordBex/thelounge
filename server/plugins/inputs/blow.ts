import {PluginInputHandler} from "./index.js";
import Msg from "../../models/msg.js";
import {MessageType} from "../../../shared/types/msg.js";

const commands = ["blow"];

const input: PluginInputHandler = function (network, chan, _cmd, args) {
	if (!chan) {
		return true;
	}

	if (args.length === 0) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.NOTICE,
				text: chan.blowfishKey
					? `FiSH: Key is set for ${chan.name}. Use /blow off to clear.`
					: `FiSH: No key set for ${chan.name}. Use /blow <key> to set.`,
			})
		);
		return true;
	}

	const sub = args.join(" ").trim();

	if (!sub) {
		return true;
	}

	if (sub.toLowerCase() === "off" || sub.toLowerCase() === "clear") {
		chan.blowfishKey = undefined;
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.NOTICE,
				text: `FiSH: Key cleared for ${chan.name}.`,
			})
		);
		return true;
	}

	chan.blowfishKey = sub;
	chan.pushMessage(
		this,
		new Msg({
			type: MessageType.NOTICE,
			text: `FiSH: Key set for ${chan.name}.`,
		})
	);
	return true;
};

export default {
	commands,
	input,
};
