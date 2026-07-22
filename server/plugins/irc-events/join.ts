import Msg from "../../models/msg.js";
import Chan from "../../models/chan.js";
import User from "../../models/user.js";
import type {IrcEventHandler} from "../../client.js";
import {MessageType} from "../../../shared/types/msg.js";
import {ChanType, ChanState} from "../../../shared/types/chan.js";

export default <IrcEventHandler>function (irc, network) {
	const performWhoOnChannel = (chan: Chan) => {
		if (chan.type !== ChanType.CHANNEL) {
			return;
		}

		irc.who(chan.name, (whoData: {users: {nick: string; away: boolean}[]}) => {
			for (const whoUser of whoData.users) {
				const user = chan.findUser(whoUser.nick);

				if (user && (!whoUser.away || !user.away)) {
					// WHO only tells us whether they are away, not why, so keep a
					// reason we already have from away-notify
					user.away = whoUser.away ? "away" : "";
				}

				// Sync away status to matching query channel
				const away = whoUser.away ? "away" : null;
				const queryChan = network.getChannel(whoUser.nick);

				if (queryChan?.type === ChanType.QUERY && queryChan.userAway !== away) {
					queryChan.userAway = away;

					this.emit("user:away", {
						chan: queryChan.id,
						nick: whoUser.nick,
						away: away,
					});
				}
			}

			this.emit("users", {
				chan: chan.id,
			});
		});
	};

	irc.on("join", (data) => {
		let chan = network.getChannel(data.channel);

		if (typeof chan === "undefined") {
			chan = this.createChannel({
				name: data.channel,
				state: ChanState.JOINED,
			});

			this.emit("join", {
				network: network.uuid,
				chan: chan.getFilteredClone(true),
				shouldOpen: false,
				index: network.addChannel(chan),
			});
			this.save();

			chan.loadMessages(this, network);

			// Request channels' modes
			network.irc.raw("MODE", chan.name);
		} else if (data.nick === irc.user.nick) {
			chan.state = ChanState.JOINED;

			this.emit("channel:state", {
				chan: chan.id,
				state: chan.state,
			});
		}

		const user = new User({nick: data.nick});
		const msg = new Msg({
			time: data.time,
			from: user,
			hostmask: data.ident + "@" + data.hostname,
			gecos: data.gecos,
			account: data.account,
			type: MessageType.JOIN,
			self: data.nick === irc.user.nick,
		});

		const isBot = "bot" in (data.tags || {});

		// User list update callback - executed regardless of buffering
		const updateUserList = () => {
			chan.setUser(new User({nick: data.nick, isBot}));
			this.emit("users", {
				chan: chan.id,
			});
		};

		// Try to process through mass event aggregator
		const wasBuffered = this.massEventAggregator.processMessage(
			network,
			chan,
			msg,
			updateUserList
		);

		if (!wasBuffered) {
			// Not in mass event mode - process normally
			chan.pushMessage(this, msg);
			updateUserList();
		}

		// When we join a channel, send WHO to get initial away statuses
		if (data.nick === irc.user.nick) {
			performWhoOnChannel(chan);
		}
	});
};
