import type { ReactNode } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Separator } from "@/components/ui/separator";
import { SketchFigure } from "@/components/sketch-figure";
import { LiveToolCard } from "@/components/artifacts/live-tool-card";
import { artifactRenderers } from "@/components/artifacts";
import { chatMdComponents } from "@/components/chat-link";
import { TutorWriting } from "@/components/chat-voice";
import { WORKING_TOOLS } from "@/components/show-working";
import { CHAT_RECORD_TOOLS, repeatsEarlierText, type ArtifactPartProps, type LannaViewMessage } from "@/src/core";
import type { SessionKind, SessionStatus } from "@/components/session/state";

type MessagePart = LannaViewMessage["parts"][number];

const TOOL_PREFIX = "tool-";

interface AssistantPartProps {
	part: MessagePart;
	parts: readonly MessagePart[];
	index: number;
	isLastPart: boolean;
	kind: SessionKind;
	status: SessionStatus;
	busy: boolean;
	showWorking: boolean;
}

export function isRetryPart(part: MessagePart, kind: SessionKind): boolean {
	return (
		part.state === "output-error" &&
		part.type.startsWith(TOOL_PREFIX) &&
		part.errorText !== "Operation aborted" &&
		!(kind === "chat" && CHAT_RECORD_TOOLS.has(part.type.slice(TOOL_PREFIX.length)))
	);
}

export function AssistantPart(props: AssistantPartProps): ReactNode {
	const { part, kind } = props;
	if (isRetryPart(part, kind)) return <SystemLine testId="tool-retry">Retrying…</SystemLine>;
	switch (part.type) {
		case "text":
			return (
				<TextPart
					text={part.text}
					kind={kind}
					repeated={kind === "chat" && repeatsEarlierText(props.parts, props.index)}
				/>
			);
		case "reasoning":
			return (
				<ReasoningPart
					text={part.text ?? ""}
					kind={kind}
					status={props.status}
					isLastPart={props.isLastPart}
					showWorking={props.showWorking}
				/>
			);
		case "step-start":
			return props.index > 0 && kind !== "chat" ? <Separator className="my-3" /> : null;
		case "tool-draw":
			return <DrawPart state={part.state} output={part.output} busy={props.busy} />;
		default:
			return <ToolPartView part={part} kind={kind} showWorking={props.showWorking} />;
	}
}

function SystemLine({ children, testId }: { children: ReactNode; testId?: string }) {
	return (
		<div data-testid={testId} className="flex items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground">
			{children}
		</div>
	);
}

function TextPart({ text, kind, repeated }: { text: string | undefined; kind: SessionKind; repeated: boolean }) {
	if (repeated) return null;
	return (
		<div className="lanna-source-passage">
			<MessageResponse {...(kind === "chat" ? { components: chatMdComponents } : {})}>{text}</MessageResponse>
		</div>
	);
}

function ReasoningPart({
	text,
	kind,
	status,
	isLastPart,
	showWorking,
}: {
	text: string;
	kind: SessionKind;
	status: SessionStatus;
	isLastPart: boolean;
	showWorking: boolean;
}) {
	const streaming = status === "streaming" && isLastPart;
	if (kind === "chat") return streaming ? <TutorWriting /> : null;
	if (!showWorking && !streaming) return null;
	return (
		<Reasoning isStreaming={streaming} className="mb-2">
			<ReasoningTrigger />
			<ReasoningContent>{text}</ReasoningContent>
		</Reasoning>
	);
}

function DrawPart({ state, output, busy }: { state: string | undefined; output: unknown; busy: boolean }) {
	const drawn = state === "output-available" ? (output as { svg?: string } | null)?.svg : undefined;
	if (drawn) return <SketchFigure source={drawn} incomplete={false} />;
	const settled = state === "output-available" || state === "output-error";
	return !settled && busy ? <SketchFigure source="" incomplete /> : null;
}

function ToolPartView({ part, kind, showWorking }: { part: MessagePart; kind: SessionKind; showWorking: boolean }) {
	if (!part.type.startsWith(TOOL_PREFIX)) return null;
	const toolName = part.type.slice(TOOL_PREFIX.length);
	if (part.state === "input-streaming") {
		if (kind === "chat") return null;
		return <LiveToolCard part={part as ArtifactPartProps["part"]} />;
	}
	if (!showWorking && WORKING_TOOLS.has(toolName)) return null;
	const Renderer = artifactRenderers[toolName];
	if (!Renderer) return null;
	return <Renderer part={part as ArtifactPartProps["part"]} />;
}
