import type { SharedMsg } from "../../../../shared/types/msg";
import { toRaw } from "vue";
import { matchers } from "./matchers";

/**
 * Parse message aganst `Matchers` and edit the Nick and Content based on `transform` results
 */
export function parser (originalMessage: SharedMsg) {
	const message = structuredClone(toRaw(originalMessage));
	const sender = message.from?.nick?.toLowerCase();

	if (!message.text || !sender) return originalMessage;

	const matcher = matchers.find(m => {
		if (m.type === "basic") return m.matches.includes(sender);
		if (m.type === "advanced") return m.matches(sender);
	});
	if (!matcher) return originalMessage;

	const edit = matcher.transform(message);
	if (!edit || !edit.nick) return originalMessage;

	message.text = edit.content ?? message.text;
	message.from = {
		...message.from!,
		nick: edit.nick.replaceAll("​", ""),
		mode: '',
		shoutbox: true,
		original_nick: message.from!.nick
	};

	return message;
}
