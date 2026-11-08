/**
 * The second pure-core entry point: what only the tutor chat and its cards need,
 * and what is heavy. The Markdown parsers (about 250 KB) and TypeBox's
 * validator (about 100 KB gzipped) are not in the main barrel (`./index.ts`),
 * because every client component imports that barrel and would ship them on
 * every route. Import from here only in a component that renders tutor output.
 * The tool-input schemas are in `question-schemas.ts`, for the agent and tests.
 */
export * from "./answer-presentation.ts";
export * from "./tool-parts.ts";
