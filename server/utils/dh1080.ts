// DH1080 Key Exchange Implementation for FiSH
//
// Based on WeeChat fish.py by Bjorn Edstrom <be@bjrn.se>
// Ported to TypeScript for TheLounge
//
// Copyright (c) 2009, Bjorn Edstrom <be@bjrn.se>
// Permission to use, copy, modify, and distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.

import crypto from "node:crypto";

// Types
export interface DH1080Ctx {
	public: bigint;
	private: bigint;
	secret: bigint;
	state: number; // 0=init, 1=received_init
}

// DH1080 Parameters (from fish.py)
const DH1080_G = 2n;

// 1080-bit prime (FBE1022E...)
const DH1080_P_STR =
	"FBE1022E23D213E8ACFA9AE8B9DFADA3EA6B7AC7A7B7E95AB5EB2DF858921FEADE95E6AC7BE7DE6ADBAB8A783E7AF7A7FA6A2B7BEB1E72EAE2B72F9FA2BFB2A2EFBEFAC868BADB3E828FA8BADFADA3E4CC1BE7E8AFE85E9698A783EB68FA07A77AB6AD7BEB618ACF9CA2897EB28A6189EFA07AB99A8A7FA9AE299EFA7BA66DEAFEFBEFBF0B7D8B";
const DH1080_P = BigInt(`0x${DH1080_P_STR}`);
const DH1080_Q = (DH1080_P - 1n) / 2n;

// Standard base64 alphabet (NOT the FiSH base64)
const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * A non-standard base64 encode matching fish.py's dh1080_b64encode
 * This is NOT standard RFC 4648 base64 - it's the fish.py variant
 */
function dh1080B64Encode(data: Buffer): string {
	const b64 = B64_ALPHABET;
	const d: number[] = new Array(data.length * 2).fill(0);

	const L = data.length * 8;
	let m = 0x80;
	let i = 0;
	let j = 0;
	let k = 0;
	let t = 0;

	while (i < L) {
		if ((data[i >> 3] & m) !== 0) {
			t |= 1;
		}

		j++;

		m >>= 1;

		if (m === 0) {
			m = 0x80;
		}

		if (j % 6 === 0) {
			d[k] = b64.charCodeAt(t);
			t &= 0;
			k++;
		}

		t <<= 1;
		t %= 0x100;
		i++;
	}

	m = 5 - (j % 6);

	t <<= m;
	t %= 0x100;

	if (m !== 0) {
		d[k] = b64.charCodeAt(t);
		k++;
	}

	d[k] = 0;

	let res = "";

	for (const q of d) {
		if (q === 0) {
			break;
		}

		res += String.fromCharCode(q);
	}

	return res;
}

/**
 * A non-standard base64 decode matching fish.py's dh1080_b64decode
 * This is NOT standard RFC 4648 base64 - it's the fish.py variant
 */
function dh1080B64Decode(str: string): Buffer {
	const b64 = B64_ALPHABET;
	const buf: number[] = new Array(256).fill(0);

	for (let i = 0; i < 64; i++) {
		buf[b64.charCodeAt(i)] = i;
	}

	let L = str.length;

	if (L < 2) {
		throw new Error("Invalid base64 string");
	}

	// Strip trailing nulls/padding
	for (let i = L - 2; i >= 0; i--) {
		if (buf[str.charCodeAt(i)] === 0) {
			L--;
		} else {
			break;
		}
	}

	if (L < 2) {
		throw new Error("Invalid base64 string");
	}

	const d: number[] = new Array(L).fill(0);
	let i = 0;
	let k = 0;

	while (true) {
		i++;

		if (k + 1 < L) {
			d[i - 1] = (buf[str.charCodeAt(k)] << 2) % 0x100;
		} else {
			break;
		}

		k++;

		if (k < L) {
			d[i - 1] |= buf[str.charCodeAt(k)] >> 4;
		} else {
			break;
		}

		i++;

		if (k + 1 < L) {
			d[i - 1] = (buf[str.charCodeAt(k)] << 4) % 0x100;
		} else {
			break;
		}

		k++;

		if (k < L) {
			d[i - 1] |= buf[str.charCodeAt(k)] >> 2;
		} else {
			break;
		}

		i++;

		if (k + 1 < L) {
			d[i - 1] = (buf[str.charCodeAt(k)] << 6) % 0x100;
		} else {
			break;
		}

		k++;

		if (k < L) {
			d[i - 1] |= buf[str.charCodeAt(k)] % 0x100;
		} else {
			break;
		}

		k++;
	}

	return Buffer.from(d.slice(0, i - 1));
}

/**
 * Validate public key per RFC 2631 section 2.1.5
 * Returns true if valid, false otherwise
 */
export function dh1080ValidatePublicKey(publicKey: bigint): boolean {
	try {
		if (publicKey < 2n || publicKey >= DH1080_P - 1n) {
			return false;
		}

		// Check if publicKey^q mod p == 1
		const result = modPow(publicKey, DH1080_Q, DH1080_P);
		return result === 1n;
	} catch {
		return false;
	}
}

/**
 * Modular exponentiation: (base^exp) mod mod
 * JavaScript doesn't have built-in BigInt modpow, so we implement it
 */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
	let result = 1n;
	base = base % mod;

	while (exp > 0n) {
		if (exp % 2n === 1n) {
			result = (result * base) % mod;
		}

		exp = exp >> 1n;
		base = (base * base) % mod;
	}

	return result;
}

/**
 * Convert BigInt to Buffer (big-endian)
 */
function int2Bytes(n: bigint): Buffer {
	// Convert to hex and pad to even length
	let hex = n.toString(16);

	// Pad to even number of characters (full bytes)
	if (hex.length % 2 !== 0) {
		hex = "0" + hex;
	}

	return Buffer.from(hex, "hex");
}

/**
 * Convert Buffer to BigInt (big-endian)
 */
function bytes2Int(buf: Buffer): bigint {
	return BigInt(`0x${buf.toString("hex")}`);
}

/**
 * Create a new DH1080 context with generated keypair
 */
export function dh1080Create(): DH1080Ctx {
	const bits = 1080;
	const privateKeyBytes = Math.floor(bits / 8); // 135 bytes

	let valid = false;
	let publicKey: bigint = 0n;
	let privateKey: bigint = 0n;

	// Keep generating until we get a valid key
	while (!valid) {
		// Generate random private key
		const randomBytes = crypto.randomBytes(privateKeyBytes);
		privateKey = bytes2Int(randomBytes);

		// Calculate public key: g^private mod p
		publicKey = modPow(DH1080_G, privateKey, DH1080_P);

		// Validate the public key
		if (publicKey >= 2n && publicKey <= DH1080_P - 1n && dh1080ValidatePublicKey(publicKey)) {
			valid = true;
		}
	}

	return {
		public: publicKey,
		private: privateKey,
		secret: 0n,
		state: 0,
	};
}

/**
 * Pack a DH1080 message into protocol format
 * @param ctx - DH1080 context
 * @param isFinish - true for DH1080_FINISH, false for DH1080_INIT
 */
export function dh1080Pack(ctx: DH1080Ctx, isFinish = false): string {
	const cmd = isFinish ? "DH1080_FINISH " : "DH1080_INIT ";
	const publicKeyBytes = int2Bytes(ctx.public);
	const encoded = dh1080B64Encode(publicKeyBytes);

	return cmd + encoded;
}

/**
 * Unpack and process a DH1080 message
 * @param message - The DH1080_INIT or DH1080_FINISH message
 * @param ctx - DH1080 context to update
 * @returns true if successful, false otherwise
 */
export function dh1080Unpack(message: string, ctx: DH1080Ctx): boolean {
	if (!message.startsWith("DH1080_")) {
		return false;
	}

	// Parse the message
	const parts = message.split(" ", 2);

	if (parts.length !== 2) {
		return false;
	}

	const cmd = parts[0];
	const publicRaw = parts[1];

	let publicKey: bigint;

	try {
		const publicBytes = dh1080B64Decode(publicRaw);
		publicKey = bytes2Int(publicBytes);
	} catch {
		return false;
	}

	// Validate public key range
	if (!(publicKey > 1n && publicKey < DH1080_P)) {
		return false;
	}

	// Calculate shared secret: otherPublicKey^myPrivateKey mod p
	ctx.secret = modPow(publicKey, ctx.private, DH1080_P);

	// Update state
	if (ctx.state === 0 && cmd === "DH1080_INIT") {
		ctx.state = 1;
	} else if (ctx.state === 1 && cmd === "DH1080_FINISH") {
		ctx.state = 2; // Complete
	} else if (cmd === "DH1080_FINISH") {
		ctx.state = 2; // Complete
	}

	return true;
}

/**
 * Derive the final key from DH1080 shared secret
 * @param ctx - DH1080 context with completed exchange
 * @returns dh1080_b64encode (FiSH non-standard base64) of SHA256 hash of shared secret
 */
export function dh1080Secret(ctx: DH1080Ctx): string {
	if (ctx.secret === 0n) {
		throw new Error("DH1080 exchange not complete - no secret calculated");
	}

	const secretBytes = int2Bytes(ctx.secret);
	const hash = crypto.createHash("sha256").update(secretBytes).digest();

	// Use dh1080_b64encode (FiSH non-standard base64) for compatibility with WeeChat/fish.py
	return dh1080B64Encode(hash);
}

/**
 * Check if a DH1080 exchange is complete
 */
export function dh1080IsComplete(ctx: DH1080Ctx): boolean {
	return ctx.secret !== 0n && (ctx.state === 1 || ctx.state === 2);
}
