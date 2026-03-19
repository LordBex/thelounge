/* eslint-disable @typescript-eslint/no-unused-expressions -- Chai expect statements */
import {expect} from "chai";
import {
	dh1080Create,
	dh1080Pack,
	dh1080Unpack,
	dh1080Secret,
	dh1080ValidatePublicKey,
	dh1080IsComplete,
} from "../../server/utils/dh1080.js";

describe("DH1080 Key Exchange", function () {
	describe("dh1080Create", function () {
		it("should create a DH1080 context with valid keys", function () {
			const ctx = dh1080Create();

			expect(ctx.public).to.be.a("bigint");
			expect(ctx.private).to.be.a("bigint");
			expect(ctx.secret).to.equal(0n); // Secret starts at 0
			expect(ctx.state).to.equal(0); // State starts at 0

			// Public key should be in valid range
			expect(ctx.public).to.be.greaterThan(2n);
			expect(ctx.public).to.be.lessThan(
				BigInt(
					"0xFBE1022E23D213E8ACFA9AE8B9DFADA3EA6B7AC7A7B7E95AB5EB2DF858921FEADE95E6AC7BE7DE6ADBAB8A783E7AF7A7FA6A2B7BEB1E72EAE2B72F9FA2BFB2A2EFBEFAC868BADB3E828FA8BADFADA3E4CC1BE7E8AFE85E9698A783EB68FA07A77AB6AD7BEB618ACF9CA2897EB28A6189EFA07AB99A8A7FA9AE299EFA7BA66DEAFEFBEFBF0B7D8B"
				) - 1n
			);
		});

		it("should generate different keys each time", function () {
			const ctx1 = dh1080Create();
			const ctx2 = dh1080Create();

			expect(ctx1.public).to.not.equal(ctx2.public);
			expect(ctx1.private).to.not.equal(ctx2.private);
		});

		it("should generate public keys that pass validation", function () {
			const ctx = dh1080Create();
			const isValid = dh1080ValidatePublicKey(ctx.public);

			expect(isValid).to.be.true;
		});
	});

	describe("dh1080Pack", function () {
		it("should pack DH1080_INIT message correctly", function () {
			const ctx = dh1080Create();
			const packed = dh1080Pack(ctx, false);

			expect(packed).to.satisfy((s: string) => s.startsWith("DH1080_INIT "));
			expect(packed.length).to.be.greaterThan("DH1080_INIT ".length);
		});

		it("should pack DH1080_FINISH message correctly", function () {
			const ctx = dh1080Create();
			const packed = dh1080Pack(ctx, true);

			expect(packed).to.satisfy((s: string) => s.startsWith("DH1080_FINISH "));
			expect(packed.length).to.be.greaterThan("DH1080_FINISH ".length);
		});
	});

	describe("dh1080Unpack", function () {
		it("should return false for non-DH1080 messages", function () {
			const ctx = dh1080Create();
			const result = dh1080Unpack("NOT_A_DH1080_MESSAGE", ctx);

			expect(result).to.be.false;
		});

		it("should return false for messages without proper format", function () {
			const ctx = dh1080Create();
			const result = dh1080Unpack("DH1080_INIT", ctx); // No payload

			expect(result).to.be.false;
		});

		it("should unpack DH1080_INIT and calculate secret", function () {
			// Create two contexts to simulate an exchange
			const ctx1 = dh1080Create();
			const ctx2 = dh1080Create();

			// Pack ctx1's public key as DH1080_INIT
			const initMsg = dh1080Pack(ctx1, false);

			// Unpack into ctx2
			const success = dh1080Unpack(initMsg, ctx2);

			expect(success).to.be.true;
			expect(ctx2.secret).to.not.equal(0n);
			expect(ctx2.state).to.equal(1); // State should be 1 after INIT
		});

		it("should unpack DH1080_FINISH and calculate secret", function () {
			const ctx1 = dh1080Create();
			const ctx2 = dh1080Create();

			// Set ctx2's state to 1 (as if it received INIT)
			ctx2.state = 1;

			// Pack ctx1's public key as DH1080_FINISH
			const finishMsg = dh1080Pack(ctx1, true);

			// Unpack into ctx2
			const success = dh1080Unpack(finishMsg, ctx2);

			expect(success).to.be.true;
			expect(ctx2.secret).to.not.equal(0n);
			expect(ctx2.state).to.equal(2); // State should be 2 after FINISH
		});
	});

	describe("Key exchange simulation", function () {
		it("should complete a full DH1080 exchange and derive matching keys", function () {
			// User A initiates
			const ctxA = dh1080Create();
			const initMsg = dh1080Pack(ctxA, false);

			// User B receives INIT
			const ctxB = dh1080Create();
			const successB = dh1080Unpack(initMsg, ctxB);

			expect(successB).to.be.true;

			// User B sends FINISH
			const finishMsg = dh1080Pack(ctxB, true);

			// User A receives FINISH (first set state to 1)
			ctxA.state = 1;
			const successA = dh1080Unpack(finishMsg, ctxA);

			expect(successA).to.be.true;

			// Both should have the same secret
			expect(ctxA.secret).to.equal(ctxB.secret);

			// Both should derive the same key
			const keyA = dh1080Secret(ctxA);
			const keyB = dh1080Secret(ctxB);

			expect(keyA).to.equal(keyB);
			expect(keyA).to.be.a("string");
			expect(keyA.length).to.be.greaterThan(0);

			// The key should be valid base64
			const base64Regex = /^[A-Za-z0-9+/]+=*$/;
			expect(keyA).to.match(base64Regex);
		});

		it("should derive consistent keys for the same secret", function () {
			const ctx = dh1080Create();
			ctx.secret = 123456789n;

			const key1 = dh1080Secret(ctx);
			const key2 = dh1080Secret(ctx);

			expect(key1).to.equal(key2);
		});

		it("should throw error when deriving secret without completing exchange", function () {
			const ctx = dh1080Create();
			ctx.secret = 0n;

			expect(() => dh1080Secret(ctx)).to.throw();
		});
	});

	describe("dh1080ValidatePublicKey", function () {
		it("should return true for valid DH1080 public keys", function () {
			const ctx = dh1080Create();
			const isValid = dh1080ValidatePublicKey(ctx.public);

			expect(isValid).to.be.true;
		});

		it("should return false for public key = 0", function () {
			const isValid = dh1080ValidatePublicKey(0n);

			expect(isValid).to.be.false;
		});

		it("should return false for public key = 1", function () {
			const isValid = dh1080ValidatePublicKey(1n);

			expect(isValid).to.be.false;
		});

		it("should return false for public key >= p", function () {
			const p = BigInt(
				"0xFBE1022E23D213E8ACFA9AE8B9DFADA3EA6B7AC7A7B7E95AB5EB2DF858921FEADE95E6AC7BE7DE6ADBAB8A783E7AF7A7FA6A2B7BEB1E72EAE2B72F9FA2BFB2A2EFBEFAC868BADB3E828FA8BADFADA3E4CC1BE7E8AFE85E9698A783EB68FA07A77AB6AD7BEB618ACF9CA2897EB28A6189EFA07AB99A8A7FA9AE299EFA7BA66DEAFEFBEFBF0B7D8B"
			);
			const isValid1 = dh1080ValidatePublicKey(p);
			const isValid2 = dh1080ValidatePublicKey(p + 1n);

			expect(isValid1).to.be.false;
			expect(isValid2).to.be.false;
		});
	});

	describe("dh1080IsComplete", function () {
		it("should return false for newly created context", function () {
			const ctx = dh1080Create();
			const isComplete = dh1080IsComplete(ctx);

			expect(isComplete).to.be.false;
		});

		it("should return true after receiving INIT", function () {
			const ctx1 = dh1080Create();
			const ctx2 = dh1080Create();

			const initMsg = dh1080Pack(ctx1, false);
			dh1080Unpack(initMsg, ctx2);

			const isComplete = dh1080IsComplete(ctx2);

			expect(isComplete).to.be.true;
		});

		it("should return true after receiving FINISH", function () {
			const ctx = dh1080Create();
			ctx.state = 1; // Simulate having received INIT
			ctx.secret = 12345n; // Simulate having calculated secret

			const isComplete = dh1080IsComplete(ctx);

			expect(isComplete).to.be.true;
		});
	});

	describe("Custom base64 encoding", function () {
		it("should encode and decode consistently", function () {
			const ctx1 = dh1080Create();
			const ctx2 = dh1080Create();

			// Pack and unpack
			const packed = dh1080Pack(ctx1, false);
			const success = dh1080Unpack(packed, ctx2);

			expect(success).to.be.true;
			// The secret should be calculated (even though keys are different)
			expect(ctx2.secret).to.not.equal(0n);
		});

		it("should handle public keys of varying bit lengths", function () {
			// Generate multiple contexts and ensure they all pack/unpack correctly
			for (let i = 0; i < 10; i++) {
				const ctx1 = dh1080Create();
				const ctx2 = dh1080Create();

				const packed = dh1080Pack(ctx1, false);
				const success = dh1080Unpack(packed, ctx2);

				expect(success).to.be.true;
				expect(ctx2.secret).to.not.equal(0n);
			}
		});
	});
});
