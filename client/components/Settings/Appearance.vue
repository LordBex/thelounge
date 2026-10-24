<template>
	<div>
		<SettingCard title="Theme">
			<label for="theme-select" class="sr-only">Theme</label>
			<select
				id="theme-select"
				:value="store.state.settings.theme"
				name="theme"
				class="input"
			>
				<option
					v-for="theme in store.state.serverConfiguration?.themes"
					:key="theme.name"
					:value="theme.name"
				>
					{{ theme.displayName }}
				</option>
			</select>
		</SettingCard>

		<SettingCard title="Messages">
			<SettingToggle
				name="motd"
				label="Show MOTD"
				description="Display the server's Message of the Day when connecting"
				:checked="store.state.settings.motd"
			/>
			<SettingToggle
				name="showSeconds"
				label="Include seconds in timestamps"
				description="Show seconds alongside hours and minutes in message timestamps"
				:checked="store.state.settings.showSeconds"
			/>
			<SettingToggle
				name="use12hClock"
				label="Use 12-hour clock"
				description="Display timestamps in 12-hour format instead of 24-hour"
				:checked="store.state.settings.use12hClock"
			/>
			<SettingToggle
				name="disableMutedUnread"
				label="Hide unread badges on muted channels"
				description="Muted channels won't show an unread message counter"
				:checked="store.state.settings.disableMutedUnread"
			/>
		</SettingCard>

		<SettingCard title="Bridged shoutbox messages">
			<SettingToggle
				name="beautifyBridgedMessages"
				label="Beautify bridged messages"
				description="Show messages relayed by supported shoutbox bridge bots as if the user wrote them directly"
				:checked="store.state.settings.beautifyBridgedMessages"
			/>
			<div
				class="setting-row-sub"
				role="group"
				aria-label="Bridged nickname style"
				:aria-disabled="!store.state.settings.beautifyBridgedMessages"
			>
				<div class="setting-card-intro">How bridged nicknames are displayed</div>
				<div class="setting-radio-pills">
					<label class="setting-radio-pill">
						<input
							:disabled="!store.state.settings.beautifyBridgedMessages || undefined"
							:checked="
								store.state.settings.bridgedMessageNicksStyle === 'parentheses'
							"
							type="radio"
							name="bridgedMessageNicksStyle"
							value="parentheses"
						/>
						<span class="pill-label">(nick)</span>
					</label>
					<label class="setting-radio-pill">
						<input
							:disabled="!store.state.settings.beautifyBridgedMessages || undefined"
							:checked="store.state.settings.bridgedMessageNicksStyle === 'normal'"
							type="radio"
							name="bridgedMessageNicksStyle"
							value="normal"
						/>
						<span class="pill-label">nick</span>
					</label>
				</div>
			</div>
		</SettingCard>

		<SettingCard v-if="store.state.serverConfiguration?.prefetch" title="Link previews">
			<SettingToggle
				name="media"
				label="Auto-expand media"
				description="Automatically show inline previews for images and videos"
				:checked="store.state.settings.media"
			/>
			<SettingToggle
				name="links"
				label="Auto-expand websites"
				description="Automatically show link previews for URLs"
				:checked="store.state.settings.links"
			/>
		</SettingCard>

		<SettingCard title="Status messages">
			<div class="setting-card-intro">
				Control how joins, parts, quits, kicks, nick changes, and mode changes appear
			</div>
			<div class="setting-radio-pills" role="group" aria-label="Status messages">
				<label class="setting-radio-pill">
					<input
						:checked="store.state.settings.statusMessages === 'shown'"
						type="radio"
						name="statusMessages"
						value="shown"
					/>
					<span class="pill-label">Show</span>
				</label>
				<label class="setting-radio-pill">
					<input
						:checked="store.state.settings.statusMessages === 'condensed'"
						type="radio"
						name="statusMessages"
						value="condensed"
					/>
					<span class="pill-label">Condense</span>
				</label>
				<label class="setting-radio-pill">
					<input
						:checked="store.state.settings.statusMessages === 'hidden'"
						type="radio"
						name="statusMessages"
						value="hidden"
					/>
					<span class="pill-label">Hide</span>
				</label>
			</div>
		</SettingCard>

		<SettingCard title="Layout">
			<SettingToggle
				name="compactSidebar"
				label="Compact sidebar"
				description="Use a denser channel list on desktop"
				:checked="store.state.settings.compactSidebar"
			/>
			<SettingToggle
				name="jumptoEabled"
				label="Jump to"
				description='Show the "Jump to" channel search in the sidebar'
				:checked="store.state.settings.jumptoEabled"
			/>
			<SettingToggle
				name="filterdmsEnabled"
				label="Filter DMs"
				description="Show a filter field in the direct messages section"
				:checked="store.state.settings.filterdmsEnabled"
			/>
			<SettingToggle
				name="showAllDMs"
				label="Always show all DMs"
				description="List every direct message channel in the sidebar"
				:checked="store.state.settings.showAllDMs"
			/>
			<SettingToggle
				name="enhancedUserListEnabled"
				label="Enhanced user list"
				description="Use the enhanced user list when the network supports it"
				:checked="store.state.settings.enhancedUserListEnabled"
			/>
			<SettingToggle
				name="enhancedContextMenuEnabled"
				label="Enhanced context menu"
				description="Show additional actions in the context menu"
				:checked="store.state.settings.enhancedContextMenuEnabled"
			/>
			<SettingToggle
				name="showInputNick"
				label="Show nick in input box"
				description="Display your current nickname next to the message input"
				:checked="store.state.settings.showInputNick"
			/>
		</SettingCard>

		<SettingCard title="Visual aids">
			<SettingToggle
				name="coloredNicks"
				label="Colored nicknames"
				description="Assign a unique color to each nickname in chat"
				:checked="store.state.settings.coloredNicks"
			/>
			<SettingToggle
				name="statusIndicators"
				label="Online status indicators"
				description="Show a dot for whether the person in a query window is online or away"
				:checked="store.state.settings.statusIndicators"
			/>
			<SettingToggle
				name="autocomplete"
				label="Autocomplete"
				description="Suggest nicknames, channels, and commands as you type"
				:checked="store.state.settings.autocomplete"
			/>
			<label for="nickPostfix" class="setting-row-text">
				<div class="setting-row-label">Nick autocomplete postfix</div>
				<div class="setting-row-description">
					Character added after a completed nickname (e.g. a comma)
				</div>
			</label>
			<input
				id="nickPostfix"
				:value="store.state.settings.nickPostfix"
				type="text"
				name="nickPostfix"
				class="input"
				placeholder="e.g. , "
			/>
		</SettingCard>

		<SettingCard title="Custom stylesheet">
			<div class="setting-card-intro">Override any style with your own CSS</div>
			<label for="user-specified-css-input" class="sr-only"> Custom stylesheet </label>
			<textarea
				id="user-specified-css-input"
				:value="store.state.settings.userStyles"
				class="input"
				name="userStyles"
				placeholder="/* You can override any style with CSS here */"
			/>
		</SettingCard>
	</div>
</template>

<style>
textarea#user-specified-css-input {
	height: 100px;
}
</style>

<script lang="ts">
import {defineComponent} from "vue";
import {useStore} from "../../js/store";
import SettingCard from "./SettingCard.vue";
import SettingToggle from "./SettingToggle.vue";

export default defineComponent({
	name: "AppearanceSettings",
	components: {
		SettingCard,
		SettingToggle,
	},
	setup() {
		const store = useStore();

		return {
			store,
		};
	},
});
</script>
