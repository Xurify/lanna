import { PAIRING_CODE_MINUTES, formatCode } from "../src/server/remote-access.ts";
import { createPairingCode, enableRemoteAccess, readAccess } from "../src/server/remote-access-store.ts";

if (!readAccess().enabled) {
	if (!process.argv.includes("--enable")) {
		console.error(
			"Remote access is off, so there is nothing to pair. Run npm run remote:code -- --enable to turn it on and make a code.",
		);
		process.exit(1);
	}
	await enableRemoteAccess({ issueThisComputer: false });
	console.log("Remote access is on.");
}
const made = await createPairingCode();
if (made === "off") {
	console.error("Remote access is off.");
	process.exit(1);
}
console.log(`Pairing code: ${formatCode(made.code)}`);
console.log(`Type it on the device within ${PAIRING_CODE_MINUTES} minutes. It works once.`);
