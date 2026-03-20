import {PluginInputHandler} from "./index.js";
import Msg from "../../models/msg.js";
import {MessageType} from "../../../shared/types/msg.js";
import {dh1080Create, dh1080Pack, type DH1080Ctx} from "../../utils/dh1080.js";
import Config from "../../config.js";

const commands = ["keyexchange", "ke"];

const input: PluginInputHandler = function (network, chan, _cmd, args) {
	if (!Config.values.fish.enabled) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: "FiSH encryption is disabled.",
			})
		);
		return true;
	}

	if (!Config.values.fish.allowKeyExchange) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: "DH1080 key exchange is disabled.",
			})
		);
		return true;
	}

	if (!network.irc) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: "Not connected to IRC server.",
			})
		);

		return true;
	}

	if (args.length === 0) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: "Usage: /keyexchange [cbc|ecb] <nick>",
			})
		);
		return true;
	}

	// Parse arguments: /keyexchange [mode] <nick>
	let targetNick: string;
	let mode: "cbc" | "ecb" | undefined;

	if (args.length === 1) {
		// /keyexchange <nick>
		targetNick = args[0].trim();
	} else {
		// /keyexchange [mode] <nick>
		const modeArg = args[0].toLowerCase();

		if (modeArg === "cbc" || modeArg === "ecb") {
			mode = modeArg;
			targetNick = args[1].trim();
		} else {
			// First arg is not a mode, treat as nick
			targetNick = args[0].trim();
		}
	}

	if (!targetNick) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: "Usage: /keyexchange [cbc|ecb] <nick>",
			})
		);
		return true;
	}

	// Initialize the dh1080Pending Map if it doesn't exist
	if (!network.dh1080Pending) {
		network.dh1080Pending = new Map<string, DH1080Ctx>();
	}

	const targetLower = targetNick.toLowerCase();

	// Check if there's already a pending exchange for this nick
	if (network.dh1080Pending.has(targetLower)) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: `Key exchange with ${targetNick} already in progress.`,
			})
		);
		return true;
	}

	// Create DH1080 context and generate keypair
	const ctx: DH1080Ctx = dh1080Create();
	network.dh1080Pending.set(targetLower, ctx);

	// Store the requested mode for this exchange
	if (mode) {
		if (!network.dh1080PendingModes) {
			network.dh1080PendingModes = new Map<string, "cbc" | "ecb">();
		}

		network.dh1080PendingModes.set(targetLower, mode);
	}

	// Send DH1080_INIT message with mode suffix if requested
	const initMsg = dh1080Pack(ctx, false);
	const initMsgWithMode = mode === "cbc" ? `${initMsg} CBC` : initMsg;

	network.irc.notice(targetNick, initMsgWithMode);

	// Note: We can't derive the key yet - we need to receive their public key first
	// The key will be set in dh1080.ts when we receive DH1080_FINISH

	// Notify the user
	const modeText = mode ? ` (${mode.toUpperCase()} mode)` : "";
	chan.pushMessage(
		this,
		new Msg({
			type: MessageType.NOTICE,
			text: `Key exchange initiated with ${targetNick}${modeText}. Waiting for DH1080_FINISH response...`,
		})
	);

	// Clean up the pending exchange after a timeout (2 minutes)
	// If we don't receive a response, the pending context will be removed
	setTimeout(() => {
		if (network.dh1080Pending?.has(targetLower)) {
			network.dh1080Pending.delete(targetLower);

			if (network.dh1080PendingModes) {
				network.dh1080PendingModes.delete(targetLower);
			}

			chan.pushMessage(
				this,
				new Msg({
					type: MessageType.NOTICE,
					text: `Key exchange with ${targetNick} timed out.`,
				})
			);
		}
	}, 120 * 1000);

	return true;
};

export default {
	commands,
	input,
};
