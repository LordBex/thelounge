<template>
	<span v-if="badges && badges.length > 0" class="message-badges" aria-hidden="true">
		<span
			v-for="badge in badges"
			:key="badge.label"
			class="message-badge"
			:title="badge.title"
			>{{ badge.label }}</span
		>
	</span>
</template>

<script lang="ts">
import {defineComponent, PropType} from "vue";
import type {MessageBadge} from "../../shared/types/msg";

export default defineComponent({
	name: "MessageBadges",
	props: {
		badges: {type: Array as PropType<MessageBadge[]>, default: () => []},
	},
});
</script>
