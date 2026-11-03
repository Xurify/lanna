/** The probe_done input schema, split from probe.ts so TypeBox stays out of the browser shell. */
import { Type, type Static } from "typebox";
import type { ProbeDoneInput } from "./probe.ts";

// The TypeBox schema of that input — SINGLE SOURCE OF TRUTH, lived by the
// tool (src/agent/tools/probe.ts) and by the UI parse seam (src/core/tool-parts.ts):
// the boundary validation and the consumer parse run literally the same
// schema, so "schema-valid at the boundary" ⇔ "parseable by a consumer" is
// structural, not a convention. (Live crash 2026-09-12: the model sent
// `assessment` as a STRING; the card cast it and died on `.strands.map`.)
export const probeDoneInputSchema = Type.Object({
	assessment: Type.Object(
		{
			strands: Type.Array(
				Type.Object({
					strand: Type.String({
						description:
							"The dependency strand (e.g. 'the derivative as a limit') — a name the plan can hang a node on.",
					}),
					assessment: Type.String({
						description:
							"Where his edge sits on this strand: the floor (what he reliably gets right), the ceiling (where it runs out), " +
							"misconceptions found, and what the lesson should build from.",
					}),
				}),
				{ minItems: 1, description: "Every strand the planned lesson will depend on, each with your read of his edge on it." },
			),
			summary: Type.Optional(
				Type.String({
					description: "Optional overall synthesis: his apparent goal and where the teaching should enter.",
				}),
			),
		},
		{ description: "The learner assessment — the probe's distilled output." },
	),
});

/** Schema ↔ interface lock (the old `satisfies z.ZodType` guarantee): the
 *  declaration and ProbeDoneInput can never drift apart — this only compiles
 *  when the schema's static shape IS the interface. */
export const probeDoneSchemaLock = (v: Static<typeof probeDoneInputSchema>): ProbeDoneInput => v;
