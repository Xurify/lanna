/**
 * A small time-limited memo for async results, shared by the server (what
 * YouTube answered, what a caption analysis measured) and the browser (what a
 * panel already fetched), so one rule keeps both.
 *
 *   - a result younger than `ttlMs` is returned without asking again;
 *   - callers that ask while the first is still running share its promise,
 *     so two clicks or two tabs make one request;
 *   - a load that fails is forgotten, never kept;
 *   - at most `max` results are kept, the oldest dropped first.
 *
 * Browser-safe: no file or network access. The result is shared: read it, do
 * not change it.
 */

interface TtlMemoOptions {
	ttlMs: number;
	max?: number;
	/** For tests. */
	now?: () => number;
}

export class TtlMemo<V> {
	private readonly done = new Map<string, { at: number; value: V }>();
	private readonly running = new Map<string, Promise<V>>();
	private readonly ttlMs: number;
	private readonly max: number;
	private readonly now: () => number;

	constructor(opts: TtlMemoOptions) {
		this.ttlMs = opts.ttlMs;
		this.max = opts.max ?? 50;
		this.now = opts.now ?? Date.now;
	}

	/** A kept result that is still fresh. */
	peek(key: string): V | undefined {
		const hit = this.done.get(key);
		if (!hit) return undefined;
		if (this.now() - hit.at >= this.ttlMs) {
			this.done.delete(key);
			return undefined;
		}
		return hit.value;
	}

	set(key: string, value: V): void {
		this.done.delete(key);
		this.done.set(key, { at: this.now(), value });
		while (this.done.size > this.max) this.done.delete(this.done.keys().next().value as string);
	}

	/** The fresh result, the load already running, or a new load. */
	run(key: string, load: () => Promise<V>): Promise<V> {
		const hit = this.peek(key);
		if (hit !== undefined) return Promise.resolve(hit);
		const shared = this.running.get(key);
		if (shared) return shared;
		const p = load().then(
			(value) => {
				if (this.running.get(key) === p) {
					this.running.delete(key);
					this.set(key, value);
				}
				return value;
			},
			(err: unknown) => {
				if (this.running.get(key) === p) this.running.delete(key);
				throw err;
			},
		);
		this.running.set(key, p);
		return p;
	}

	/** Forget one result, or every one whose key starts with `prefix`; a load still running is not shared after this. */
	forget(prefix = ""): void {
		for (const k of [...this.done.keys()]) if (k.startsWith(prefix)) this.done.delete(k);
		for (const k of [...this.running.keys()]) if (k.startsWith(prefix)) this.running.delete(k);
	}

	get size(): number {
		return this.done.size;
	}
}
