import {PluginInputHandler} from "./index.js";
import Msg from "../../models/msg.js";
import {MessageType} from "../../../shared/types/msg.js";
import {sendFtpInvite} from "../ftp-client.js";

const commands = ["ftp", "ftpinvite"];

const input: PluginInputHandler = async function (network, chan, cmd, args) {
	if (!network) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: "Network not found",
			})
		);
		return;
	}

	// Handle /ftpinvite command
	if (cmd === "ftpinvite") {
		const targetUsername = args[0] || network.nick;

		if (!(network as any).ftpEnabled) {
			chan.pushMessage(
				this,
				new Msg({
					type: MessageType.ERROR,
					text: "FTP invites are not enabled for this network",
				})
			);
			return;
		}

		chan.pushMessage(
			this,
			new Msg({
				text: `Sending FTP invite for ${targetUsername}...`,
			})
		);

		const result = await sendFtpInvite(network, targetUsername);

		if (result.success) {
			chan.pushMessage(
				this,
				new Msg({
					text: result.message,
				})
			);
		} else {
			chan.pushMessage(
				this,
				new Msg({
					type: MessageType.ERROR,
					text: result.message,
				})
			);
		}
		return;
	}

	// Handle /ftp command
	if (args.length === 0) {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: "Usage: /ftp <status|test>",
			})
		);
		return;
	}

	const subCommand = args[0].toLowerCase();

	if (subCommand === "status") {
		const status = (network as any).ftpEnabled
			? `FTP invites enabled for ${(network as any).ftpHost || "unknown host"} (port ${(network as any).ftpPort || 21}, TLS: ${(network as any).ftpTls ? "yes" : "no"})`
			: "FTP invites are not enabled for this network";

		chan.pushMessage(
			this,
			new Msg({
				text: status,
			})
		);
	} else if (subCommand === "test") {
		if (!(network as any).ftpEnabled) {
			chan.pushMessage(
				this,
				new Msg({
					type: MessageType.ERROR,
					text: "FTP invites are not enabled for this network",
				})
			);
			return;
		}

		chan.pushMessage(
			this,
			new Msg({
				text: `Testing FTP invite for ${network.nick}...`,
			})
		);

		const result = await sendFtpInvite(network, network.nick);

		if (result.success) {
			chan.pushMessage(
				this,
				new Msg({
					text: result.message,
				})
			);
		} else {
			chan.pushMessage(
				this,
				new Msg({
					type: MessageType.ERROR,
					text: result.message,
				})
			);
		}
	} else {
		chan.pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: `Unknown /ftp subcommand: ${subCommand}. Available: status, test`,
			})
		);
	}
};

export default {
	commands,
	input,
};
