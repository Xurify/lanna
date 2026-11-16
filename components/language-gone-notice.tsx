"use client";

import { useEffect, useState } from "react";
import { shownLanguageFetch } from "@/lib/shown-language";

let shown: string | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
	shown = document.documentElement.dataset.lhLanguage ?? null;
	if (shown)
		window.fetch = shownLanguageFetch(window.fetch.bind(window), shown, window.location.origin, () =>
			listeners.forEach((l) => l()),
		);
}

export function LanguageGoneNotice() {
	const [gone, setGone] = useState(false);
	useEffect(() => {
		const show = () => setGone(true);
		listeners.add(show);
		return () => {
			listeners.delete(show);
		};
	}, []);
	if (!gone) return null;
	return (
		<div
			role="alert"
			data-testid="language-gone"
			className="fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg bg-card px-4 py-3 shadow-raise-hi"
		>
			<p className="text-xs font-medium text-muted-foreground">Language removed</p>
			<p className="mt-0.5 text-sm text-card-foreground">
				This page&apos;s language was removed from your list, so it can&apos;t save anything.
			</p>
			<div className="mt-3 flex">
				<button
					type="button"
					className="q-btn primary pointer-coarse:min-h-11"
					onClick={() => window.location.assign("/")}
					data-testid="language-gone-reload"
				>
					Go to Today
				</button>
			</div>
		</div>
	);
}
