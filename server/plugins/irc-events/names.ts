import {IrcEventHandler} from "../../client.js";

export default <IrcEventHandler>function (irc, network) {
	irc.on("userlist", (data) => {
		const chan = network.getChannel(data.channel);

		if (typeof chan === "undefined") {
			return;
		}

		const newUsers = new Map();

		data.users.forEach((user) => {
			const newUser = chan.getUser(user.nick);
			newUser.setModes(user.modes, network.serverOptions.PREFIX);

			newUsers.set(user.nick.toLowerCase(), newUser);
		});

		chan.users = newUsers;

		this.emit("users", {
			chan: chan.id,
		});
	});

	irc.on("wholist", (data) => {
		const chan = network.getChannel(data.target);

		if (typeof chan === "undefined") {
			return;
		}

		let changed = false;

		data.users.forEach((whoUser) => {
			const user = chan.findUser(whoUser.nick);

			if (user && whoUser.bot && !user.isBot) {
				user.isBot = true;
				changed = true;
			}
		});

		if (changed) {
			this.emit("users", {
				chan: chan.id,
			});
		}
	});
};
