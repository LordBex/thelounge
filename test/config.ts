import {expect} from "chai";
import sinon from "sinon";
import Config from "../server/config.js";
import log from "../server/log.js";

describe("Config", function () {
	let logWarnStub: sinon.SinonStub;

	beforeEach(function () {
		logWarnStub = sinon.stub(log, "warn");
	});

	afterEach(function () {
		logWarnStub.restore();
	});

	describe("fileUpload validation", function () {
		it("should have allowBackendSelection enabled by default", function () {
			expect(Config.values.fileUpload.allowBackendSelection).to.equal(true);
		});
	});
});
