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

export interface ChatAnswerSeam {
	record(answer: Omit<ChatAnswer, "at" | "chatId">): void;
}

export interface ChatToolContext {
	review?: ReviewSeam;
	answers?: ChatAnswerSeam;
	jobs?: JobToolContext;
}

const poseInput = Type.Object({
	answer: Type.String({ minLength: 1, description: "The exact answer you expect, in the target language, committed before the learner answers. Check any form you are not sure of before you write the question." }),
	accept: Type.Optional(Type.Array(Type.String(), { description: "Other answers that are also fully correct." })),
	focus: Type.String({ minLength: 1, description: "What the question tests, in a few plain words (\"feminine this\", \"locative after v\")." }),
});

const gradeInput = Type.Object({
	verdict: Type.Union([Type.Literal("right"), Type.Literal("slip"), Type.Literal("wrong"), Type.Literal("dont_know")], {
		description: "right: the committed answer or an accepted one. slip: the right form with a spelling or accent slip. wrong: another form or word. dont_know: the learner gave up or asked for the answer.",
	}),
	given: Type.String({ description: "What the learner wrote, verbatim." }),
	expected: Type.String({ minLength: 1, description: "The committed answer from the pose." }),
	focus: Type.String({ minLength: 1, description: "The pose's focus." }),
	hinted: Type.Optional(Type.Boolean({ description: "True when a hint was given before this answer." })),
});

const poseTool: AgentTool<typeof poseInput> = {
	name: "pose",
	label: "pose",
	description:
		"Commit the answer to the question your reply ends on. Call it after the text, as the last call of the turn (after `grade` when there is one); the turn ends with it. The learner never sees this call.",
	parameters: poseInput,
	executionMode: "sequential",
	execute: serverExecute("pose", poseInput, async () => "Committed."),
};

function gradeTool(seam: ChatAnswerSeam | undefined): AgentTool<typeof gradeInput> {
	return {
		name: "grade",
		label: "grade",
		description:
			"Record how the learner answered the question you posed. Call it after the text of your verdict, before `pose`; one call per answer, a second try included. The learner never sees this call.",
		parameters: gradeInput,
		executionMode: "sequential",
		execute: serverExecute("grade", gradeInput, async (input) => {
			seam?.record({ verdict: input.verdict, given: input.given, expected: input.expected, focus: input.focus, hinted: input.hinted === true });
			return "Recorded.";
		}),
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
	});
}
