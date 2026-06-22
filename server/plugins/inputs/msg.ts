import {PluginInputHandler} from "./index.js";
import Msg from "../../models/msg.js";
import Chan from "../../models/chan.js";
import {MessageType} from "../../../shared/types/msg.js";
import {ChanType} from "../../../shared/types/chan.js";
import {
	createFishMessage,
	maxEncryptablePlaintextBytes,
	splitPlaintext,
	type FishMode,
} from "../../utils/fish.js";
import Config from "../../config.js";

const commands = ["query", "msg", "say"];

function getTarget(cmd: string, args: string[], chan: Chan) {
	switch (cmd) {
		case "msg":
		case "query":
			return args.shift();
		default:
			return chan.name;
	}
}

const input: PluginInputHandler = function (network, chan, cmd, args) {
	let targetName = getTarget(cmd, args, chan);

	if (cmd === "query") {
		if (!targetName) {
			chan.pushMessage(
				this,
				new Msg({
					type: MessageType.ERROR,
					text: "You cannot open a query window without an argument.",
				})
			);
			return;
		}

		const target = network.getChannel(targetName);

		if (typeof target === "undefined") {
			const char = targetName[0];

			if (
				network.irc.network.options.CHANTYPES &&
				network.irc.network.options.CHANTYPES.includes(char)
			) {
				chan.pushMessage(
					this,
					new Msg({
						type: MessageType.ERROR,
						text: "You can not open query windows for channels, use /join instead.",
					})
				);
				return;
			}

			for (let i = 0; i < network.irc.network.options.PREFIX.length; i++) {
				if (network.irc.network.options.PREFIX[i].symbol === char) {
					chan.pushMessage(
						this,
						new Msg({
							type: MessageType.ERROR,
							text: "You can not open query windows for names starting with a user prefix.",
						})
					);
					return;
				}
			}

			const newChan = this.createChannel({
				type: ChanType.QUERY,
				name: targetName,
			});

			this.emit("join", {
				network: network.uuid,
				chan: newChan.getFilteredClone(true),
				shouldOpen: true,
				index: network.addChannel(newChan),
			});
			this.save();
			newChan.loadMessages(this, network);
		}
	}

	if (args.length === 0) {
		return true;
	}

	if (!targetName) {
		return true;
	}

	const msg = args.join(" ");

	if (msg.length === 0) {
		return true;
	}

	// When FiSH is active and a key exists for this target, split the plaintext first
	// so that each chunk, after encryption, fits within the IRC message length limit.
	// Encrypting first and then letting irc.say() split would corrupt the ciphertext.
	if (Config.values.fish.enabled) {
		const targetChan =
			network.getChannel(targetName) || (chan.name === targetName ? chan : undefined);
		const key = targetChan?.blowfishKey;
		const mode: FishMode = targetChan?.blowfishMode || "ecb";

		if (key) {
			const maxBytes = maxEncryptablePlaintextBytes(
				mode,
				(network.irc.options as unknown as {message_max_length?: number})
					.message_max_length ?? 350
			);
			const noEcho = !network.irc.network.cap.isEnabled("echo-message");

			let echoTargetName = targetName;
			let echoGroup: string | undefined;

			if (noEcho) {
				const parsedTarget = network.irc.network.extractTargetGroup(targetName);

				if (parsedTarget) {
					echoTargetName = parsedTarget.target;
					echoGroup = parsedTarget.target_group;
				}
			}

			const echoChannel = noEcho ? network.getChannel(echoTargetName) : undefined;

			for (const chunk of splitPlaintext(msg, maxBytes)) {
				const encrypted = createFishMessage(chunk, key, mode);
				network.irc.raw("PRIVMSG", targetName, encrypted);

				if (noEcho && typeof echoChannel !== "undefined") {
					network.irc.emit("privmsg", {
						nick: network.irc.user.nick,
						ident: network.irc.user.username,
						hostname: network.irc.user.host,
						target: echoTargetName,
						group: echoGroup,
						message: encrypted,
					});
				}
			}

			return true;
		}
	}

	network.irc.say(targetName, msg);

	// If the IRCd does not support echo-message, simulate the message
	// being sent back to us. Emit the same text we sent (encrypted or plain)
	// so that inbound pipeline can decrypt and store plaintext.
	if (!network.irc.network.cap.isEnabled("echo-message")) {
		const parsedTarget = network.irc.network.extractTargetGroup(targetName);
		let targetGroup: string | undefined = undefined;

		if (parsedTarget) {
			targetName = parsedTarget.target;
			targetGroup = parsedTarget.target_group;
		}

		const channel = network.getChannel(targetName);

		if (typeof channel !== "undefined") {
			network.irc.emit("privmsg", {
				nick: network.irc.user.nick,
				ident: network.irc.user.username,
				hostname: network.irc.user.host,
				target: targetName,
				group: targetGroup,
				message: msg,
			});
		}
	}

	return true;
};

export default {
	commands,
	input,
};
