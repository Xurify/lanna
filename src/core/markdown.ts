/**
 * The second pure-core entry point: the parts that need KaTeX and the Markdown
 * parsers (about 250 KB). They are not in the main barrel (`./index.ts`), because
 * every client component imports that barrel and would ship them on every route.
 * Import from here only in a component that renders Markdown or math.
 */
export * from "./math-delims.ts";
export * from "./answer-presentation.ts";
