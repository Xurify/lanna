import assert from "node:assert/strict";
import net from "node:net";
import { describe, it } from "node:test";
import { fromThisComputer } from "../src/server/remote-access.ts";
import {
	portAnswers,
	serveFailureMessage,
	serveMappedPort,
	servePointsElsewhere,
	servesPort,
	serveUrl,
} from "../src/server/tailscale-serve.ts";

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

describe("the target Serve points at", () => {
	it("is read from the proxy line, whatever the loopback name", () => {
		assert.equal(serveMappedPort(SERVING), 33138);
		assert.equal(serveMappedPort("|-- / proxy http://localhost:31551"), 31551);
		assert.equal(serveMappedPort("|-- / proxy http://[::1]:3010"), 3010);
	});

	it("is absent when Serve has no mapping", () => {
		assert.equal(serveMappedPort("No serve config"), null);
	});
});

describe("a Serve that answers on another port", () => {
	const mapping = (port: number) => ({ installed: true, serving: false, url: null, port });

	it("is the one Lanna points here", () => {
		assert.equal(servePointsElsewhere(mapping(3010), 31551), true);
	});

	it("is left alone when it already serves this port", () => {
		assert.equal(servePointsElsewhere(mapping(31551), 31551), false);
	});

	it("is left alone when Serve has no mapping to change", () => {
		assert.equal(servePointsElsewhere({ installed: true, serving: false, url: null, port: null }, 31551), false);
	});

	it("is left alone while something still answers on that port", async () => {
		const server = net.createServer();
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const port = (server.address() as net.AddressInfo).port;
		assert.equal(await portAnswers(port), true);
		await new Promise<void>((resolve) => server.close(() => resolve()));
		assert.equal(await portAnswers(port), false);
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
