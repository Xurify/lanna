/** Runs once when the server starts, before the first page is asked for. */
export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;
	// The profile and its generated course are fixed before any page loads the
	// core, so every route builds the same lessons (src/core/course.ts).
	await import("./config.ts");
	await import("./src/server/request-language.ts");
	// The lexicon is 8 MB of JSON, and its frequency order reads every example
	// sentence in it. Building both on the first Today, Review or Lesson request
	// made that tap wait about half a second; here it costs the server's idle start-up.
	setTimeout(() => {
		void import("@/src/server")
			.then((s) => {
				s.warmDictionary();
				s.warmTranscriptionCheck();
				const port = Number(process.env.PORT);
				if (Number.isInteger(port) && port > 0 && s.readAccess().enabled) void s.reconcileServe(port);
			})
			.catch(() => {});
	}, 200);
}
