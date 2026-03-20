// DH1080 Key Exchange Event Handler
// Handles incoming DH1080_INIT and DH1080_FINISH NOTICE messages

import Client from "../../client.js";
import Network from "../../models/network.js";
import {MessageType} from "../../../shared/types/msg.js";
import {
	dh1080Create,
	dh1080Pack,
	dh1080Unpack,
	dh1080Secret,
	type DH1080Ctx,
} from "../../utils/dh1080.js";
import Config from "../../config.js";
import Chan from "../../models/chan.js";
import Msg from "../../models/msg.js";

/**
 * Check if a message is a DH1080 protocol message
 * @param message - The message text to check
 * @returns true if this is a DH1080_INIT or DH1080_FINISH message
 */
export function isDH1080Message(message: string): boolean {
	return message.startsWith("DH1080_INIT ") || message.startsWith("DH1080_FINISH ");
}

/**
 * Handle an incoming DH1080 message
 * @param client - TheLounge client instance
 * @param network - Network instance
 * @param fromNick - Nickname of the sender
 * @param toNick - Nickname of the recipient (should be our nick)
 * @param message - The DH1080 message text
 * @param currentChan - The current channel (for displaying messages)
 * @returns true if the message was handled (should not be displayed), false otherwise
 */
export function handleDH1080Message(
	client: Client,
	network: Network,
	fromNick: string,
	toNick: string,
	message: string,
	currentChan: Chan | undefined
): boolean {
	// Only respond to messages directed at us
	if (toNick.toLowerCase() !== network.irc?.user?.nick?.toLowerCase()) {
		return false;
	}

	if (!Config.values.fish.enabled || !Config.values.fish.allowKeyExchange) {
		return false;
	}

	// Initialize the dh1080Pending Map if it doesn't exist
	if (!network.dh1080Pending) {
		network.dh1080Pending = new Map<string, DH1080Ctx>();
	}

	const fromLower = fromNick.toLowerCase();

	// Handle DH1080_FINISH - response to our initiation or from someone we initiated with
	if (message.startsWith("DH1080_FINISH ")) {
		// Detect CBC mode request from " CBC" suffix
		const wantsCBC = message.endsWith(" CBC");
		const cleanMessage = wantsCBC ? message.slice(0, -4) : message;
		// Check if we have a pending exchange for this nick
		const ctx = network.dh1080Pending.get(fromLower);

		if (!ctx) {
			// We didn't initiate this exchange, but we can still respond
			// Create a new context for this "incoming" exchange
			const newCtx: DH1080Ctx = dh1080Create();

			if (dh1080Unpack(cleanMessage, newCtx)) {
				// Calculate and store the key
				const derivedKey = dh1080Secret(newCtx);

				if (!network.fishKeys) {
					network.fishKeys = {};
				}

				network.fishKeys[fromLower] = derivedKey;

				// Set the encryption mode based on what the other party requested
				if (!network.fishKeyModes) {
					network.fishKeyModes = {};
				}

				network.fishKeyModes[fromLower] = wantsCBC ? "cbc" : "ecb";

				// Update the channel's blowfish key and mode
				const targetChan = network.getChannel(fromNick);

				if (targetChan) {
					targetChan.blowfishKey = derivedKey;
					targetChan.blowfishMode = wantsCBC ? "cbc" : "ecb";
				}

				// Notify the user
				const modeText = wantsCBC ? " (CBC mode)" : " (ECB mode)";
				const lobby = network.getLobby();
				lobby.pushMessage(
					client,
					new Msg({
						type: MessageType.NOTICE,
						text: `Key exchange with ${fromNick} completed successfully.${modeText}`,
					})
				);

				client.save();

				return true; // Don't display the DH1080 message
			}

			return false; // Failed to parse, let it show as normal message
		}

		// We initiated this exchange, complete it
		if (dh1080Unpack(cleanMessage, ctx)) {
			// Clean up pending exchange
			network.dh1080Pending.delete(fromLower);

			// Use our requested mode if we specified one, otherwise use what they requested
			const ourRequestedMode = network.dh1080PendingModes?.get(fromLower);
			const modeToUse = ourRequestedMode || (wantsCBC ? "cbc" : "ecb");

			// Clean up mode preference
			if (network.dh1080PendingModes) {
				network.dh1080PendingModes.delete(fromLower);
			}

			// Now we can derive the key (we have their public key now)
			const derivedKey = dh1080Secret(ctx);

			if (!network.fishKeys) {
				network.fishKeys = {};
			}

			network.fishKeys[fromLower] = derivedKey;

			// Set the encryption mode
			if (!network.fishKeyModes) {
				network.fishKeyModes = {};
			}

			network.fishKeyModes[fromLower] = modeToUse;

			// Update the channel's blowfish key and mode
			const targetChan = network.getChannel(fromNick);

			if (targetChan) {
				targetChan.blowfishKey = derivedKey;
				targetChan.blowfishMode = modeToUse;
			}

			// Notify success
			const modeText = ` (${modeToUse.toUpperCase()} mode)`;
			const lobby = network.getLobby();
			lobby.pushMessage(
				client,
				new Msg({
					type: MessageType.NOTICE,
					text: `Key exchange with ${fromNick} completed successfully.${modeText}`,
				})
			);

			client.save();

			return true; // Don't display the DH1080 message
		}

		// Failed to parse, clean up and let it show
		network.dh1080Pending.delete(fromLower);

		return false;
	}

	// Handle DH1080_INIT - someone is initiating a key exchange with us
	if (message.startsWith("DH1080_INIT ")) {
		// Detect CBC mode request from " CBC" suffix
		const wantsCBC = message.endsWith(" CBC");
		const cleanMessage = wantsCBC ? message.slice(0, -4) : message;

		// Check if there's already a pending exchange
		if (network.dh1080Pending.has(fromLower)) {
			// Already have an exchange in progress, notify and ignore
			currentChan?.pushMessage(
				client,
				new Msg({
					type: MessageType.NOTICE,
					text: `Received DH1080_INIT from ${fromNick} but exchange already in progress.`,
				})
			);

			return true;
		}

		// Create new DH1080 context
		const ctx: DH1080Ctx = dh1080Create();

		if (!dh1080Unpack(cleanMessage, ctx)) {
			currentChan?.pushMessage(
				client,
				new Msg({
					type: MessageType.ERROR,
					text: `Failed to parse DH1080_INIT from ${fromNick}.`,
				})
			);

			return true; // Still hide the raw message
		}

		// Store the pending context (we'll remove it after sending FINISH)
		network.dh1080Pending.set(fromLower, ctx);

		// Calculate and store the key
		const derivedKey = dh1080Secret(ctx);

		if (!network.fishKeys) {
			network.fishKeys = {};
		}

		network.fishKeys[fromLower] = derivedKey;

		// Set the encryption mode based on what the other party requested
		if (!network.fishKeyModes) {
			network.fishKeyModes = {};
		}

		network.fishKeyModes[fromLower] = wantsCBC ? "cbc" : "ecb";

		// Update the channel's blowfish key and mode
		const targetChan = network.getChannel(fromNick);

		if (targetChan) {
			targetChan.blowfishKey = derivedKey;
			targetChan.blowfishMode = wantsCBC ? "cbc" : "ecb";
		}

		// Send DH1080_FINISH response with CBC suffix if they want CBC
		const finishMsg = dh1080Pack(ctx, true);
		const finishMsgWithMode = wantsCBC ? `${finishMsg} CBC` : finishMsg;

		if (network.irc) {
			network.irc.notice(fromNick, finishMsgWithMode);
		}

		// Clean up pending exchange immediately (we've set the key)
		network.dh1080Pending.delete(fromLower);

		// Notify the user
		const modeText = wantsCBC ? " (CBC mode)" : " (ECB mode)";
		const lobby = network.getLobby();
		lobby.pushMessage(
			client,
			new Msg({
				type: MessageType.NOTICE,
				text: `Key exchange with ${fromNick} completed successfully.${modeText}`,
			})
		);

		client.save();

		return true; // Don't display the DH1080 message
	}

	return false;
}

// Export as an irc-event handler for registration
export default function (): void {
	// This is a no-op handler - the actual handling is done in message.ts
	// We export this for consistency with other irc-events
}
