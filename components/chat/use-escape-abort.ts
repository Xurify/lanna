import { useCallback, useEffect, useState } from "react";
import type { AbortMode } from "@/components/abort-turn-dialog";
import { useLatest } from "@/components/chat/use-latest";
import type { ActivePracticeProblem } from "@/components/chat/practice-dock";

type EscapeAbortTarget = "mermaid" | "setup" | "problem" | "turn" | null;

interface EscapeState {
	abortAsk: boolean;
	mermaidFocus: boolean;
	setupOpen: boolean;
	problem: boolean;
	busy: boolean;
}

function escAbortTarget(state: EscapeState): EscapeAbortTarget {
	if (state.abortAsk) return null;
	if (state.mermaidFocus) return "mermaid";
	if (state.setupOpen) return "setup";
	if (state.problem) return "problem";
	if (state.busy) return "turn";
	return null;
}

interface EscapeAbortInput {
	diagramOpen: boolean;
	setupOpen: boolean;
	activeProblem: ActivePracticeProblem | null;
	busy: boolean;
	closeMermaid: () => void;
	abortTurn: () => void;
	dismissProblem: (problemCallId: string) => void;
}

export function useEscapeAbort(input: EscapeAbortInput) {
	const [abortAsk, setAbortAsk] = useState<AbortMode | null>(null);
	const latest = useLatest({ ...input, abortAsk });

	useEffect(() => {
		const onAbort = () => {
			const current = latest.current;
			const target = escAbortTarget({
				abortAsk: current.abortAsk !== null,
				mermaidFocus: current.diagramOpen,
				setupOpen: current.setupOpen,
				problem: current.activeProblem !== null,
				busy: current.busy,
			});
			if (target === "problem" || target === "turn") setAbortAsk(target);
			else if (target === "mermaid") current.closeMermaid();
		};
		window.addEventListener("lanna:kbd-abort-turn", onAbort);
		return () => window.removeEventListener("lanna:kbd-abort-turn", onAbort);
	}, [latest]);

	const confirmAbort = useCallback(
		(mode: AbortMode) => {
			const current = latest.current;
			setAbortAsk(null);
			if (mode === "turn") {
				current.abortTurn();
				return;
			}
			const problem = current.activeProblem;
			if (!problem) return;
			void current.dismissProblem(problem.toolCallId);
			if (current.busy) current.abortTurn();
		},
		[latest],
	);

	const closeAbortAsk = useCallback(() => setAbortAsk(null), []);

	return { abortAsk, confirmAbort, closeAbortAsk };
}
