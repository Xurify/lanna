import type { ComponentType } from "react";
import type { ArtifactPartProps } from "@/src/core";
import { JobCard, PdfJobCard } from "@/components/artifacts/job-card";
import { ToolCallCard } from "@/components/artifacts/tool-call-card";
import { ProblemCard, ConcludeCard } from "@/components/practice-cards";

/**
 * Artifact renderer registry — the extension point for tool-part UI.
 *
 * chat.tsx renders any tool part it doesn't specially handle (i.e. not
 * quiz/ask) by looking the tool name up here. Add your renderer — do NOT
 * edit chat.tsx.
 *
 * Typical shape: while the part is input-available render a working line;
 * when output-available render the artifact itself from part.output.
 */
export const artifactRenderers: Record<string, ComponentType<ArtifactPartProps>> = {
	research: JobCard,
	pdf: PdfJobCard, // sources v0 — live smoke 2026-09-19 caught the gap: without this the tool-pdf dispatch part rendered nothing
	// Reading a sent file: a quiet one-liner, input and output on expand.
	read: ToolCallCard,
	// The practice pair (2026-10-04): the pose renders the statement ONLY
	// (the commitment lives in the call's arguments and never renders);
	// the conclusion carries the outcome + verdict + the reveal.
	problem: ProblemCard,
	conclude: ConcludeCard,
};
