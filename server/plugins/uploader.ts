import Config from "../config.js";
import busboy, {BusboyHeaders} from "@fastify/busboy";
import {v4 as uuidv4} from "uuid";
import path from "node:path";
import fs from "node:fs";
import {fileTypeFromBuffer} from "file-type";
import {readChunk} from "read-chunk";
import crypto from "node:crypto";
import log from "../log.js";
import contentDisposition from "content-disposition";
import type {Socket} from "socket.io";
import {Application, Request, Response} from "express";
import {fetch, FormData} from "undici";
import type Client from "../client.js";
import {allBackends} from "../../shared/upload-backends.js";
import {encrypt, decrypt} from "../utils/secretCrypto.js";
import _ from "lodash";

// Map of allowed mime types to their respecive default filenames
// that will be rendered in browser without forcing them to be downloaded
const inlineContentDispositionTypes = {
	"application/ogg": "media.ogx",
	"audio/midi": "audio.midi",
	"audio/mpeg": "audio.mp3",
	"audio/ogg": "audio.ogg",
	"audio/vnd.wave": "audio.wav",
	"audio/x-flac": "audio.flac",
	"audio/x-m4a": "audio.m4a",
	"image/bmp": "image.bmp",
	"image/gif": "image.gif",
	"image/jpeg": "image.jpg",
	"image/png": "image.png",
	"image/webp": "image.webp",
	"image/avif": "image.avif",
	"image/jxl": "image.jxl",
	"text/plain": "text.txt",
	"video/mp4": "video.mp4",
	"video/ogg": "video.ogv",
	"video/webm": "video.webm",
};

type TokenEntry = {
	timeout: ReturnType<typeof setTimeout>;
	client: Client;
	backend: string;
};

const uploadTokens = new Map<string, TokenEntry>();

class Uploader {
	constructor(socket: Socket, client: Client) {
		socket.on("upload:auth", (backend: string) => {
			const validIds = allBackends.map((b) => b.id);

			if (!validIds.includes(backend)) {
				return;
			}

			const token = uuidv4();
			const timeout = setTimeout(() => uploadTokens.delete(token), 60 * 1000);

			uploadTokens.set(token, {timeout, client, backend});

			socket.emit("upload:auth", token);
		});

		socket.on("upload:ping", (token) => {
			if (typeof token !== "string") {
				return;
			}

			const entry = uploadTokens.get(token);

			if (!entry) {
				return;
			}

			clearTimeout(entry.timeout);
			entry.timeout = Uploader.createTokenTimeout(token);

			uploadTokens.set(token, entry);
		});

		// Upload config events (not in public mode)
		if (!Config.values.public) {
			socket.on("upload:config:get", () => {
				const decryptedKeys: Record<string, string> = {};

				for (const [id, enc] of Object.entries(client.config.uploadConfig?.apiKeys ?? {})) {
					decryptedKeys[id] = decrypt(enc);
				}

				socket.emit("upload:config", {
					apiKeys: decryptedKeys,
					apiUrls: {...(client.config.uploadConfig?.apiUrls ?? {})},
				});
			});

			socket.on("upload:config:set", (data) => {
				if (!_.isPlainObject(data)) {
					return;
				}

				const validIds = new Set(allBackends.map((b) => b.id));

				if (_.isPlainObject(data.apiKeys)) {
					for (const [id, key] of Object.entries(data.apiKeys)) {
						if (validIds.has(id) && typeof key === "string") {
							client.config.uploadConfig!.apiKeys[id] = encrypt(key);
						}
					}
				}

				if (_.isPlainObject(data.apiUrls)) {
					for (const [id, url] of Object.entries(data.apiUrls)) {
						if (validIds.has(id) && typeof url === "string") {
							// Allow empty URLs (to reset to default) and validate non-empty URLs
							if (url === "" || url.trim() === "") {
								client.config.uploadConfig!.apiUrls[id] = "";
							} else {
								try {
									new URL(url);
									client.config.uploadConfig!.apiUrls[id] = url;
								} catch {
									// Skip invalid URLs
									continue;
								}
							}
						}
					}
				}

				client.save();

				socket.emit("upload:config:saved");
			});
		}
	}

	static createTokenTimeout(this: void, token: string) {
		return setTimeout(() => uploadTokens.delete(token), 60 * 1000);
	}

	static router(this: void, express: Application) {
		express.get("/uploads/:name{/:slug}", Uploader.routeGetFile);
		express.post("/uploads/:backend/:token", Uploader.routeUploadFile);
	}

	static async routeGetFile(this: void, req: Request, res: Response) {
		const name = req.params.name as string;

		const nameRegex = /^[0-9a-f]{16}$/;

		if (!nameRegex.test(name)) {
			return res.status(404).send("Not found");
		}

		const folder = name.substring(0, 2);
		const uploadPath = Config.getFileUploadPath();
		const filePath = path.join(uploadPath, folder, name);

		let detectedMimeType = await Uploader.getFileType(filePath);

		// doesn't exist
		if (detectedMimeType === null) {
			return res.status(404).send("Not found");
		}

		// Force a download in the browser if it's not an allowed type (binary or otherwise unknown)
		let slug = req.params.slug as string;
		const isInline = detectedMimeType in inlineContentDispositionTypes;
		let disposition = isInline ? "inline" : "attachment";

		if (!slug && isInline) {
			slug = inlineContentDispositionTypes[detectedMimeType];
		}

		if (slug) {
			disposition = contentDisposition(slug.trim(), {
				fallback: false,
				type: disposition,
			});
		}

		// Send a more common mime type for audio files
		// so that browsers can play them correctly
		if (detectedMimeType === "audio/vnd.wave") {
			detectedMimeType = "audio/wav";
		} else if (detectedMimeType === "audio/x-flac") {
			detectedMimeType = "audio/flac";
		} else if (detectedMimeType === "audio/x-m4a") {
			detectedMimeType = "audio/mp4";
		} else if (detectedMimeType === "video/quicktime") {
			detectedMimeType = "video/mp4";
		}

		res.setHeader("Content-Disposition", disposition);
		res.setHeader("Cache-Control", "max-age=86400");
		res.contentType(detectedMimeType);

		const fileStream = fs.createReadStream(filePath);
		fileStream.on("error", (err) => {
			log.error(`Failed to stream file ${filePath}: ${err.message}`);

			if (!res.headersSent) {
				res.status(500).send("Failed to read file");
			}
		});
		return fileStream.pipe(res);
	}

	static routeUploadFile(this: void, req: Request, res: Response) {
		let busboyInstance: busboy | null | undefined;
		let uploadUrl: string | URL;
		let randomName: string;
		let destDir: fs.PathLike;
		let destPath: fs.PathLike | null;
		let fileName: string | null;
		let streamWriter: fs.WriteStream | null;
		let fileBuffer: Buffer | null = null;

		const doneCallback = () => {
			// detach the stream and drain any remaining data
			if (busboyInstance) {
				req.unpipe(busboyInstance);
				req.on("readable", req.read.bind(req));

				busboyInstance.removeAllListeners();
				busboyInstance = null;
			}

			// close the output file stream
			if (streamWriter) {
				streamWriter.end();
				streamWriter = null;
			}
		};

		const abortWithError = (err: unknown) => {
			doneCallback();

			// if we ended up erroring out, delete the output file from disk
			if (destPath && fs.existsSync(destPath)) {
				fs.unlinkSync(destPath);
				destPath = null;
			}

			return res.status(400).json({error: err instanceof Error ? err.message : String(err)});
		};

		// Extract backend and token from route params
		const backend = req.params.backend as string;
		const token = req.params.token as string;

		// if the authentication token is incorrect, bail out
		const entry = uploadTokens.get(token);

		if (!entry) {
			return abortWithError(Error("Invalid upload token"));
		}

		uploadTokens.delete(token);
		clearTimeout(entry.timeout);

		// if the request does not contain any body data, bail out
		if (req.headers["content-length"] && parseInt(req.headers["content-length"]) < 1) {
			return abortWithError(Error("Length Required"));
		}

		// Only allow multipart, as busboy can throw an error on unsupported types
		if (
			!(
				req.headers["content-type"] &&
				req.headers["content-type"].startsWith("multipart/form-data")
			)
		) {
			return abortWithError(Error("Unsupported Content Type"));
		}

		// create a new busboy processor, it is wrapped in try/catch
		// because it can throw on malformed headers
		try {
			busboyInstance = new busboy({
				headers: req.headers as BusboyHeaders,
				limits: {
					files: 1, // only allow one file per upload
					fileSize: Uploader.getMaxFileSize(),
				},
			});
		} catch (err) {
			return abortWithError(err);
		}

		// Any error or limit from busboy will abort the upload with an error
		busboyInstance.on("error", abortWithError);
		busboyInstance.on("partsLimit", () => abortWithError(Error("Parts limit reached")));
		busboyInstance.on("filesLimit", () => abortWithError(Error("Files limit reached")));
		busboyInstance.on("fieldsLimit", () => abortWithError(Error("Fields limit reached")));

		// generate a random output filename for the file
		// we use do/while loop to prevent the rare case of generating a file name
		// that already exists on disk
		do {
			randomName = crypto.randomBytes(8).toString("hex");
			destDir = path.join(Config.getFileUploadPath(), randomName.substring(0, 2));
			destPath = path.join(destDir, randomName);
		} while (fs.existsSync(destPath));

		// we split the filename into subdirectories (by taking 2 letters from the beginning)
		// this helps avoid file system and certain tooling limitations when there are
		// too many files on one folder
		try {
			fs.mkdirSync(destDir, {recursive: true});
		} catch (err: unknown) {
			log.error(
				`Error ensuring ${destDir} exists for uploads: ${err instanceof Error ? err.message : String(err)}`
			);

			return abortWithError(err);
		}

		// Open a file stream for writing
		streamWriter = fs.createWriteStream(destPath);
		streamWriter.on("error", abortWithError);

		busboyInstance.on(
			"file",
			(fieldname: string, fileStream: NodeJS.ReadableStream, filename: string) => {
				uploadUrl = `${randomName}/${encodeURIComponent(filename)}`;
				fileName = filename;

				if (Config.values.fileUpload.baseUrl) {
					uploadUrl = new URL(uploadUrl, Config.values.fileUpload.baseUrl).toString();
				} else {
					uploadUrl = `uploads/${uploadUrl}`;
				}

				// if the busboy data stream errors out or goes over the file size limit
				// abort the processing with an error
				fileStream.on("error", abortWithError);
				fileStream.on("limit", () => {
					fileStream.unpipe(streamWriter!);
					fileStream.on("readable", fileStream.read.bind(fileStream));

					return abortWithError(Error("File size limit reached"));
				});

				// Attempt to write the stream to file
				fileStream.pipe(streamWriter!);
			}
		);

		busboyInstance.on("finish", () => {
			const handleUploadComplete = async () => {
				if (!uploadUrl) {
					return res.status(400).json({error: "Missing file"});
				}

				// Handle external backends
				if (backend !== "local" && destPath && fs.existsSync(destPath)) {
					try {
						fileBuffer = fs.readFileSync(destPath);
						const result = await Uploader.handleExternalBackend(
							backend,
							entry.client,
							fileBuffer,
							fileName || path.basename(destPath.toString())
						);

						// Remove local temp file
						fs.unlinkSync(destPath);

						try {
							// Try to remove the directory if empty
							fs.rmdirSync(destDir);
						} catch (e: unknown) {
							// Ignore if directory is not empty
							if (
								e instanceof Error &&
								(e as NodeJS.ErrnoException).code !== "ENOTEMPTY" &&
								(e as NodeJS.ErrnoException).code !== "EEXIST"
							) {
								log.debug(
									`Failed to remove temporary upload directory: ${e.message}`
								);
							}
						}

						uploadUrl = result;
					} catch (err) {
						log.error(`External upload failed for backend ${backend}: ${String(err)}`);

						// Try to cleanup
						if (destPath && fs.existsSync(destPath)) {
							fs.unlinkSync(destPath);
						}

						try {
							if (fs.existsSync(destDir)) {
								fs.rmdirSync(destDir);
							}
						} catch {
							// Ignore cleanup errors on failure
						}

						return res.status(500).json({error: "External upload failed"});
					}
				}

				// upload was done, send the generated file url to the client
				res.status(200).json({
					url: uploadUrl,
					filename: fileName,
				});
			};

			// Wait for the write stream to fully close before processing
			if (streamWriter) {
				const writer = streamWriter;
				streamWriter = null;

				writer.end(() => {
					// Detach busboy after stream is closed
					if (busboyInstance) {
						req.unpipe(busboyInstance);
						req.on("readable", req.read.bind(req));
						busboyInstance.removeAllListeners();
						busboyInstance = null;
					}

					handleUploadComplete().catch((err) => {
						log.error(`Upload processing failed: ${String(err)}`);

						if (destPath && fs.existsSync(destPath)) {
							fs.unlinkSync(destPath);
						}

						if (!res.headersSent) {
							res.status(500).json({error: "Upload processing failed"});
						}
					});
				});
			} else {
				doneCallback();
				handleUploadComplete().catch((err) => {
					log.error(`Upload processing failed: ${String(err)}`);

					if (!res.headersSent) {
						res.status(500).json({error: "Upload processing failed"});
					}
				});
			}
		});

		// pipe request body to busboy for processing
		return req.pipe(busboyInstance);
	}

	static async handleExternalBackend(
		backend: string,
		client: Client,
		fileBuffer: Buffer,
		fileName: string
	): Promise<string> {
		const apiKeys = client.config.uploadConfig?.apiKeys ?? {};
		const apiUrls = client.config.uploadConfig?.apiUrls ?? {};
		const apiKey = decrypt(apiKeys[backend] ?? "");
		const apiUrl = apiUrls[backend] ?? "";

		switch (backend) {
			case "x0":
				return Uploader.handleX0Upload(fileBuffer, fileName, apiUrl || "https://x0.at");
			case "xbackbone":
				return Uploader.handleXBackboneUpload(fileBuffer, fileName, apiUrl, apiKey);
			case "imagebb":
				return Uploader.handleImageBBUpload(fileBuffer, fileName, apiKey);
			case "catbox":
				return Uploader.handleCatboxUpload(fileBuffer, fileName, apiKey);
			case "uguu":
				return Uploader.handleUguuUpload(fileBuffer, fileName);
			case "quax":
				return Uploader.handleQuaxUpload(fileBuffer, fileName);
			case "ptpimg":
				return Uploader.handlePTPImgUpload(fileBuffer, fileName, apiKey);
			default:
				throw new Error(`Unknown backend: ${backend}`);
		}
	}

	static async handleX0Upload(buf: Buffer, name: string, host: string): Promise<string> {
		const hostUrl = host || "https://x0.at";
		const form = new FormData();
		form.append("file", new Blob([new Uint8Array(buf)]), name);
		form.append("id_length", "16");

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

		try {
			const response = await fetch(hostUrl, {
				method: "POST",
				body: form,
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Upload to ${hostUrl} failed: ${response.statusText}`);
			}

			const resultUrl = await response.text();
			return resultUrl.trim();
		} finally {
			clearTimeout(timeout);
		}
	}

	static async handleXBackboneUpload(
		buf: Buffer,
		name: string,
		url: string,
		token: string
	): Promise<string> {
		const form = new FormData();
		form.append("file", new Blob([new Uint8Array(buf)]), name);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60000);

		try {
			const uploadUrl = url.endsWith("/") ? url + "upload" : url + "/upload";
			const response = await fetch(uploadUrl, {
				method: "POST",
				body: form,
				headers: {
					"X-Api-Key": token,
				},
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(
					`Upload to XBackbone failed: ${response.status} ${response.statusText}`
				);
			}

			const data = (await response.json()) as {url?: string};

			if (!data.url) {
				throw new Error("No URL in XBackbone response");
			}

			return data.url;
		} finally {
			clearTimeout(timeout);
		}
	}

	static async handleImageBBUpload(buf: Buffer, name: string, apiKey: string): Promise<string> {
		const form = new FormData();
		form.append("image", new Blob([new Uint8Array(buf)]), name);
		form.append("key", apiKey);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60000);

		try {
			const response = await fetch("https://api.imgbb.com/1/upload", {
				method: "POST",
				body: form,
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Upload to ImageBB failed: ${response.status}`);
			}

			const data = (await response.json()) as {data?: {url?: string}};

			if (!data.data?.url) {
				throw new Error("No URL in ImageBB response");
			}

			return data.data.url;
		} finally {
			clearTimeout(timeout);
		}
	}

	static async handleCatboxUpload(buf: Buffer, name: string, userHash?: string): Promise<string> {
		const form = new FormData();
		form.append("fileToUpload", new Blob([new Uint8Array(buf)]), name);
		form.append("reqtype", "fileupload");

		if (userHash) {
			form.append("userhash", userHash);
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60000);

		try {
			const response = await fetch("https://catbox.moe/user/api.php", {
				method: "POST",
				body: form,
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Upload to Catbox failed: ${response.status}`);
			}

			const url = await response.text();

			if (url.startsWith("error")) {
				throw new Error(`Catbox error: ${url}`);
			}

			return url.trim();
		} finally {
			clearTimeout(timeout);
		}
	}

	static async handleUguuUpload(buf: Buffer, name: string): Promise<string> {
		const form = new FormData();
		form.append("files[]", new Blob([new Uint8Array(buf)]), name);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60000);

		try {
			const response = await fetch("https://uguu.se/upload", {
				method: "POST",
				body: form,
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Upload to Uguu failed: ${response.status}`);
			}

			const data = (await response.json()) as {files?: Array<{url?: string}>};

			if (!data.files?.[0]?.url) {
				throw new Error("No URL in Uguu response");
			}

			return data.files[0].url;
		} finally {
			clearTimeout(timeout);
		}
	}

	static async handleQuaxUpload(buf: Buffer, name: string): Promise<string> {
		const form = new FormData();
		form.append("files[]", new Blob([new Uint8Array(buf)]), name);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60000);

		try {
			const response = await fetch("https://qu.ax/upload", {
				method: "POST",
				body: form,
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Upload to Qu.ax failed: ${response.status}`);
			}

			const data = (await response.json()) as {files?: Array<{url?: string}>};

			if (!data.files?.[0]?.url) {
				throw new Error("No URL in Qu.ax response");
			}

			return data.files[0].url;
		} finally {
			clearTimeout(timeout);
		}
	}

	static async handlePTPImgUpload(buf: Buffer, name: string, apiKey: string): Promise<string> {
		const form = new FormData();
		form.append("file", new Blob([new Uint8Array(buf)]), name);
		form.append("api_key", apiKey);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60000);

		try {
			const response = await fetch("https://ptpimg.me/upload.php", {
				method: "POST",
				body: form,
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`Upload to PTPImg failed: ${response.status}`);
			}

			const data = (await response.json()) as Array<{code?: string; ext?: string}>;

			if (!data[0]?.code || !data[0]?.ext) {
				throw new Error("No code/ext in PTPImg response");
			}

			return `https://ptpimg.me/${data[0].code}.${data[0].ext}`;
		} finally {
			clearTimeout(timeout);
		}
	}

	static getMaxFileSize() {
		const configOption = Config.values.fileUpload.maxFileSize;

		// Busboy uses Infinity to allow unlimited file size
		if (configOption < 1) {
			return Infinity;
		}

		// maxFileSize is in bytes, but config option is passed in as KB
		return configOption * 1024;
	}

	// Returns null if an error occurred (e.g. file not found)
	// Returns a string with the type otherwise
	static async getFileType(filePath: string) {
		try {
			const buffer = await readChunk(filePath, {length: 5120, startPosition: 0});

			// returns {ext, mime} if found, null if not.
			const file = await fileTypeFromBuffer(buffer);

			// if a file type was detected correctly, return it
			if (file) {
				return file.mime;
			}

			// if the buffer is a valid UTF-8 buffer, use text/plain
			try {
				new TextDecoder("utf-8", {fatal: true}).decode(buffer);
				return "text/plain";
			} catch {
				// Not valid UTF-8, continue to detect as binary
			}

			// otherwise assume it's random binary data
			return "application/octet-stream";
		} catch (e: unknown) {
			if (e && typeof e === "object" && "code" in e && e.code !== "ENOENT") {
				const message = e instanceof Error ? e.message : "unknown error";
				log.warn(`Failed to read ${filePath}: ${message}`);
			}
		}

		return null;
	}
}

export default Uploader;
