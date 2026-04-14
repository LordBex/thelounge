/**
 * Single source of truth for all upload backends
 * Imported by both server and client
 */

export type UploadBackend = {
	id: string;
	displayName: string;
	category: "image" | "both"; // "image" = image-hosters only; "both" = can handle any file
	requiresToken: boolean;
	requiresUrl: boolean;
	supportNote?: string;
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
	},
	{
		id: "catbox",
		displayName: "Catbox.moe",
		category: "image",
		requiresToken: false,
		requiresUrl: false,
		supportNote: "Optional: user hash for longer retention",
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
	},
	{
		id: "ptpimg",
		displayName: "PTPImg",
		category: "image",
		requiresToken: true,
		requiresUrl: false,
	},
];

export const fileCapableBackends = allBackends.filter((b) => b.category === "both");
