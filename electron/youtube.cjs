"use strict";

/*
 * Connect YouTube (Watch picks, 2026-11-05). YouTube's API gives no watch
 * history and no recommendations, so the app reads them the way the YouTube
 * site does: the learner signs in to Google in a window of the app's own,
 * with its own browser session (partition "persist:lanna-youtube", nothing
 * shared with the app window), and the main process later fetches three
 * pages through that session: the history, the home page's
 * recommendations and the subscribed channels, and YouTube's account
 * switcher, which says who is signed in. Only the page text leaves this
 * file; the renderer hands it to the server, which keeps the lists of
 * videos and channels and the account's name, handle and picture link
 * (src/server/discover.ts). Cookies stay in the session's own storage;
 * Disconnect clears it.
 *
 * The sign-in window may go to Google's and YouTube's own hosts only and
 * has no preload. Google may refuse a sign-in from a window it does not
 * recognize as a browser; the Watch page then offers a Takeout export.
 */

const PARTITION = "persist:lanna-youtube";
const SIGN_IN =
	"https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=" +
	encodeURIComponent(
		"https://www.youtube.com/signin?action_handle_signin=true&app=desktop&next=https%3A%2F%2Fwww.youtube.com%2F",
	);
const LISTS = {
	history: "https://www.youtube.com/feed/history",
	recommended: "https://www.youtube.com/",
	subscriptions: "https://www.youtube.com/feed/channels",
};
/** Who is signed in: YouTube's own account menu data (the name, the handle, the picture). */
const ACCOUNT = "https://www.youtube.com/getAccountSwitcherEndpoint";
const MAX_PAGE = 12_000_000;
const MAX_ACCOUNT = 2_000_000;

/** Google's and YouTube's hosts: the sign-in flow, consent and 2-step pages. */
function allowedUrl(target) {
	try {
		const u = new URL(target);
		if (u.protocol !== "https:") return false;
		return /(^|\.)(google\.com|google\.[a-z]{2,3}(\.[a-z]{2})?|youtube\.com|gstatic\.com|googleusercontent\.com)$/.test(
			u.hostname,
		);
	} catch {
		return false;
	}
}

function createYouTube({ session, BrowserWindow, userAgent }) {
	let win = null;
	let pending = null;
	const ses = () => {
		const s = session.fromPartition(PARTITION);
		if (userAgent && s.getUserAgent() !== userAgent) s.setUserAgent(userAgent);
		return s;
	};

	async function signedIn() {
		const cookies = await ses().cookies.get({ domain: "youtube.com" });
		return cookies.some((c) => c.name === "LOGIN_INFO" || c.name === "SAPISID" || c.name === "__Secure-3PAPISID");
	}

	/** Open the sign-in window; resolves when YouTube has a signed-in session
	 *  or the window is closed. */
	function connect(parent) {
		if (pending && win && !win.isDestroyed()) {
			win.focus();
			return pending;
		}
		pending = new Promise((resolve) => {
			win = new BrowserWindow({
				...(parent ? { parent } : {}),
				width: 520,
				height: 760,
				title: "Sign in to YouTube",
				autoHideMenuBar: true,
				webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false },
			});
			const contents = win.webContents;
			let done = false;
			const finish = (connected) => {
				if (done) return;
				done = true;
				pending = null;
				resolve({ available: true, connected });
				if (win && !win.isDestroyed()) win.close();
			};
			contents.setWindowOpenHandler(({ url }) => {
				if (allowedUrl(url)) void contents.loadURL(url);
				return { action: "deny" };
			});
			contents.on("will-navigate", (event, target) => {
				if (!allowedUrl(target)) event.preventDefault();
			});
			contents.on("did-navigate", async (_event, target) => {
				try {
					if (new URL(target).hostname === "www.youtube.com" && (await signedIn())) finish(true);
				} catch {
					// a page that is not a URL is not the end of the sign-in
				}
			});
			win.on("closed", () => {
				win = null;
				if (!done) void signedIn().then(finish, () => finish(false));
			});
			void win.loadURL(SIGN_IN);
		});
		return pending;
	}

	/** One list's page, fetched through the signed-in session. */
	async function read(list) {
		const url = LISTS[list];
		if (!url) throw new Error("Unknown YouTube list.");
		if (!(await signedIn())) return { signedIn: false };
		const res = await ses().fetch(url, { credentials: "include", headers: { "accept-language": "en-US,en;q=0.9" } });
		if (!res.ok) throw new Error(`YouTube answered ${res.status}.`);
		const html = await res.text();
		return { signedIn: true, html: html.length > MAX_PAGE ? html.slice(0, MAX_PAGE) : html };
	}

	/** The account switcher's answer, fetched through the signed-in session. */
	async function account() {
		if (!(await signedIn())) return { signedIn: false };
		const res = await ses().fetch(ACCOUNT, {
			credentials: "include",
			headers: { "accept-language": "en-US,en;q=0.9", "x-origin": "https://www.youtube.com" },
		});
		if (!res.ok) throw new Error(`YouTube answered ${res.status}.`);
		const text = await res.text();
		return { signedIn: true, text: text.length > MAX_ACCOUNT ? text.slice(0, MAX_ACCOUNT) : text };
	}

	async function disconnect() {
		if (win && !win.isDestroyed()) win.close();
		await ses().clearStorageData();
		await ses().clearCache();
		return { available: true, connected: false };
	}

	return {
		status: async () => ({ available: true, connected: await signedIn() }),
		connect,
		read,
		account,
		disconnect,
	};
}

/** The renderer's only door to it: status, connect, read a list, who is signed in, disconnect. */
function registerYouTubeIPC(ipcMain, { trusted, youtube, BrowserWindow }) {
	ipcMain.handle("lanna:youtube", async (event, command) => {
		if (!trusted(event)) throw new Error("Untrusted desktop request.");
		const op = command && command.op;
		if (op === "status") return youtube.status();
		if (op === "connect") return youtube.connect(BrowserWindow.fromWebContents(event.sender) ?? undefined);
		if (op === "read" && typeof command.list === "string" && Object.hasOwn(LISTS, command.list))
			return youtube.read(command.list);
		if (op === "account") return youtube.account();
		if (op === "disconnect") return youtube.disconnect();
		throw new Error("Unsupported YouTube request.");
	});
}

module.exports = { createYouTube, registerYouTubeIPC, allowedUrl, PARTITION };
