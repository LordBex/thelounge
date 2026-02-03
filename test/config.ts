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

	describe("fileUpload.type validation", function () {
		it("should have default type 'local'", function () {
			expect(Config.values.fileUpload.type).to.equal("local");
		});

		it("should reset to 'local' for invalid type", function () {
			Config.values.fileUpload.type = "invalid_type" as any;
			
			Config.validate();

			expect(Config.values.fileUpload.type).to.equal("local");
			expect(logWarnStub.called).to.be.true;
		});

		it("should accept 'x0' as valid type", function () {
			Config.values.fileUpload.type = "x0";
			
			Config.validate();

			expect(Config.values.fileUpload.type).to.equal("x0");
		});

		it("should accept 'local' as valid type", function () {
			Config.values.fileUpload.type = "local";
			
			Config.validate();

			expect(Config.values.fileUpload.type).to.equal("local");
		});
	});
});