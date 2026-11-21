const PREFERRED_PORT = 31551;

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

module.exports = { PREFERRED_PORT, choosePort };
