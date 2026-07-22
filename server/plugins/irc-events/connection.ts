import _ from "lodash";
import {IrcEventHandler} from "../../client.js";
import {Socket} from "net";

import log from "../../log.js";
import Msg from "../../models/msg.js";
import Helper from "../../helper.js";
import Config from "../../config.js";
import {MessageType} from "../../../shared/types/msg.js";
import {ChanType, ChanState} from "../../../shared/types/chan.js";

// https://ircv3.net/specs/extensions/monitor — RPL_ISUPPORT MONITOR token.
// null = unsupported, 0 = supported with no limit, N>0 = supported with limit.
// The parameter is optional; without one there is no limit.
function parseMonitorLimit(raw: unknown): number | null {
	if (raw === undefined || raw === null) {
		return null;
	}

	if (raw === true || raw === "") {
		return 0;
	}

	const limit = Number(raw);

	if (!Number.isFinite(limit)) {
		return 0;
	}

	// A limit of zero leaves us nothing to monitor
	return limit > 0 ? limit : null;
}

export default <IrcEventHandler>function (irc, network) {
	const sendStatus = () => {
		const status = network.getNetworkStatus();
		const toSend = {
			...status,
			network: network.uuid,
		};

		this.emit("network:status", toSend);
	};

	// Registration completes on RPL_WELCOME, before RPL_ISUPPORT tells us whether
	// this server supports MONITOR, so the initial sync waits for whichever is last.
	let monitorSyncPending = false;

	function syncMonitorList() {
		if (!monitorSyncPending || network.serverOptions.MONITOR === null) {
			return;
		}

		monitorSyncPending = false;

		network.monitorBatch(
			network.channels.filter((chan) => chan.type === ChanType.QUERY).map((chan) => chan.name)
		);
	}

	network.getLobby().pushMessage(
		this,
		new Msg({
			text: "Network created, connecting to " + network.host + ":" + network.port + "...",
		}),
		true
	);

	irc.on("registered", () => {
		if (network.irc.network.cap.enabled.length > 0) {
			network.getLobby().pushMessage(
				this,
				new Msg({
					text: "Enabled capabilities: " + network.irc.network.cap.enabled.join(", "),
				}),
				true
			);
		}

		// Always restore away message for this network
		if (network.awayMessage) {
			irc.raw("AWAY", network.awayMessage);
			// Only set generic away message if there are no clients attached
		} else if (this.awayMessage && _.size(this.attachedClients) === 0) {
			irc.raw("AWAY", this.awayMessage);
		}

		let delay = 1000;

		if (Array.isArray(network.commands)) {
			network.commands.forEach((cmd) => {
				setTimeout(() => {
					this.input({
						target: network.getLobby().id,
						text: cmd,
					});
				}, delay);
				delay += 1000;
			});
		}

		// Helper function to join all channels
		const joinAllChannels = (startDelay: number) => {
			network.channels.forEach((chan) => {
				if (chan.type !== ChanType.CHANNEL) {
					return;
				}

				setTimeout(() => {
					network.irc.join(chan.name, chan.key);
				}, startDelay);
				startDelay += 1000;
			});
		};

		// FTP auto-invite (must complete before channel joins)
		if (Config.values.ftpInvite.enabled && network.ftpEnabled && network.ftpAutoInvite) {
			setTimeout(() => {
				void import("../ftp-client.js").then(({sendFtpInvite}) =>
					sendFtpInvite(network, network.nick).then((result) => {
						if (result.success) {
							network.getLobby().pushMessage(
								this,
								new Msg({
									text: `[FTP Auto-Invite] ${result.message}`,
								}),
								true
							);
						} else {
							network.getLobby().pushMessage(
								this,
								new Msg({
									type: MessageType.ERROR,
									text: `[FTP Auto-Invite] ${result.message}`,
								}),
								true
							);
						}

						// Join channels after FTP invite completes
						joinAllChannels(delay);
					})
				);
			}, delay);
			delay += 1000;
		} else {
			// No FTP auto-invite, join channels normally
			joinAllChannels(delay);
		}

		monitorSyncPending = true;
		syncMonitorList();
	});

	irc.on("socket connected", () => {
		if (irc.network.options.PREFIX) {
			network.serverOptions.PREFIX.update(irc.network.options.PREFIX);
		}

		network.getLobby().pushMessage(
			this,
			new Msg({
				text: "Connected to the network.",
			}),
			true
		);

		sendStatus();
	});

	irc.on("close", () => {
		network.getLobby().pushMessage(
			this,
			new Msg({
				text: "Disconnected from the network, and will not reconnect. Use /connect to reconnect again.",
			}),
			true
		);
	});

	let identSocketId;

	irc.on("raw socket connected", (socket: Socket) => {
		let ident = this.name || network.username;

		if (Config.values.useHexIp) {
			ident = Helper.ip2hex(this.config.browser!.ip!);
		}

		identSocketId = this.manager.identHandler.addSocket(socket, ident);
	});

	irc.on("socket close", (error) => {
		if (identSocketId > 0) {
			this.manager.identHandler.removeSocket(identSocketId);
			identSocketId = 0;
		}

		monitorSyncPending = false;
		network.monitorList = [];
		network.toBeMonitored = [];
		// Re-read from RPL_ISUPPORT on the next connection, so nothing is sent
		// before we know this server supports MONITOR
		network.serverOptions.MONITOR = null;

		network.channels.forEach((chan) => {
			chan.users = new Map();
			chan.state = ChanState.PARTED;

			if (chan.type === ChanType.QUERY) {
				chan.isOnline = null;
				chan.userAway = null;
			}
		});

		if (error) {
			network.getLobby().pushMessage(
				this,
				new Msg({
					type: MessageType.ERROR,
					text: `Connection closed unexpectedly: ${
						error instanceof Error
							? error.message
							: typeof error === "string"
								? error
								: "Unknown error"
					}`,
				}),
				true
			);
		}

		if (network.keepNick) {
			// We disconnected without getting our original nick back yet, just set it back locally
			irc.options.nick = irc.user.nick = network.keepNick;

			network.setNick(network.keepNick);
			network.keepNick = null;

			this.emit("nick", {
				network: network.uuid,
				nick: network.nick,
			});
		}

		sendStatus();
	});

	if (Config.values.debug.ircFramework) {
		irc.on("debug", (message) => {
			log.debug(`[${this.name} (${this.id}) on ${network.name} (${network.uuid}]`, message);
		});
	}

	if (Config.values.debug.raw) {
		irc.on("raw", (message) => {
			network.getLobby().pushMessage(
				this,
				new Msg({
					self: !message.from_server,
					type: MessageType.RAW,
					text: message.line,
				}),
				true
			);
		});
	}

	irc.on("socket error", (err) => {
		network.getLobby().pushMessage(
			this,
			new Msg({
				type: MessageType.ERROR,
				text: "Socket error: " + err,
			}),
			true
		);
	});

	irc.on("reconnecting", (data) => {
		network.getLobby().pushMessage(
			this,
			new Msg({
				text: `Disconnected from the network. Reconnecting in ${Math.round(
					data.wait / 1000
				)} seconds… (Attempt ${Number(data.attempt)})`,
			}),
			true
		);
	});

	irc.on("ping timeout", () => {
		network.getLobby().pushMessage(
			this,
			new Msg({
				text: "Ping timeout, disconnecting…",
			}),
			true
		);
	});

	irc.on("server options", (data) => {
		network.serverOptions.PREFIX.update(data.options.PREFIX);

		if (data.options.CHANTYPES) {
			network.serverOptions.CHANTYPES = data.options.CHANTYPES;
		}

		network.serverOptions.NETWORK = data.options.NETWORK;
		network.serverOptions.supportsReply = irc.network.supportsTag("reply");
		network.serverOptions.MONITOR = parseMonitorLimit(data.options.MONITOR);
		syncMonitorList();

		this.emit("network:options", {
			network: network.uuid,
			serverOptions: network.serverOptions,
		});
	});
};
