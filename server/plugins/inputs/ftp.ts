import {PluginInputHandler} from "./index.js";
import Client from "../../client.js";
import Msg from "../../models/msg.js";
import {MessageType} from "../../../shared/types/msg.js";
import {Channel} from "../../models/chan.js";
import {NetworkWithIrcFramework} from "../../models/network.js";
import {sendFtpInvite} from "../ftp-client.js";

const commands = ["ftp", "ftpinvite"];

function handleFtpResult(
	client: Client,
	chan: Channel,
	result: {success: boolean; message: string}
) {
	if (result.success) {
		chan.pushMessage(
			client,
			new Msg({
				text: result.message,
			})
		);
	} else {
		chan.pushMessage(
			client,
			new Msg({
				type: MessageType.ERROR,
				text: result.message,
			})
		);
	}
}

function handleFtpInvite(
	client: Client,
	network: NetworkWithIrcFramework,
	chan: Channel,
	targetUsername: string
) {
	if (!network.ftpEnabled) {
		chan.pushMessage(
			client,
			new Msg({
				type: MessageType.ERROR,
				text: "FTP invites are not enabled for this network",
			})
		);
		return;
	}

	chan.pushMessage(
		client,
		new Msg({
			text: `Sending FTP invite for ${targetUsername}...`,
		})
	);

	void sendFtpInvite(network, targetUsername).then((result) => {
		handleFtpResult(client, chan, result);
	});
}

const input: PluginInputHandler = function (network, chan, cmd, args) {
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
		handleFtpInvite(this, network, chan, targetUsername);
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
		const status = network.ftpEnabled
			? `FTP invites enabled for ${network.ftpHost || "unknown host"} (port ${network.ftpPort || 21}, TLS: ${network.ftpTls ? "yes" : "no"})`
			: "FTP invites are not enabled for this network";

		chan.pushMessage(
			this,
			new Msg({
				text: status,
			})
		);
	} else if (subCommand === "test") {
		handleFtpInvite(this, network, chan, network.nick);
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
