import { isLanguageGone, isSameOrigin, SHOWN_LANGUAGE_HEADER, type LanguageGone } from "@/src/core";

export function shownLanguageFetch(
	base: typeof fetch,
	shown: string,
	origin: string,
	onGone: (refusal: LanguageGone) => void,
): typeof fetch {
	return async (input, init) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		if (!isSameOrigin(url, origin)) return base(input, init);
		// fetch(request, init) takes init.headers in place of the request's own, so the two are merged here.
		const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
		if (!headers.has(SHOWN_LANGUAGE_HEADER)) headers.set(SHOWN_LANGUAGE_HEADER, shown);
		const res = await base(input, { ...init, headers });
		if (res.status === 409) {
			void res
				.clone()
				.json()
				.then((body: unknown) => {
					if (isLanguageGone(body)) onGone(body);
				})
				.catch(() => {});
		}
		return res;
	};
}
