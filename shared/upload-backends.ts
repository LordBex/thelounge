/**
 * Single source of truth for all upload backends
 * Imported by both server and client
 */

export type UploadBackendTtlPreset = {
	id: string;
	label: string;
	value: string | number;
	default: boolean;
};

export type UploadBackend = {
	id: string;
	displayName: string;
	category: "image" | "both"; // "image" = image-hosters only; "both" = can handle any file
	requiresToken: boolean;
	requiresUrl: boolean;
	supportNote?: string;
	ttl?: UploadBackendTtlPreset[];
};

export const allBackends: UploadBackend[] = [
	{
		id: "local",
		displayName: "TheLounge (Local)",
		category: "both",
		requiresToken: false,
		requiresUrl: false,
	},
	{
		id: "x0",
		displayName: "x0.at",
		category: "both",
		requiresToken: false,
		requiresUrl: true,
	},
	{
		id: "xbackbone",
		displayName: "XBackbone",
		category: "both",
		requiresToken: true,
		requiresUrl: true,
	},
	{
		id: "imagebb",
		displayName: "ImageBB",
		category: "image",
		requiresToken: true,
		requiresUrl: false,
		supportNote: "Supported files: Images",
		ttl: [
			{id: "1week", label: "1 Week", value: "604800", default: false},
			{id: "3days", label: "3 Days", value: "259200", default: true},
			{id: "1day", label: "1 Day", value: "86400", default: false},
			{id: "forever", label: "Keep Forever", value: "-", default: false},
		],
	},
	{
		id: "catbox",
		displayName: "Catbox.moe",
		category: "image",
		requiresToken: false,
		requiresUrl: false,
		supportNote: "Supported files: Images, Videos, Audio, and Text",
		ttl: [
			{id: "3days", label: "3 Days", value: "72h", default: true},
			{id: "1day", label: "1 Day", value: "24h", default: false},
			{id: "forever", label: "Keep Forever", value: "-", default: false},
		],
	},
	{
		id: "uguu",
		displayName: "Uguu.se",
		category: "image",
		requiresToken: false,
		requiresUrl: false,
		supportNote: "Files removed after 3 hours",
	},
	{
		id: "quax",
		displayName: "Qu.ax",
		category: "image",
		requiresToken: false,
		requiresUrl: false,
		supportNote: "Supported files: Images, Video, and Text",
		ttl: [
			{id: "1week", label: "1 Week", value: "7", default: false},
			{id: "3days", label: "3 Days", value: "3", default: true},
			{id: "1day", label: "1 Day", value: "1", default: false},
			{id: "forever", label: "Keep Forever", value: "-1", default: false},
		],
	},
	{
		id: "ptpimg",
		displayName: "PTPImg",
		category: "image",
		requiresToken: true,
		requiresUrl: false,
		supportNote: "Supported files: Images",
	},
];

export const fileCapableBackends = allBackends.filter((b) => b.category === "both");
