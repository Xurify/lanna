// Next bundles instrumentation.ts and the route groups as separate module
// graphs, so a module-level cache exists once per bundle in the same process.
// globalThis is the one object they all share.
export function processWide<T>(name: string, create: () => T): T {
	const shared = globalThis as typeof globalThis & Record<symbol, T | undefined>;
	const key = Symbol.for(`lh.${name}`);
	return (shared[key] ??= create());
}
