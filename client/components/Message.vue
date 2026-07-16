<template>
	<div
		:id="'msg-' + prettyMessage.id"
		:class="[
			'msg',
			{
				self: prettyMessage.self,
				highlight: prettyMessage.highlight,
				'is-focused': isFocused,
				'previous-source': isPreviousSource,
			},
		]"
		:data-type="prettyMessage.type"
		:data-command="prettyMessage.command"
		:data-from="
			prettyMessage.from &&
			(prettyMessage.from.shoutbox
				? prettyMessage.from.original_nick
				: prettyMessage.from.nick)
		"
		:data-bridged="prettyMessage.from?.shoutbox"
		:data-msgid="message.msgid"
		@touchstart.passive="onTouchStart"
		@touchend="onTouchEnd"
		@touchmove="onTouchCancel"
		@touchcancel="onTouchCancel"
	>
		<span
			aria-hidden="true"
			:aria-label="messageTimeLocale"
			class="time tooltipped tooltipped-e"
			>{{ `${messageTime}&#32;` }}
		</span>
		<template v-if="prettyMessage.type === 'unhandled'">
			<span class="from">[{{ prettyMessage.command }}]</span>
			<span class="content">
				<span v-for="(param, id) in prettyMessage.params" :key="id">{{
					`&#32;${param}&#32;`
				}}</span>
			</span>
		</template>
		<template v-else-if="isAction()">
			<span class="from"><span class="only-copy" aria-hidden="true">***&nbsp;</span></span>
			<component :is="messageComponent" :network="network" :message="prettyMessage" />
		</template>
		<template v-else-if="prettyMessage.type === 'action'">
			<span class="from"><span class="only-copy">*&nbsp;</span></span>
			<span class="content" dir="auto">
				<ReplyContext
					v-if="message.replyTo"
					:message="message"
					:parent-in-history="parentInHistory"
					@scroll-to-parent="scrollToParent"
				/>
				<StatusmsgMarker :group="prettyMessage.statusmsgGroup" />
				<Username
					:user="prettyMessage.from"
					:network="network"
					:channel="channel"
					dir="auto"
				/>&#32;<ParsedMessage :message="prettyMessage" />
				<LinkPreview
					v-for="preview in prettyMessage.previews"
					:key="preview.link"
					:keep-scroll-position="keepScrollPosition"
					:link="preview"
					:channel="channel"
				/>
			</span>
		</template>
		<template v-else>
			<span v-if="prettyMessage.type === 'message'" class="from">
				<template v-if="prettyMessage.from && prettyMessage.from.nick">
					<span class="only-copy" aria-hidden="true">&lt;</span>
					<Username :user="prettyMessage.from" :network="network" :channel="channel" />
					<MessageBadges :badges="prettyMessage.badges" />
					<span class="only-copy" aria-hidden="true">&gt;&nbsp;</span>
				</template>
			</span>
			<span v-else-if="prettyMessage.type === 'plugin'" class="from">
				<template v-if="prettyMessage.from && prettyMessage.from.nick">
					<span class="only-copy" aria-hidden="true">[</span>
					{{ prettyMessage.from.nick }}
					<span class="only-copy" aria-hidden="true">]&nbsp;</span>
				</template>
			</span>
			<span v-else class="from">
				<template v-if="prettyMessage.from && prettyMessage.from.nick">
					<span class="only-copy" aria-hidden="true">-</span>
					<Username :user="prettyMessage.from" :network="network" :channel="channel" />
					<MessageBadges :badges="prettyMessage.badges" />
					<span class="only-copy" aria-hidden="true">-&nbsp;</span>
				</template>
			</span>
			<span class="content" dir="auto">
				<ReplyContext
					v-if="message.replyTo"
					:message="message"
					:parent-in-history="parentInHistory"
					@scroll-to-parent="scrollToParent"
				/>
				<span
					v-if="prettyMessage.showInActive"
					aria-label="This message was shown in your active channel"
					class="msg-shown-in-active tooltipped tooltipped-e"
					><span></span
				></span>
				<StatusmsgMarker :group="prettyMessage.statusmsgGroup" />
				<ParsedMessage :network="network" :message="prettyMessage" />
				<LinkPreview
					v-for="preview in prettyMessage.previews"
					:key="preview.link"
					:keep-scroll-position="keepScrollPosition"
					:link="preview"
					:channel="channel"
				/>
			</span>
		</template>
		<div v-if="canReply" class="msg-actions">
			<span class="tooltipped tooltipped-w tooltipped-no-touch" aria-label="Reply"
				><button class="msg-action-reply" aria-label="Reply" @click.stop="startReply"
			/></span>
		</div>
	</div>
</template>

<script lang="ts">
import {computed, defineComponent, onBeforeUnmount, PropType} from "vue";
import dayjs from "dayjs";

import constants from "../js/constants";
import eventbus from "../js/eventbus";
import localetime from "../js/helpers/localetime";
import Username from "./Username.vue";
import LinkPreview from "./LinkPreview.vue";
import ParsedMessage from "./ParsedMessage.vue";
import ReplyContext from "./ReplyContext.vue";
import MessageTypes from "./MessageTypes";
import StatusmsgMarker from "./StatusmsgMarker.vue";
import MessageBadges from "./MessageBadges.vue";

import type {ClientChan, ClientMessage, ClientNetwork} from "../js/types";
import {useStore} from "../js/store";
import {MessageType} from "../../shared/types/msg";
import {parser as shoutboxParser} from "../js/helpers/shoutbox-bridge/parser";
import {ChanType} from "../../shared/types/chan";
import {cleanIrcMessage} from "../../shared/irc";

MessageTypes.ParsedMessage = ParsedMessage;
MessageTypes.LinkPreview = LinkPreview;
MessageTypes.Username = Username;

export default defineComponent({
	name: "Message",
	components: {
		...MessageTypes,
		ReplyContext,
		StatusmsgMarker,
		MessageBadges,
	},
	props: {
		message: {type: Object as PropType<ClientMessage>, required: true},
		channel: {type: Object as PropType<ClientChan>, required: false},
		network: {type: Object as PropType<ClientNetwork>, required: true},
		keepScrollPosition: Function as PropType<() => void>,
		isPreviousSource: Boolean,
		isFocused: Boolean,
	},
	setup(props) {
		const store = useStore();
		let longPressTimer: ReturnType<typeof setTimeout> | null = null;
		let highlightTimer: ReturnType<typeof setTimeout> | null = null;

		const timeFormat = computed(() => {
			let format: keyof typeof constants.timeFormats;

			if (store.state.settings.use12hClock) {
				format = store.state.settings.showSeconds ? "msg12hWithSeconds" : "msg12h";
			} else {
				format = store.state.settings.showSeconds ? "msgWithSeconds" : "msgDefault";
			}

			return constants.timeFormats[format];
		});

		const messageTime = computed(() => {
			return dayjs(props.message.time).format(timeFormat.value);
		});

		const messageTimeLocale = computed(() => {
			return localetime(props.message.time);
		});

		const messageComponent = computed(() => {
			return "message-" + (props.message.type || "invalid"); // TODO: force existence of type in sharedmsg
		});

		// IRC Bridge formatter
		const prettyMessage = computed(() => {
			if (
				props.channel?.type !== ChanType.CHANNEL ||
				!store.state.settings.beautifyBridgedMessages ||
				props.message.type !== MessageType.MESSAGE
			) {
				return props.message;
			}

			return shoutboxParser(props.message);
		});

		// Without server +reply support, replying falls back to pre-filling "nick: "
		const canReply = computed(() => {
			if (store.state.settings.enableReplyToMessage === false) {
				return false;
			}

			if (!prettyMessage.value.from?.nick || !props.message.text) {
				return false;
			}

			const t = props.message.type;
			return (
				t === MessageType.MESSAGE || t === MessageType.ACTION || t === MessageType.NOTICE
			);
		});

		const parentInHistory = computed(() => {
			if (!props.message.replyTo || !props.channel) {
				return false;
			}

			return props.channel.messages.some((m) => m.msgid === props.message.replyTo);
		});

		const isAction = () => {
			if (!props.message.type) {
				return false;
			}

			return typeof MessageTypes["message-" + props.message.type] !== "undefined";
		};

		const requestReleaseName = computed(() => {
			if (props.channel?.type !== ChanType.CHANNEL) {
				return null;
			}

			const text = prettyMessage.value.text;

			if (!text) {
				return null;
			}

			const cleanText = cleanIrcMessage(text);

			const match = cleanText.match(
				/\[Request\]\s*-\s*\[\s*\d+\s*:\]\s*(.+?)(?=\s*~\s*by\b|$)/i
			);

			if (!match?.[1]) {
				return null;
			}

			const releaseName = match[1].trim();

			return releaseName.length > 0 ? releaseName : null;
		});

		const startReply = () => {
			// Use the parsed message so bridged shoutbox messages reply to the real user
			eventbus.emit("reply:start", {
				msgid: props.message.msgid,
				nick: prettyMessage.value.from?.nick,
				text: prettyMessage.value.text,
			});
		};

		const scrollToParent = () => {
			if (!props.message.replyTo) {
				return;
			}

			const el = document.querySelector(
				`.msg[data-msgid="${CSS.escape(props.message.replyTo)}"]`
			);

			if (el) {
				const wasHighlighted = el.classList.contains("highlight");

				el.scrollIntoView({block: "center", behavior: "smooth"});
				el.classList.add("highlight");

				if (highlightTimer !== null) {
					clearTimeout(highlightTimer);
				}

				highlightTimer = setTimeout(() => {
					highlightTimer = null;

					// We don't want to reset e.g. pings/keyword matches
					if (!wasHighlighted) {
						el.classList.remove("highlight");
					}
				}, 2000);
			}
		};

		const onTouchStart = () => {
			if (canReply.value) {
				longPressTimer = setTimeout(() => {
					longPressTimer = null;
					startReply();
				}, 500);
			}
		};

		const clearLongPress = () => {
			if (longPressTimer !== null) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		};

		const onTouchEnd = (e: TouchEvent) => {
			if (longPressTimer === null && canReply.value) {
				e.preventDefault();
			}

			clearLongPress();
		};

		const onTouchCancel = () => {
			clearLongPress();
		};

		onBeforeUnmount(() => {
			clearLongPress();

			if (highlightTimer !== null) {
				clearTimeout(highlightTimer);
			}
		});

		return {
			timeFormat,
			prettyMessage,
			messageTime,
			messageTimeLocale,
			messageComponent,
			canReply,
			parentInHistory,
			isAction,
			requestReleaseName,
			startReply,
			scrollToParent,
			onTouchStart,
			onTouchEnd,
			onTouchCancel,
		};
	},
});
</script>
