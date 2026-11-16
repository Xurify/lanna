import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { serverExecute } from "../tool-execute.ts";
import { readTool } from "./read.ts";
import { lsTool } from "./ls.ts";
import { findTool } from "./find.ts";
import { grepTool } from "./grep.ts";
import { jobTools, type JobToolContext } from "./jobs.ts";
import { healToolRecord } from "./heal.ts";
import { languageTools, type ReviewSeam } from "./language.ts";
import type { ChatAnswer } from "../../core/chat-answers.ts";
import { allUnits, isUnitId } from "../../core/lesson.ts";

export interface ChatAnswerSeam {
	record(answer: Omit<ChatAnswer, "at" | "chatId">): void;
}

export interface ChatDrawingSeam {
	draw(brief: string, signal?: AbortSignal): Promise<string | null>;
}

export interface ChatToolContext {
	review?: ReviewSeam;
	answers?: ChatAnswerSeam;
	jobs?: JobToolContext;
	drawing?: ChatDrawingSeam;
}

const poseInput = Type.Object({
	answer: Type.String({
		minLength: 1,
		description:
			"The exact answer you expect, in the target language, committed before the learner answers. Check any form you are not sure of before you write the question.",
	}),
	accept: Type.Optional(
		Type.String({
			description: 'Other answers that are also fully correct, in quotes like every value, separated by " | ".',
		}),
	),
	focus: Type.String({
		minLength: 1,
		description:
			'What the question tests, in a few plain words with grammar in full words, never abbreviated ("the feminine accusative of this", "the locative after v").',
	}),
});

function gradeInputFor(units: readonly { id: string; title: string }[]) {
	return Type.Object({
		verdict: Type.Union(
			[Type.Literal("right"), Type.Literal("slip"), Type.Literal("wrong"), Type.Literal("dont_know")],
			{
				description:
					"right: the committed answer or an accepted one. slip: the right form with a spelling or accent slip. wrong: another form or word. dont_know: the learner gave up or asked for the answer.",
			},
		),
		given: Type.String({ description: "What the learner wrote, verbatim." }),
		expected: Type.String({ minLength: 1, description: "The committed answer from the pose." }),
		focus: Type.String({ minLength: 1, description: "The pose's focus." }),
		hinted: Type.Optional(Type.Boolean({ description: "True when a hint was given before this answer." })),
		unit: Type.Optional(
			Type.String({
				description: `The id of the course unit the question tested, when it tested one of these (id: title): ${units.map((u) => `${u.id}: ${u.title}`).join("; ")}. Leave it out for vocabulary, meaning, or anything else.`,
			}),
		),
	});
}

const poseTool: AgentTool<typeof poseInput> = {
	name: "pose",
	label: "pose",
	description:
		"Commit the answer to the question your reply ends on. Call it after the text, as the last call of the turn (after `grade` when there is one); the turn ends with it. The learner never sees this call.",
	parameters: poseInput,
	executionMode: "sequential",
	execute: serverExecute("pose", poseInput, async () => "Committed."),
};

function gradeTool(seam: ChatAnswerSeam | undefined): AgentTool<ReturnType<typeof gradeInputFor>> {
	const gradeInput = gradeInputFor(allUnits());
	return {
		name: "grade",
		label: "grade",
		description:
			"Record how the learner answered the question you posed. Call it after the text of your verdict, before `pose`; one call per answer, a second try included. The learner never sees this call.",
		parameters: gradeInput,
		executionMode: "sequential",
		execute: serverExecute("grade", gradeInput, async (input) => {
			seam?.record({
				verdict: input.verdict,
				given: input.given,
				expected: input.expected,
				focus: input.focus,
				hinted: input.hinted === true,
				...(isUnitId(input.unit) ? { unit: input.unit } : {}),
			});
			return "Recorded.";
		}),
	};
}

const drawInput = Type.Object({
	brief: Type.String({
		minLength: 1,
		description:
			"What the picture shows in a few words, its layout, and the forms it labels with their meanings, all from your reply. Never the answer to your question.",
	}),
});

export type ChatDrawing = { svg: string } | { failed: true };

function drawTool(seam: ChatDrawingSeam): AgentTool<typeof drawInput, ChatDrawing> {
	return {
		name: "draw",
		label: "draw",
		description:
			"Ask for one drawing under the reply you just wrote. Call it after the text, with the other record calls; a drawer makes it while the learner reads.",
		parameters: drawInput,
		executionMode: "parallel",
		execute: async (_toolCallId, input, signal) => {
			if (signal?.aborted) {
				const err = new Error("aborted");
				err.name = "AbortError";
				throw err;
			}
			let svg: string | null = null;
			try {
				svg = await seam.draw(input.brief, signal);
			} catch (err: any) {
				if (signal?.aborted || err?.name === "AbortError" || err?.message === "aborted") throw err;
				svg = null;
			}
			return svg
				? { content: [{ type: "text", text: `Drawn under the reply: ${input.brief}` }], details: { svg } }
				: {
						content: [{ type: "text", text: "The drawing could not be made; the reply stands without it." }],
						details: { failed: true },
					};
		},
	};
}

export function chatTools(ctx: ChatToolContext): Record<string, AgentTool<any>> {
	const jobs = ctx.jobs ? jobTools(ctx.jobs) : null;
	return healToolRecord({
		pose: poseTool,
		grade: gradeTool(ctx.answers),
		read: readTool,
		ls: lsTool,
		find: findTool,
		grep: grepTool,
		...(jobs?.research ? { research: jobs.research } : {}),
		...(jobs?.pdf ? { pdf: jobs.pdf } : {}),
		...languageTools(ctx.review),
		...(ctx.drawing ? { draw: drawTool(ctx.drawing) } : {}),
	});
}
