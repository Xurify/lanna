import type { CSSProperties } from "react";

/** The style for an `.lanna-fill` bar (app/globals.css): `share` is 0 to 1. */
export function fillStyle(share: number): CSSProperties {
	return { "--fill": Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0 } as CSSProperties;
}
