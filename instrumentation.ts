/** Runs once when the server starts, before the first page is asked for. */
export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;
	// The lexicon is 8 MB of JSON. Parsing it on the first Review or Lesson request made
	// that one tap wait about half a second; here it costs the server's idle start-up.
	setTimeout(() => {
		void import("@/src/server")
			.then((s) => s.warmLexicon())
			.catch(() => {});
	}, 200);
}
