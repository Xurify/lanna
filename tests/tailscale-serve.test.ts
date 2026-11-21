/**
 * TAILSCALE SERVE FROM SETTINGS (E21): reading the address and port out of
 * Serve's output, the messages for failures an owner can fix, and the rule that
 * only this computer may ask for Serve to start.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromThisComputer } from "../src/server/remote-access.ts";
import { serveFailureMessage, servesPort, serveUrl } from "../src/server/tailscale-serve.ts";

const SERVING = [
	"# Tailscale Serve is enabled for the following domain:",
	"",
	"https://lanna-pc.tail1a2b3c.ts.net/",
	"|-- / proxy http://127.0.0.1:33138",
].join("\n");

describe("the Serve address", () => {
	it("comes from `tailscale serve status`", () => {
		assert.equal(serveUrl(SERVING), "https://lanna-pc.tail1a2b3c.ts.net/");
	});

	it("is absent when Serve is not configured", () => {
		assert.equal(serveUrl("No serve config"), null);
	});
});

describe("the port Serve publishes", () => {
	it("is the one its proxy points at", () => {
		assert.equal(servesPort(SERVING, 33138), true);
	});

	it("is not a port Serve no longer points at", () => {
		assert.equal(servesPort(SERVING, 3010), false);
		assert.equal(servesPort("|-- / proxy http://localhost:30100", 3010), false);
	});
});

describe("what a failed start tells the owner", () => {
	it("names the link that enables Serve on the tailnet", () => {
		const message = serveFailureMessage(
			"Serve is not enabled on your tailnet. To enable, visit: https://login.tailscale.com/f/serve?node=n123",
		);
		assert.match(message, /not enabled/);
		assert.match(message, /https:\/\/login\.tailscale\.com\/f\/serve\?node=n123/);
	});

	it("names an old Tailscale when it rejects --bg", () => {
		assert.match(serveFailureMessage("flag provided but not defined: -bg\nUsage: tailscale serve"), /--bg/);
	});

	it("keeps the CLI's own words when it is something else", () => {
		assert.match(serveFailureMessage("Tailscale is not running."), /Tailscale is not running/);
	});
});

describe("only this computer sets up Serve", () => {
	it("accepts the loopback window", () => {
		assert.equal(fromThisComputer(new Headers(), "localhost:3010"), true);
		assert.equal(fromThisComputer(new Headers(), "127.0.0.1:3010"), true);
	});

	it("refuses a tailnet name, even with the identity headers Serve adds", () => {
		const headers = new Headers({
			"tailscale-user-login": "owner@example.com",
			"x-forwarded-host": "lanna-pc.tail1a2b3c.ts.net",
		});
		assert.equal(fromThisComputer(headers, "lanna-pc.tail1a2b3c.ts.net"), false);
	});

	it("refuses a loopback name that came through a proxy", () => {
		assert.equal(fromThisComputer(new Headers({ forwarded: "for=100.64.0.1" }), "localhost:3010"), false);
		assert.equal(fromThisComputer(new Headers(), "learn.example.com"), false);
	});
});
