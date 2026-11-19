import type { PlanTask, TaskKind } from "@/src/core";
import type { QIconName } from "./icon-paths";

const TASK_ICON: Record<TaskKind, QIconName> = {
	review: "review",
	listen: "listen",
	lesson: "grammar",
	strengthen: "letter",
	blitz: "fast",
	words: "words",
	read: "read",
	watch: "play",
	speak: "speak",
	fluency: "fast",
};

export function taskIcon(t: PlanTask): QIconName {
	return t.via === "tutor" ? "tutor" : TASK_ICON[t.id];
}

export function taskKindIcon(kind: string): QIconName | null {
	return Object.hasOwn(TASK_ICON, kind) ? TASK_ICON[kind as TaskKind] : null;
}
