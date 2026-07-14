import {IrcEventHandler} from "../../client.js";
import Helper from "../../helper.js";
import {ChanType} from "../../../shared/types/chan.js";
import {VALID_TYPING_STATUSES, TypingStatus} from "../../../shared/types/typing.js";

export default <IrcEventHandler>function (irc, network) {
	const client = this;

	irc.on("tagmsg", function (data) {
		if (data.nick === irc.user.nick) {
			return;
		}

		const shouldIgnore = network.ignoreList.some(function (entry) {
			return Helper.compareHostmask(entry, data);
		});

		if (shouldIgnore) {
			return;
		}

		let target = data.target;

		if (target.toLowerCase() === irc.user.nick.toLowerCase()) {
			target = data.nick;
		}

		const chan = network.getChannel(target);

		if (!chan) {
			return;
		}

		if (chan.type !== ChanType.CHANNEL && chan.type !== ChanType.QUERY) {
			return;
		}

		// https://ircv3.net/specs/client-tags/typing
		const typing = data.tags["+typing"];

		if (typing && VALID_TYPING_STATUSES.has(typing as TypingStatus)) {
			client.emit("typing", {
				network: network.uuid,
				chan: chan.id,
				nick: data.nick,
				status: typing as TypingStatus,
			});
		}
	});
};
