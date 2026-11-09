import { rendersAhead } from "@/lib/nav";

// Next.js reuses a whole-page prefetch for `experimental.staleTimes.static` seconds (next.config.ts, where 30 is the lowest it accepts) and does not ask the server again before that.
export const NEXT_REUSES_FOR_MS = 30_000;
export const FRESH_FOR_MS = 2_000;
// Next.js counts its 30 s from when the page arrived, this log from when it was asked for, so for a moment after 30 s the router may still hold the old page.
export const NEXT_MAY_STILL_HOLD_MS = NEXT_REUSES_FOR_MS + 5_000;

export type Arrival = "as-rendered" | "refresh";

export function createRenderAheadLog(now: () => number = Date.now) {
	const renderedAt = new Map<string, number>();
	return {
		shouldRender(path: string, current: string): boolean {
			if (path === current || !rendersAhead(path)) return false;
			const at = renderedAt.get(path);
			if (at !== undefined && now() - at < NEXT_REUSES_FOR_MS) return false;
			if (at === undefined || now() - at >= NEXT_MAY_STILL_HOLD_MS) renderedAt.set(path, now());
			return true;
		},
		arrive(path: string): Arrival {
			const at = renderedAt.get(path);
			if (at === undefined) return "as-rendered";
			const age = now() - at;
			if (age < FRESH_FOR_MS) return "as-rendered";
			if (age >= NEXT_MAY_STILL_HOLD_MS) {
				renderedAt.delete(path);
				return "as-rendered";
			}
			renderedAt.clear();
			return "refresh";
		},
	};
}
