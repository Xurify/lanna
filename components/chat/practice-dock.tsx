import { PracticeDock } from "@/components/practice-dock";

export interface ActivePracticeProblem {
	toolCallId: string;
	input: unknown;
}

interface PracticeDockBodyProps {
	problem: ActivePracticeProblem;
	expanded: boolean;
	onExpand: () => void;
	onSubmit: (text: string) => void;
	onEscape: (() => void) | undefined;
	compactionRunning: boolean;
}

export function PracticeDockBody({
	problem,
	expanded,
	onExpand,
	onSubmit,
	onEscape,
	compactionRunning,
}: PracticeDockBodyProps) {
	return (
		<PracticeDock
			problemCallId={problem.toolCallId}
			input={problem.input as { statement: string }}
			expanded={expanded}
			onExpand={onExpand}
			onSubmit={onSubmit}
			onEscape={onEscape}
			compactionRunning={compactionRunning}
		/>
	);
}
