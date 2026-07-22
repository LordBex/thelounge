import type {IrcEventHandler} from "../../client.js";

import Msg from "../../models/msg.js";
import type User from "../../models/user.js";
import {MessageType} from "../../../shared/types/msg.js";
import {ChanType} from "../../../shared/types/chan.js";

// https://ircv3.net/specs/extensions/chghost
// extended-monitor lets us also receive CHGHOST for nicks we don't share a
// channel with — surface those in the matching query.
export default <IrcEventHandler>function (irc, network) {
	// If server supports CHGHOST cap, then changing the hostname does not require
	// sending PART and JOIN, which means less work for us over all
	irc.on("user updated", (data) => {
		// 'user updated' is also emitted for SETNAME (no host change). Ignore
		// those here — the chghost message template doesn't represent gecos.
		if (data.ident === data.new_ident && data.hostname === data.new_hostname) {
			return;
		}

		const buildMsg = (from: User) =>
			new Msg({
				time: data.time,
				type: MessageType.CHGHOST,
				new_ident: data.ident !== data.new_ident ? data.new_ident : "",
				new_host: data.hostname !== data.new_hostname ? data.new_hostname : "",
				self: data.nick === irc.user.nick,
				from,
			});

		let touchedSharedChannel = false;

		network.channels.forEach((chan) => {
			const user = chan.findUser(data.nick);

			if (typeof user === "undefined") {
				return;
			}

			touchedSharedChannel = true;
			const msg = buildMsg(user);

			// Try to process through mass event aggregator
			// No user list update needed for chghost
			const wasBuffered = this.massEventAggregator.processMessage(
				network,
				chan,
				msg,
				() => {} // No user list changes for chghost
			);

			if (!wasBuffered) {
				// Not in mass event mode - process normally
				chan.pushMessage(this, msg);
			}
		});

		if (touchedSharedChannel) {
			return;
		}

		const query = network.getChannel(data.nick);

		if (query?.type === ChanType.QUERY) {
			query.pushMessage(this, buildMsg(query.getUser(data.nick)));
		}
	});
};
