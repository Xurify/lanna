/**
 * Test preload for `bun test` and `scripts/run-tests.mjs`:
 * Next.js 16 server internals expect `globalThis.AsyncLocalStorage` to be
 * populated (which Next's runtime bootstrap normally does via
 * `next/dist/server/node-environment-baseline`).
 */
import "next/dist/server/node-environment-baseline";
