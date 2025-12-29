import { toRaw } from "vue";
import type { SharedMsg } from "../../../../shared/types/msg";
import type { MessageEdit } from "../../types";

export function parser (originalMessage: SharedMsg) {
	const message = structuredClone(toRaw(originalMessage));
	const sender = message.from?.nick?.toLowerCase();

	if (!sender) return originalMessage;

	// ANT
	if (sender === "sauron") {
		const groups = message.text?.match(/^.*?\[.*?SB.*?\][^(]+\(?(?<username>[^):]+)\)?:.+?(?<content>.*)/)?.groups;
		if (groups === undefined) return originalMessage;

		return editMessage(message, <MessageEdit>groups);
	}

	// BHD + RFX
	if (sender === "willie" || sender === "wall-e") {
		const groups = message.text?.match(/^.*?\[(?:SB|Chatbox)\][^\w]+(?<username>[^:]+): (?<content>.*)/)?.groups;
		if (groups === undefined) return originalMessage;

		return editMessage(message, <MessageEdit>groups);
	}

	// ULCX + LST + OE+ + HHD + ATH + DP
	if (sender === "ulcx"  || sender === "bot" || sender === "bridgebot" || sender === "bbot" || sender === "chatbot" || sender === "darkpeers") {
		const groups = message.text?.match(/^\[?(?<username>[^:\]]+)\]:? (?<content>.*)/)?.groups;
		if (groups === undefined) return originalMessage;

		return editMessage(message, <MessageEdit>groups);
	}

	// HUNO
	if (sender === "mellos") {
		const groups = message.text?.match(/^»?(?<username>[^«]+?)(?: \p{RGI_Emoji}+| \(.+?\))?« (?<content>.*)/v)?.groups;
		if (groups === undefined) return originalMessage;

		return editMessage(message, <MessageEdit>groups);
	}

	// HUNO (Web)
	if (/.+?-web/.test(sender)) {
		return editMessage(message, { username: sender.replace('-web', ''), content: message.text ?? '' });
	}

	return originalMessage;
}

function editMessage (message: SharedMsg, { username, content }: MessageEdit) {
	message.text = content;
	message.from = {
		...message.from,
		nick: username.replaceAll('​', ''),
		modes: [],
		mode: "",
		shoutbox: true,
		original_nick: message.from?.nick
	};

	return message;
}
