"use client";

import type { ReactNode } from "react";

export function ComposerActions({ setup }: { setup?: ReactNode }) {
	if (!setup) return null;
	// Zero in-flow height: the row floats just above the composer, so a
	// pill that appears after load (the key check) never moves the dock (CLS).
	return (
		<div className="relative h-0">
			<div
				data-testid="composer-actions"
				className="pointer-events-auto absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-2"
			>
				{setup}
			</div>
		</div>
	);
}
