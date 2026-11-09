"use client";

import { useMemo } from "react";
import { derivedNodeStatus, derivePlanStatuses } from "@/src/core";
import { GLOW_PAD, renderPlan } from "@/components/plan-diagram";
import { PlanSvg, latestTree, type PopupMessage } from "@/components/plan-block";

/**
 * THE PLAN MARGINALIA: the plan's ambient presence in the session view. NO
 * container: the bare diagram, meet-fitted into the dock band's right flank.
 * The wrapper (chat.tsx) positions and fades it. Live by construction:
 * statuses derive from the transcript on every render, so the glow moves the
 * moment a tagged check streams in. The padding clears the current node's
 * glow at the extent edges.
 */

/** True when the transcript holds a plan tree. Gates the marginalia's
 *  clickable flank (chat.tsx): a JSX element is always truthy, so the wrapper
 *  button must unmount on its own when there is no plan. */
export function planExists(messages: readonly PopupMessage[]): boolean {
	const tree = latestTree(messages);
	return !!tree && tree.nodes.length > 0;
}

export function PlanMarginalia({ messages }: { messages: readonly PopupMessage[] }) {
	const tree = useMemo(() => latestTree(messages), [messages]);
	const statuses = useMemo(
		() => (tree ? derivePlanStatuses(tree, messages as Parameters<typeof derivePlanStatuses>[1]) : null),
		[tree, messages],
	);
	const diagram = useMemo(() => {
		if (!tree) return null;
		const statusOf = (id: string) => (statuses ? derivedNodeStatus(statuses, id) : "upcoming");
		return renderPlan(tree.nodes, tree.edges, statusOf, { monochrome: false, pad: GLOW_PAD });
	}, [tree, statuses]);
	if (!diagram) return null; // no plan yet: nothing in the margin
	return <PlanSvg diagram={diagram} sizing="fill" />;
}
