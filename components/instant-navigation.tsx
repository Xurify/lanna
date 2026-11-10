"use client";

import { usePathname, useRouter } from "next/navigation";
import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useEffect } from "react";
import { createRenderAheadLog } from "@/lib/render-ahead";

// Next.js exports this enum only from an internal path. `router.prefetch` reads it as `kind`: "full" asks the server for the whole page with its data, where the default stops at loading.tsx.
const WHOLE_PAGE = "full" as PrefetchKind;

const INTENTS = ["pointerover", "focusin", "touchstart", "pointerdown"] as const;

const log = createRenderAheadLog();

let mountedRouter: ReturnType<typeof useRouter> | null = null;

export function renderAhead(path: string): void {
	if (mountedRouter && log.shouldRender(path, location.pathname)) mountedRouter.prefetch(path, { kind: WHOLE_PAGE });
}

function linkedPath(target: EventTarget | null): string | null {
	const anchor = target instanceof Element ? target.closest("a[href]") : null;
	if (!(anchor instanceof HTMLAnchorElement)) return null;
	if (anchor.origin !== location.origin || anchor.search || (anchor.target && anchor.target !== "_self")) return null;
	return anchor.pathname;
}

export function InstantNavigation() {
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		mountedRouter = router;
		const onIntent = (e: Event) => {
			const path = linkedPath(e.target);
			if (path) renderAhead(path);
		};
		for (const intent of INTENTS) document.addEventListener(intent, onIntent, { passive: true });
		return () => {
			for (const intent of INTENTS) document.removeEventListener(intent, onIntent);
			mountedRouter = null;
		};
	}, [router]);

	useEffect(() => {
		if (log.arrive(pathname) === "refresh") router.refresh();
	}, [pathname, router]);

	return null;
}
