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
		// Persist the key removal to the network's fishKeys map
		const keyMap = network.fishKeys || {};
		delete keyMap[chan.name.toLowerCase()];
		network.fishKeys = keyMap;
		chan.blowfishKey = undefined;

		this.save();

		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.NOTICE,
				text: `FiSH: Key cleared for ${chan.name}.`,
			})
		);
		return true;
	}

	// Persist the key to the network's fishKeys map
	const keyMap = network.fishKeys || {};
	keyMap[chan.name.toLowerCase()] = sub;
	network.fishKeys = keyMap;
	chan.blowfishKey = sub;

	this.save();

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
