import fs from "node:fs";
import { enableRemoteAccess, readAccess } from "../src/server/remote-access-store.ts";
import { setWebPassword } from "../src/server/web-login-store.ts";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../src/server/web-password.ts";

function promptHidden(question: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const { stdin, stdout } = process;
		if (!stdin.isTTY) {
			reject(
				new Error(
					"There is no terminal to type in. Set LANNA_WEB_PASSWORD_FILE to a file that holds the password, or - for standard input.",
				),
			);
			return;
		}
		stdout.write(question);
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding("utf8");
		let value = "";
		const finish = (done: () => void) => {
			stdin.setRawMode(false);
			stdin.pause();
			stdin.off("data", onData);
			stdout.write("\n");
			done();
		};
		const onData = (chunk: string) => {
			for (const ch of chunk) {
				if (ch === "\r" || ch === "\n" || ch === "\u0004") return finish(() => resolve(value));
				if (ch === "\u0003") return finish(() => reject(new Error("Cancelled.")));
				if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
				else if (ch >= " ") value += ch;
			}
		};
		stdin.on("data", onData);
	});
}

async function readPassword(): Promise<string> {
	const file = process.env.LANNA_WEB_PASSWORD_FILE;
	if (file) return fs.readFileSync(file === "-" ? 0 : file, "utf8").replace(/\r?\n$/, "");
	console.log(
		`Choose a password of ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters. A few ordinary words in a row is a good one.`,
	);
	const first = await promptHidden("New password: ");
	const again = await promptHidden("Again: ");
	if (first !== again) throw new Error("The two passwords are not the same. Nothing was changed.");
	return first;
}

try {
	const { firstTime } = await setWebPassword(await readPassword());
	if (firstTime) {
		await enableRemoteAccess({ issueThisComputer: false });
		console.log("Password set. Web access is on: open the public address and sign in.");
	} else {
		console.log("Password changed. Every device was signed out, and the sign-in limits were cleared.");
		if (!readAccess().enabled)
			console.log("Web access is off, so nobody can sign in. Turn it on in Settings → Devices.");
	}
} catch (err) {
	console.error(err instanceof Error ? err.message : String(err));
	process.exitCode = 1;
}
