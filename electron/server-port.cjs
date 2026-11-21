const fs = require("node:fs");

const PREFERRED_PORT = 31551;
const MIN_PORT = 1024;
const MAX_PORT = 65535;
// ChatGPT sign-in listens on 1455 (docs/development.md): never take it.
const RESERVED_PORTS = [1455];

function usablePort(value) {
	return Number.isInteger(value) && value >= MIN_PORT && value <= MAX_PORT && !RESERVED_PORTS.includes(value);
}

/** The port saved in Settings → Devices (settings.json), or null when there is
 *  none yet, the file cannot be read, or the value is not a usable port. */
function readPreferredPort(file) {
	try {
		const settings = JSON.parse(fs.readFileSync(file, "utf8"));
		const port = settings?.devices?.preferredPort;
		return usablePort(port) ? port : null;
	} catch {
		return null;
	}
}

async function choosePort({
	canBind,
	remember,
	fallback,
	preferred = PREFERRED_PORT,
	remembered = null,
	attempts = 5,
	waitMs = 400,
	sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
	for (let attempt = 0; attempt < attempts; attempt++) {
		if (await canBind(preferred)) {
			remember(preferred);
			return preferred;
		}
		if (attempt < attempts - 1) await sleep(waitMs);
	}
	if (remembered && remembered !== preferred && (await canBind(remembered))) {
		remember(remembered);
		return remembered;
	}
	const port = await fallback();
	remember(port);
	return port;
}

module.exports = { PREFERRED_PORT, MIN_PORT, MAX_PORT, RESERVED_PORTS, usablePort, readPreferredPort, choosePort };
