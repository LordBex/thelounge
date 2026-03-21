<template>
	<div>
		<div v-if="canRegisterProtocol || hasInstallPromptEvent">
			<h2>Native app</h2>
			<button
				v-if="hasInstallPromptEvent"
				type="button"
				class="btn"
				@click.prevent="nativeInstallPrompt"
			>
				Add The Lounge to Home screen
			</button>
			<button
				v-if="canRegisterProtocol"
				type="button"
				class="btn"
				@click.prevent="registerProtocol"
			>
				Open irc:// URLs with The Lounge
			</button>
		</div>
		<div v-if="store.state.serverConfiguration?.fileUpload">
			<h2>File uploads</h2>
			<div>
				<label class="opt">
					<input
						:checked="store.state.settings.uploadCanvas"
						type="checkbox"
						name="uploadCanvas"
					/>
					Attempt to remove metadata from images before uploading
					<span
						class="tooltipped tooltipped-n tooltipped-no-delay"
						aria-label="This option renders the image into a canvas element to remove metadata from the image.
	This may break orientation if your browser does not support that."
					>
						<button class="extra-help" />
					</span>
				</label>
			</div>
		</div>
		<div v-if="store.state.settings.searchEnabled">
			<h2>Enhanced search</h2>
			<label class="opt">
				<input
					:checked="store.state.settings.enableEnhancedSearch"
					type="checkbox"
					name="enableEnhancedSearch"
				/>
				Enable enhanced search with 'Jump to message'
			</label>
		</div>
		<div v-if="store.state.settings.searchEnabled">
			<h2>Input</h2>
			<label class="opt">
				<input
					:checked="store.state.settings.enableRainbowHotkey"
					type="checkbox"
					name="enableRainbowHotkey"
				/>
				Enable rainbow messages with 'Ctrl+R' hotkey
				<span
					class="tooltipped tooltipped-n tooltipped-no-delay"
					aria-label="You can still use rainbow text with '/rainbow' or '/rgb'"
				>
					<button class="extra-help" />
				</span>
			</label>
		</div>
		<div v-if="!store.state.serverConfiguration?.public">
			<h2>Settings synchronisation</h2>
			<label class="opt">
				<input
					:checked="store.state.settings.syncSettings"
					type="checkbox"
					name="syncSettings"
				/>
				Synchronize settings with other clients
			</label>
			<template v-if="!store.state.settings.syncSettings">
				<div v-if="store.state.serverHasSettings" class="settings-sync-panel">
					<p>
						<strong>Warning:</strong> Checking this box will override the settings of
						this client with those stored on the server.
					</p>
					<p>
						Use the button below to enable synchronization, and override any settings
						already synced to the server.
					</p>
					<button type="button" class="btn btn-small" @click="onForceSyncClick">
						Sync settings and enable
					</button>
				</div>
				<div v-else class="settings-sync-panel">
					<p>
						<strong>Warning:</strong> No settings have been synced before. Enabling this
						will sync all settings of this client as the base for other clients.
					</p>
				</div>
			</template>
		</div>
		<div v-if="!store.state.serverConfiguration?.public">
			<h2>Automatic away message</h2>

			<label class="opt">
				<label for="awayMessage" class="sr-only">Automatic away message</label>
				<input
					id="awayMessage"
					:value="store.state.settings.awayMessage"
					type="text"
					name="awayMessage"
					class="input"
					placeholder="Away message if The Lounge is not open"
				/>
			</label>
		</div>
		<div v-if="!store.state.serverConfiguration?.public">
			<h2>Custom Commands</h2>
			<p class="help">
				Define shortcuts for frequently used commands. Placeholders:
				<code>$1</code> = first argument, <code>$2</code> = second argument,
				<code>$*</code> = all arguments.
			</p>
			<p class="help example">
				Example: <code>op</code> → <code>/msg chanserv op #mychannel $1</code><br />
				Usage: <code>/op SomeUser</code> expands to
				<code>/msg chanserv op #mychannel SomeUser</code>
			</p>

			<div v-if="!showRawJson">
				<!-- List-based editor -->
				<div
					v-for="(expansion, cmd) in customCommandsList"
					:key="cmd"
					class="custom-command-row"
				>
					<code>/{{ cmd }}</code>
					<span class="arrow">→</span>
					<code class="expansion">{{ expansion }}</code>
					<button type="button" class="btn btn-small" @click="removeCommand(cmd)">
						Remove
					</button>
				</div>
				<div v-if="Object.keys(customCommandsList).length === 0" class="no-commands">
					No custom commands defined yet.
				</div>
				<div class="add-command-form">
					<input
						v-model="newCommandName"
						type="text"
						class="input"
						placeholder="shortcut"
						@keypress.enter.prevent="addCommand"
					/>
					<input
						v-model="newCommandExpansion"
						type="text"
						class="input"
						placeholder="/msg chanserv ..."
						@keypress.enter.prevent="addCommand"
					/>
					<button type="button" class="btn btn-small" @click="addCommand">Add</button>
				</div>
				<p v-if="commandError" class="error">{{ commandError }}</p>
			</div>

			<div v-else>
				<!-- Raw JSON editor -->
				<label for="customCommandsRaw" class="sr-only">Custom commands JSON</label>
				<textarea
					id="customCommandsRaw"
					:value="customCommandsJson"
					class="input"
					rows="6"
					placeholder='{"shortcut": "/msg chanserv ..."}'
					@input="updateRawJson"
				/>
				<p v-if="jsonError" class="error">{{ jsonError }}</p>
			</div>

			<button type="button" class="btn btn-small toggle-raw" @click="toggleRawJson">
				{{ showRawJson ? "Show list editor" : "Show raw JSON" }}
			</button>
		</div>
	</div>
</template>

<style>
.custom-command-row {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 8px;
	padding: 4px 0;
}

.custom-command-row .arrow {
	color: var(--body-color-muted);
}

.custom-command-row .expansion {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.add-command-form {
	display: flex;
	gap: 8px;
	margin-top: 12px;
}

.add-command-form .input:first-child {
	width: 120px;
	flex-shrink: 0;
}

.no-commands {
	color: var(--body-color-muted);
	margin-bottom: 8px;
}

.help.example {
	font-size: 0.9em;
	color: var(--body-color-muted);
	margin-top: 4px;
}

.help.example code {
	color: var(--body-color);
}

.toggle-raw {
	margin-top: 12px;
}

.error {
	color: var(--error-color);
	margin-top: 8px;
}
</style>

<script lang="ts">
import {computed, defineComponent, onMounted, ref} from "vue";
import {useStore} from "../../js/store";
import {BeforeInstallPromptEvent} from "../../js/types";
import {validateAliases} from "../../js/customCommands";

let installPromptEvent: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault();
	installPromptEvent = e as BeforeInstallPromptEvent;
});

export default defineComponent({
	name: "GeneralSettings",
	setup() {
		const store = useStore();
		const canRegisterProtocol = ref(false);
		const showRawJson = ref(false);
		const newCommandName = ref("");
		const newCommandExpansion = ref("");
		const commandError = ref("");
		const jsonError = ref("");

		const hasInstallPromptEvent = computed(() => {
			// TODO: This doesn't hide the button after clicking
			return installPromptEvent !== null;
		});

		const customCommandsList = computed(() => {
			return store.state.settings.customCommands || {};
		});

		const customCommandsJson = computed(() => {
			return JSON.stringify(store.state.settings.customCommands || {}, null, 2);
		});

		onMounted(() => {
			// Enable protocol handler registration if supported,
			// and the network configuration is not locked
			canRegisterProtocol.value =
				!!window.navigator.registerProtocolHandler &&
				!store.state.serverConfiguration?.lockNetwork;
		});

		const nativeInstallPrompt = () => {
			if (!installPromptEvent) {
				return;
			}

			installPromptEvent.prompt().catch((e) => {
				// eslint-disable-next-line no-console
				console.error(e);
			});

			installPromptEvent = null;
		};

		const onForceSyncClick = () => {
			store.dispatch("settings/syncAll", true).catch((e) => {
				// eslint-disable-next-line no-console
				console.error(e);
			});

			store
				.dispatch("settings/update", {
					name: "syncSettings",
					value: true,
					sync: true,
				})
				.catch((e) => {
					// eslint-disable-next-line no-console
					console.error(e);
				});
		};

		const registerProtocol = () => {
			const uri = document.location.origin + document.location.pathname + "?uri=%s";
			// The third argument was deprecated and has been removed from the spec
			window.navigator.registerProtocolHandler("irc", uri);
			window.navigator.registerProtocolHandler("ircs", uri);
		};

		const toggleRawJson = () => {
			showRawJson.value = !showRawJson.value;
			jsonError.value = "";
		};

		const addCommand = () => {
			commandError.value = "";
			const name = newCommandName.value.trim().toLowerCase();
			const expansion = newCommandExpansion.value.trim();

			if (!name) {
				commandError.value = "Command name is required.";
				return;
			}

			if (!expansion) {
				commandError.value = "Expansion is required.";
				return;
			}

			if (!name.match(/^[a-zA-Z0-9_-]+$/)) {
				commandError.value =
					"Command name can only contain letters, numbers, underscores, and hyphens.";
				return;
			}

			const updated = {...store.state.settings.customCommands, [name]: expansion};
			store
				.dispatch("settings/update", {
					name: "customCommands",
					value: updated,
					sync: true,
				})
				.catch((e) => {
					// eslint-disable-next-line no-console
					console.error(e);
				});

			newCommandName.value = "";
			newCommandExpansion.value = "";
		};

		const removeCommand = (name: string) => {
			const updated = {...store.state.settings.customCommands};
			delete updated[name];
			store
				.dispatch("settings/update", {
					name: "customCommands",
					value: updated,
					sync: true,
				})
				.catch((e) => {
					// eslint-disable-next-line no-console
					console.error(e);
				});
		};

		const updateRawJson = (e: Event) => {
			jsonError.value = "";
			const value = (e.target as HTMLTextAreaElement).value;

			if (!value.trim()) {
				store
					.dispatch("settings/update", {
						name: "customCommands",
						value: {},
						sync: true,
					})
					.catch((err) => {
						// eslint-disable-next-line no-console
						console.error(err);
					});
				return;
			}

			try {
				const parsed = JSON.parse(value);
				const validation = validateAliases(parsed);

				if (!validation.valid) {
					jsonError.value = validation.error || "Invalid format";
					return;
				}

				store
					.dispatch("settings/update", {
						name: "customCommands",
						value: validation.result,
						sync: true,
					})
					.catch((err) => {
						// eslint-disable-next-line no-console
						console.error(err);
					});
			} catch {
				jsonError.value = "Invalid JSON format.";
			}
		};

		return {
			store,
			canRegisterProtocol,
			hasInstallPromptEvent,
			nativeInstallPrompt,
			onForceSyncClick,
			registerProtocol,
			showRawJson,
			customCommandsList,
			customCommandsJson,
			newCommandName,
			newCommandExpansion,
			commandError,
			jsonError,
			toggleRawJson,
			addCommand,
			removeCommand,
			updateRawJson,
		};
	},
});
</script>
