<template>
	<div>
		<!-- Native app -->
		<SettingCard v-if="canRegisterProtocol || hasInstallPromptEvent" title="Native app">
			<div v-if="hasInstallPromptEvent" class="setting-action-row">
				<div class="setting-card-intro">
					Install The Lounge as a standalone app on your device
				</div>
				<button type="button" class="btn btn-small" @click.prevent="nativeInstallPrompt">
					Add to Home screen
				</button>
			</div>
			<div v-if="canRegisterProtocol" class="setting-action-row">
				<div class="setting-card-intro">Handle irc:// links directly in The Lounge</div>
				<button type="button" class="btn btn-small" @click.prevent="registerProtocol">
					Register as irc:// handler
				</button>
			</div>
		</SettingCard>

		<!-- Input -->
		<SettingCard title="Input">
			<SettingToggle
				name="enableReplyToMessage"
				label="Reply button"
				description="Show a reply button on messages. Uses IRCv3 replies where the server supports them."
				:checked="store.state.settings.enableReplyToMessage"
			/>
			<SettingToggle
				name="enableRainbowHotkey"
				label="Rainbow hotkey"
				description="Turn the message into rainbow text with Ctrl+R. /rainbow and /rgb work either way."
				:checked="store.state.settings.enableRainbowHotkey"
			/>
		</SettingCard>

		<!-- Typing indicators -->
		<SettingCard title="Typing indicators">
			<div class="setting-card-intro">
				Show when others are typing, and let them see when you are
			</div>
			<label for="typing" class="sr-only">Typing indicators</label>
			<select id="typing" :value="store.state.settings.typing" name="typing" class="input">
				<option value="on">Send &amp; receive</option>
				<option value="receive">Receive only</option>
				<option value="off">Off</option>
			</select>
		</SettingCard>

		<!-- Search -->
		<SettingCard v-if="store.state.settings.searchEnabled" title="Search">
			<SettingToggle
				name="enableEnhancedSearch"
				label="Enhanced search"
				description='Show search results with a "Jump to message" action'
				:checked="store.state.settings.enableEnhancedSearch"
			/>
		</SettingCard>

		<!-- File uploads -->
		<SettingCard v-if="store.state.serverConfiguration?.fileUpload" title="File uploads">
			<SettingToggle
				name="uploadCanvas"
				label="Strip image metadata"
				description="Re-render images to remove EXIF data before uploading. May affect orientation in older browsers."
				:checked="store.state.settings.uploadCanvas"
			/>
			<template
				v-if="
					store.state.serverConfiguration?.allowFileUploadBackendSelection &&
					!store.state.serverConfiguration?.public
				"
			>
				<div class="upload-backend">
					<div class="setting-field">
						<label for="imageUploadBackend" class="setting-row-label">Backend</label>
						<select
							id="imageUploadBackend"
							name="imageUploadBackend"
							:value="store.state.settings.imageUploadBackend"
							class="input"
						>
							<option v-for="b in allBackends" :key="b.id" :value="b.id">
								{{ b.displayName }}
							</option>
						</select>
						<p v-if="selectedImageBackend?.supportNote" class="setting-hint">
							{{ selectedImageBackend.supportNote }}
						</p>
					</div>

					<div v-if="selectedImageBackend?.requiresToken" class="setting-field">
						<label class="setting-row-label"
							>{{ selectedImageBackend.displayName }} API key</label
						>
						<RevealPassword v-slot:default="slotProps">
							<input
								:type="slotProps.isVisible ? 'text' : 'password'"
								class="input"
								autocomplete="off"
								:value="apiKeys[imageBackend]"
								@input="
									apiKeys[imageBackend] = (
										$event.target as HTMLInputElement
									).value
								"
							/>
						</RevealPassword>
					</div>

					<div v-if="selectedImageBackend?.requiresUrl" class="setting-field">
						<label class="setting-row-label"
							>{{ selectedImageBackend.displayName }} URL</label
						>
						<input
							type="text"
							class="input"
							:placeholder="
								imageBackend === 'x0' ? 'https://x0.at' : 'https://example.com'
							"
							:value="apiUrls[imageBackend]"
							@blur="normalizeUrl(imageBackend)"
							@input="
								apiUrls[imageBackend] = ($event.target as HTMLInputElement).value
							"
						/>
						<p
							v-if="apiUrls[imageBackend] && !isValidUrl(apiUrls[imageBackend])"
							class="error"
						>
							Ungültige URL. Bitte verwende z.B. "https://x0.at" oder "x0.at" (wird
							automatisch zu https:// konvertiert)
						</p>
					</div>

					<div v-if="selectedImageBackend?.ttl" class="setting-field">
						<label class="setting-row-label"
							>{{ selectedImageBackend.displayName }} — Ablauf</label
						>
						<select
							class="input"
							:value="effectiveTtl(imageBackend)"
							@change="
								apiTtls[imageBackend] = ($event.target as HTMLSelectElement).value
							"
						>
							<option v-for="p in selectedImageBackend.ttl" :key="p.id" :value="p.id">
								{{ p.label }}
							</option>
						</select>
					</div>
				</div>

				<!-- File backend, only needed when the image backend can't take other files -->
				<div v-if="selectedImageBackend?.category === 'image'" class="upload-backend">
					<div class="setting-field">
						<label for="fileUploadBackend" class="setting-row-label"
							>File backend</label
						>
						<div class="setting-row-description">Used for files that aren't images</div>
						<select
							id="fileUploadBackend"
							name="fileUploadBackend"
							:value="store.state.settings.fileUploadBackend"
							class="input"
						>
							<option v-for="b in fileCapableBackends" :key="b.id" :value="b.id">
								{{ b.displayName }}
							</option>
						</select>
					</div>

					<div v-if="selectedFileBackend?.requiresToken" class="setting-field">
						<label class="setting-row-label"
							>{{ selectedFileBackend.displayName }} API key</label
						>
						<RevealPassword v-slot:default="slotProps">
							<input
								:type="slotProps.isVisible ? 'text' : 'password'"
								class="input"
								autocomplete="off"
								:value="apiKeys[fileBackend]"
								@input="
									apiKeys[fileBackend] = ($event.target as HTMLInputElement).value
								"
							/>
						</RevealPassword>
					</div>

					<div v-if="selectedFileBackend?.requiresUrl" class="setting-field">
						<label class="setting-row-label"
							>{{ selectedFileBackend.displayName }} URL</label
						>
						<input
							type="text"
							class="input"
							:placeholder="
								fileBackend === 'x0' ? 'https://x0.at' : 'https://example.com'
							"
							:value="apiUrls[fileBackend]"
							@blur="normalizeUrl(fileBackend)"
							@input="
								apiUrls[fileBackend] = ($event.target as HTMLInputElement).value
							"
						/>
						<p
							v-if="apiUrls[fileBackend] && !isValidUrl(apiUrls[fileBackend])"
							class="error"
						>
							Ungültige URL. Bitte verwende z.B. "https://example.com" oder
							"example.com" (wird automatisch zu https:// konvertiert)
						</p>
					</div>

					<div v-if="selectedFileBackend?.ttl" class="setting-field">
						<label class="setting-row-label"
							>{{ selectedFileBackend.displayName }} — Ablauf</label
						>
						<select
							class="input"
							:value="effectiveTtl(fileBackend)"
							@change="
								apiTtls[fileBackend] = ($event.target as HTMLSelectElement).value
							"
						>
							<option v-for="p in selectedFileBackend.ttl" :key="p.id" :value="p.id">
								{{ p.label }}
							</option>
						</select>
					</div>
				</div>

				<div class="setting-action-row upload-save">
					<button class="btn btn-small" type="button" @click="saveUploadConfig">
						Save upload settings
					</button>
					<span v-if="saveStatus" class="upload-save-status">{{ saveStatus }}</span>
				</div>
			</template>
		</SettingCard>

		<!-- Custom commands -->
		<SettingCard v-if="!store.state.serverConfiguration?.public" title="Custom commands">
			<div class="setting-card-intro">
				Shortcuts for frequently used commands. Placeholders: <code>$1</code> = first
				argument, <code>$2</code> = second argument, <code>$*</code> = all arguments.
			</div>
			<p class="setting-hint">
				Example: <code>op</code> → <code>/msg chanserv op #mychannel $1</code>, then
				<code>/op SomeUser</code> runs <code>/msg chanserv op #mychannel SomeUser</code>
			</p>

			<div v-if="!showRawJson" class="custom-commands">
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
						aria-label="Shortcut name"
						@keypress.enter.prevent="addCommand"
					/>
					<input
						v-model="newCommandExpansion"
						type="text"
						class="input"
						placeholder="/msg chanserv ..."
						aria-label="Command to run"
						@keypress.enter.prevent="addCommand"
					/>
					<button type="button" class="btn btn-small" @click="addCommand">Add</button>
				</div>
				<p v-if="commandError" class="error">{{ commandError }}</p>
			</div>

			<div v-else class="custom-commands">
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
		</SettingCard>

		<!-- Settings sync -->
		<SettingCard v-if="!store.state.serverConfiguration?.public" title="Settings sync">
			<SettingToggle
				name="syncSettings"
				label="Sync settings across devices"
				description="Keep your preferences in sync with other browsers and devices"
				:checked="store.state.settings.syncSettings"
			/>
			<template v-if="!store.state.settings.syncSettings">
				<div v-if="store.state.serverHasSettings" class="setting-action-row">
					<div class="setting-card-intro">
						<strong>Warning:</strong> Enabling sync will override this client's settings
						with those stored on the server.
					</div>
					<button type="button" class="btn btn-small" @click="onForceSyncClick">
						Sync settings and enable
					</button>
				</div>
				<div v-else class="setting-card-intro">
					No settings have been synced before. Enabling this will upload your current
					settings as the starting point for other devices.
				</div>
			</template>
		</SettingCard>

		<!-- Away message -->
		<SettingCard v-if="!store.state.serverConfiguration?.public" title="Away message">
			<div>
				<label for="awayMessage" class="setting-row-text">
					<div class="setting-row-label">Away message</div>
					<div class="setting-row-description">
						Automatically set when The Lounge is not open
					</div>
				</label>
				<input
					id="awayMessage"
					:value="store.state.settings.awayMessage"
					type="text"
					name="awayMessage"
					class="input"
					placeholder="Away message"
				/>
			</div>
		</SettingCard>
	</div>
</template>

<style>
.upload-backend {
	border-top: 1px solid color-mix(in srgb, var(--body-color) 6%, var(--window-bg-color));
	padding: 12px 0 4px;
}

.upload-save {
	display: flex;
	align-items: center;
	gap: 10px;
}

.upload-save-status {
	font-size: 13px;
	color: var(--body-color-muted);
}

.custom-commands {
	margin-top: 10px;
}

.custom-command-row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 0;
}

.custom-command-row + .custom-command-row {
	border-top: 1px solid color-mix(in srgb, var(--body-color) 6%, var(--window-bg-color));
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

.custom-command-row .btn {
	margin-bottom: 0;
}

.add-command-form {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 8px;
}

.add-command-form .input {
	margin-top: 0;
}

.add-command-form .input:first-child {
	width: 120px;
	flex-shrink: 0;
}

.add-command-form .btn {
	margin-bottom: 0;
}

.no-commands {
	font-size: 13px;
	color: var(--body-color-muted);
	padding: 6px 0;
}

.toggle-raw {
	margin-top: 12px;
	margin-bottom: 0;
}
</style>

<script lang="ts">
import {computed, defineComponent, onMounted, onUnmounted, ref} from "vue";
import {useStore} from "../../js/store";
import {BeforeInstallPromptEvent} from "../../js/types";
import {validateAliases} from "../../js/customCommands";
import {allBackends, fileCapableBackends} from "../../../shared/upload-backends";
import socket from "../../js/socket";
import RevealPassword from "../RevealPassword.vue";
import SettingCard from "./SettingCard.vue";
import SettingToggle from "./SettingToggle.vue";

let installPromptEvent: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
	e.preventDefault();
	installPromptEvent = e as BeforeInstallPromptEvent;
});

export default defineComponent({
	name: "GeneralSettings",
	components: {
		RevealPassword,
		SettingCard,
		SettingToggle,
	},
	setup() {
		const store = useStore();
		const canRegisterProtocol = ref(false);
		const showRawJson = ref(false);
		const newCommandName = ref("");
		const newCommandExpansion = ref("");
		const commandError = ref("");
		const jsonError = ref("");
		const apiKeys = ref<Record<string, string>>({});
		const apiUrls = ref<Record<string, string>>({});
		const apiTtls = ref<Record<string, string>>({});
		const saveStatus = ref("");

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

		const imageBackend = computed(() => String(store.state.settings.imageUploadBackend));
		const fileBackend = computed(() => String(store.state.settings.fileUploadBackend));
		const selectedImageBackend = computed(() => {
			const backend = String(store.state.settings.imageUploadBackend);
			return allBackends.find((b) => b.id === backend);
		});
		const selectedFileBackend = computed(() => {
			const backend = String(store.state.settings.fileUploadBackend);
			return allBackends.find((b) => b.id === backend);
		});

		const uploadConfigHandler = (data: unknown) => {
			if (
				typeof data === "object" &&
				data !== null &&
				"apiKeys" in data &&
				"apiUrls" in data &&
				typeof (data as {apiKeys: unknown}).apiKeys === "object" &&
				typeof (data as {apiUrls: unknown}).apiUrls === "object"
			) {
				apiKeys.value = {...((data as {apiKeys: Record<string, string>}).apiKeys || {})};
				apiUrls.value = {...((data as {apiUrls: Record<string, string>}).apiUrls || {})};

				const ttls = (data as {apiTtls?: unknown}).apiTtls;

				if (typeof ttls === "object" && ttls !== null) {
					apiTtls.value = {...(ttls as Record<string, string>)};
				} else {
					apiTtls.value = {};
				}
			}
		};

		const effectiveTtl = (backendId: string) => {
			const stored = apiTtls.value[backendId];

			if (stored) {
				return stored;
			}

			return (
				allBackends.find((b) => b.id === backendId)?.ttl?.find((p) => p.default)?.id ?? ""
			);
		};

		const uploadSavedHandler = () => {
			saveStatus.value = "Saved!";
			setTimeout(() => (saveStatus.value = ""), 2000);
		};

		onMounted(() => {
			// Enable protocol handler registration if supported,
			// and the network configuration is not locked
			canRegisterProtocol.value =
				!!window.navigator.registerProtocolHandler &&
				!store.state.serverConfiguration?.lockNetwork;

			if (store.state.serverConfiguration?.fileUpload) {
				socket.emit("upload:config:get");
				socket.on("upload:config", uploadConfigHandler);
				socket.on("upload:config:saved", uploadSavedHandler);
			}
		});

		onUnmounted(() => {
			socket.off("upload:config", uploadConfigHandler);
			socket.off("upload:config:saved", uploadSavedHandler);
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

		const isValidUrl = (urlString: string): boolean => {
			if (!urlString || urlString.trim() === "") {
				return true; // Empty URLs are allowed
			}

			try {
				new URL(urlString);
				return true;
			} catch {
				return false;
			}
		};

		const normalizeUrl = (backend: string) => {
			const url = apiUrls.value[backend]?.trim();

			if (!url) {
				return; // Keep empty URLs as-is
			}

			// Check if URL already has a protocol
			if (url.match(/^https?:\/\//)) {
				return; // Already has protocol
			}

			// If it looks like a domain or hostname without protocol, add https://
			if (url.includes(".") || url === "localhost") {
				apiUrls.value[backend] = `https://${url}`;
			}
		};

		const saveUploadConfig = () => {
			// Validate URLs before saving
			for (const backend of [imageBackend.value, fileBackend.value]) {
				if (apiUrls.value[backend] && !isValidUrl(apiUrls.value[backend])) {
					store.commit(
						"currentUserVisibleError",
						`Ungültige URL für ${backend}: Bitte gib eine vollständige URL ein`
					);
					return;
				}
			}

			socket.emit("upload:config:set", {
				apiKeys: apiKeys.value,
				apiUrls: apiUrls.value,
				apiTtls: apiTtls.value,
			});
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
			allBackends,
			fileCapableBackends,
			apiKeys,
			apiUrls,
			apiTtls,
			effectiveTtl,
			saveStatus,
			imageBackend,
			fileBackend,
			selectedImageBackend,
			selectedFileBackend,
			saveUploadConfig,
			isValidUrl,
			normalizeUrl,
		};
	},
});
</script>
