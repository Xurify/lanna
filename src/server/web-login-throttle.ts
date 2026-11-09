/**
 * Limits on password tries at the public address (E75). Pure: the caller passes
 * the state and the time, and keeps the state. A try is counted when it is made
 * and given back when the password was right, so parallel guesses cannot slip
 * past the limit while one is still being checked.
 */

export const LOGIN_LIMITS = {
	/** Tries one address may make inside the window before it is locked. */
	perAddressTries: 5,
	windowMs: 60_000,
	lockMs: 15 * 60_000,
	/** Tries all addresses together may make inside the global window. */
	globalTries: 40,
	globalWindowMs: 60 * 60_000,
	globalLockMs: 15 * 60_000,
	/** Addresses remembered at once, so a flood of addresses cannot grow the file without bound. */
	maxAddresses: 500,
} as const;

export type AddressState = { attempts: number[]; lockedUntil: number };
export type ThrottleState = {
	addresses: Record<string, AddressState>;
	globalAttempts: number[];
	globalLockedUntil: number;
};

export type Reservation =
	| { allowed: true; state: ThrottleState; triesLeft: number }
	| { allowed: false; state: ThrottleState; scope: "address" | "global"; retryAfterMs: number };

export function emptyThrottle(): ThrottleState {
	return { addresses: {}, globalAttempts: [], globalLockedUntil: 0 };
}

function within(times: number[], now: number, windowMs: number): number[] {
	return times.filter((t) => t > now - windowMs && t <= now);
}

/** Drops what has expired, so the state stays small. */
export function pruneThrottle(state: ThrottleState, now: number): ThrottleState {
	const addresses: Record<string, AddressState> = {};
	for (const [address, entry] of Object.entries(state.addresses)) {
		const attempts = within(entry.attempts, now, LOGIN_LIMITS.windowMs);
		if (attempts.length > 0 || entry.lockedUntil > now) addresses[address] = { attempts, lockedUntil: entry.lockedUntil };
	}
	return {
		addresses,
		globalAttempts: within(state.globalAttempts, now, LOGIN_LIMITS.globalWindowMs),
		globalLockedUntil: state.globalLockedUntil > now ? state.globalLockedUntil : 0,
	};
}

/** Counts one try for an address, or refuses it because the address or the whole app is locked. */
export function reserveAttempt(input: ThrottleState, address: string, now: number): Reservation {
	const state = pruneThrottle(input, now);
	if (state.globalLockedUntil > now) return { allowed: false, state, scope: "global", retryAfterMs: state.globalLockedUntil - now };
	const entry = state.addresses[address] ?? { attempts: [], lockedUntil: 0 };
	if (entry.lockedUntil > now) return { allowed: false, state, scope: "address", retryAfterMs: entry.lockedUntil - now };
	if (state.globalAttempts.length >= LOGIN_LIMITS.globalTries) {
		const next = { ...state, globalLockedUntil: now + LOGIN_LIMITS.globalLockMs };
		return { allowed: false, state: next, scope: "global", retryAfterMs: LOGIN_LIMITS.globalLockMs };
	}
	if (entry.attempts.length >= LOGIN_LIMITS.perAddressTries) {
		const locked = { attempts: entry.attempts, lockedUntil: now + LOGIN_LIMITS.lockMs };
		return { allowed: false, state: { ...state, addresses: { ...state.addresses, [address]: locked } }, scope: "address", retryAfterMs: LOGIN_LIMITS.lockMs };
	}
	if (!(address in state.addresses) && Object.keys(state.addresses).length >= LOGIN_LIMITS.maxAddresses) {
		const next = { ...state, globalLockedUntil: now + LOGIN_LIMITS.globalLockMs };
		return { allowed: false, state: next, scope: "global", retryAfterMs: LOGIN_LIMITS.globalLockMs };
	}
	const attempts = [...entry.attempts, now];
	return {
		allowed: true,
		state: { ...state, addresses: { ...state.addresses, [address]: { ...entry, attempts } }, globalAttempts: [...state.globalAttempts, now] },
		triesLeft: LOGIN_LIMITS.perAddressTries - attempts.length,
	};
}

/** Gives back the try made at `stamp`, once the password turned out right. */
export function refundAttempt(state: ThrottleState, address: string, stamp: number): ThrottleState {
	const entry = state.addresses[address];
	const without = (times: number[]) => {
		const index = times.indexOf(stamp);
		return index < 0 ? times : [...times.slice(0, index), ...times.slice(index + 1)];
	};
	return {
		...state,
		addresses: entry ? { ...state.addresses, [address]: { ...entry, attempts: without(entry.attempts) } } : state.addresses,
		globalAttempts: without(state.globalAttempts),
	};
}

/** Whether a stored value is a throttle state; anything else starts clean. */
export function readThrottle(value: unknown): ThrottleState {
	const v = value as Partial<ThrottleState> | null;
	if (!v || typeof v !== "object" || typeof v.addresses !== "object" || v.addresses === null || !Array.isArray(v.globalAttempts)) return emptyThrottle();
	const addresses: Record<string, AddressState> = {};
	for (const [address, entry] of Object.entries(v.addresses)) {
		const e = entry as Partial<AddressState> | null;
		if (e && Array.isArray(e.attempts) && typeof e.lockedUntil === "number") {
			addresses[address] = { attempts: e.attempts.filter((t) => typeof t === "number"), lockedUntil: e.lockedUntil };
		}
	}
	return {
		addresses,
		globalAttempts: v.globalAttempts.filter((t): t is number => typeof t === "number"),
		globalLockedUntil: typeof v.globalLockedUntil === "number" ? v.globalLockedUntil : 0,
	};
}
