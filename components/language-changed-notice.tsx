"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useServerEvent, useServerResync } from "@/components/server-events";
import { useActiveLanguage } from "@/components/speech";
import { flushOutbox } from "@/components/lesson/outbox";
import { landingAfterSwitch } from "@/components/switch-language";
import { shownLanguageFetch } from "@/lib/shown-language";

let shown: string | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
	shown = document.documentElement.dataset.lhLanguage ?? null;
	if (shown) window.fetch = shownLanguageFetch(window.fetch.bind(window), shown, window.location.origin, changed);
}

interface ProfileList {
	active?: string;
	profiles?: Array<{ id: string; english: string }>;
}

interface Changed {
	running: string;
	runningName: string;
	shownName: string;
}

export function LanguageChangedNotice() {
	const [state, setState] = useState<Changed | null>(null);
	const [busy, setBusy] = useState(false);
	const [line, setLine] = useState<string | null>(null);
	const pathname = usePathname();
	const lang = useActiveLanguage();

	const check = useCallback(async () => {
		if (!shown) return;
		const p = (await fetch("/api/profile", { cache: "no-store" })
			.then((r) => (r.ok ? r.json() : null))
			.catch(() => null)) as ProfileList | null;
		if (!p?.active) return;
		if (p.active === shown) return setState(null);
		const name = (id: string) => p.profiles?.find((x) => x.id === id)?.english ?? id.charAt(0).toUpperCase() + id.slice(1);
		setState({ running: p.active, runningName: name(p.active), shownName: name(shown) });
	}, []);

	useEffect(() => {
		const again = () => {
			if (document.visibilityState === "visible") void check();
		};
		listeners.add(again);
		window.addEventListener("focus", again);
		document.addEventListener("visibilitychange", again);
		return () => {
			listeners.delete(again);
			window.removeEventListener("focus", again);
			document.removeEventListener("visibilitychange", again);
		};
	}, [check]);
	useServerEvent("language-changed", () => void check());
	useServerResync(() => void check());

	if (!state || !shown) return null;
	const back = shown;

	const switchBack = async () => {
		setBusy(true);
		setLine(null);
		const res = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: back }) }).catch(() => null);
		setBusy(false);
		if (!res?.ok) {
			const body = (await res?.json().catch(() => null)) as { message?: string } | null;
			return setLine(body?.message ?? `Couldn't switch back to ${state.shownName}. Try again.`);
		}
		setState(null);
		if (lang) void flushOutbox(lang.code);
	};

	return (
		<div
			role="alert"
			data-testid="language-changed"
			className="fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg bg-card px-4 py-3 shadow-raise-hi"
		>
			<p className="text-xs font-medium text-muted-foreground">Language switched elsewhere</p>
			<p className="mt-0.5 text-sm text-card-foreground">
				Another window or device switched LangHarness to {state.runningName}. This page is still in {state.shownName}, so it can&apos;t save anything.
			</p>
			{line && <p className="mt-1 text-xs text-muted-foreground">{line}</p>}
			<div className="mt-3 flex flex-wrap gap-2">
				<button type="button" className="q-btn primary pointer-coarse:min-h-11" onClick={() => window.location.assign(landingAfterSwitch(pathname))} data-testid="language-changed-reload">
					Continue in {state.runningName}
				</button>
				<button type="button" className="q-btn sec pointer-coarse:min-h-11" disabled={busy} onClick={() => void switchBack()} data-testid="language-changed-back">
					Switch back to {state.shownName}
				</button>
			</div>
		</div>
	);
}
