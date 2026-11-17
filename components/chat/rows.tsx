import { ArrowRightIcon } from "lucide-react";
import {
	CompactionCutDivider,
	CompactionMomentDivider,
	type CompactionDividerData,
} from "@/components/compaction-divider";
import { ThinkingCard, type PracticeThinkingData } from "@/components/practice-cards";
import type { LannaViewMessage } from "@/src/core";
import type { SessionKind } from "@/components/session/state";

type MessagePart = LannaViewMessage["parts"][number];

export function UserRow({ message, kind }: { message: LannaViewMessage; kind: SessionKind }) {
	const text = message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
	return (
		<div
			data-testid="user-message"
			className={
				kind === "chat"
					? "mt-12 font-ui text-xl font-semibold leading-snug tracking-[-0.015em] text-foreground first:mt-0"
					: "my-3 ml-auto w-fit max-w-[85%] rounded-xl bg-well px-4 py-2.5 font-ui text-sm"
			}
		>
			<div className="sr-only">You</div>
			<div className={kind === "chat" ? "whitespace-pre-wrap" : "lanna-prose whitespace-pre-wrap text-foreground"}>
				{text}
			</div>
		</div>
	);
}

export function MarkerMessage({ message }: { message: LannaViewMessage }) {
	return <>{message.parts.map((part, index) => markerPart(part, index))}</>;
}

function markerPart(part: MessagePart, index: number) {
	switch (part.type) {
		case "data-compaction":
			return <CompactionMomentDivider key={index} data={part.data as CompactionDividerData} />;
		case "data-compaction-cut":
			return <CompactionCutDivider key={index} data={part.data as CompactionDividerData} />;
		case "data-practice-thinking":
			return <ThinkingCard key={index} data={part.data as PracticeThinkingData} />;
		case "data-practice-next":
			return <PracticeNextLine key={index} />;
		default:
			return null;
	}
}

function PracticeNextLine() {
	return (
		<div
			data-testid="practice-next-line"
			className="my-4 flex items-center justify-center gap-1.5 font-ui text-xs font-semibold text-muted-foreground"
		>
			<ArrowRightIcon className="size-3" />
			Next problem
		</div>
	);
}
