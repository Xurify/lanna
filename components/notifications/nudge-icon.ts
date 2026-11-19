import type { ScheduledNudge } from "@/src/core";
import type { QIconName } from "@/components/quiet/icon-paths";
import { taskKindIcon } from "@/components/quiet/task-icons";

const SOURCE_ICON: Partial<Record<ScheduledNudge["source"], QIconName>> = {
	smart_trend: "chart",
	deadline_warning: "flag",
	evening_deadline: "flag",
	streak_saver: "flag",
};

export function nudgeIcon(nudge: ScheduledNudge): QIconName {
	return (nudge.taskKind ? taskKindIcon(nudge.taskKind) : null) ?? SOURCE_ICON[nudge.source] ?? "flag";
}
