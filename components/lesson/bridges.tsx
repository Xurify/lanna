"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { unitBridges, type BridgeLang, type UnitId } from "@/src/core";

/** The languages the hints bridge to, from the plan (the learner's
 *  profile). A plan built before profiles carried languages reads as
 *  Estonian, the app's first learner. */
export const BridgesContext = createContext<readonly BridgeLang[]>(["et"]);

/** The bridge lines for a unit in the languages the learner knows, one
 *  line each, after the rule (the Estonian, Finnish, Russian or German way
 *  of the same point; src/core/unit-bridges.ts). `compact` (the retry
 *  hint) shows the strongest language and folds the rest behind one line,
 *  so the second try is not under a wall of text. */
export function Bridges({ unit, compact = false }: { unit: UnitId; compact?: boolean }) {
	const langs = useContext(BridgesContext);
	const [all, setAll] = useState(false);
	const lines = unitBridges(unit, langs);
	if (lines.length === 0) return null;
	const shown = compact && !all ? lines.slice(0, 1) : lines;
	const rest = lines.slice(1);
	return (
		<>
			{shown.map((b) => (
				<p key={b.lang} className="text-muted-foreground" data-testid={`bridge-${b.lang}`}>
					<span className="font-semibold text-foreground">{b.name}:</span> {b.text}
				</p>
			))}
			{compact && !all && rest.length > 0 && (
				<button
					type="button"
					onClick={() => setAll(true)}
					className="self-start font-prose text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
					data-testid="bridges-more"
				>
					Show the {rest.map((b) => b.name).join(" and ")} parallels
				</button>
			)}
		</>
	);
}
