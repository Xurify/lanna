"use client";

/**
 * Measured practice time for one task (src/core/active-time.ts): the clock
 * runs while the learner is active, and whatever is unsent when they leave
 * (the page closes, the route changes, a lesson is dropped) goes to
 * /api/progress/time. A finished session sends its own time with `finish()`,
 * so a flush and a finish never count the same seconds.
 *
 *   interactive  the time between actions, each gap capped
 *   passive      the time the tab is visible and focused (Watch, Read, Listen)
 */

import { useEffect, useRef } from "react";
import { createActiveClock, MIN_SEND_MS, type ActiveClock, type TimedActivity } from "@/src/core";

interface ActiveTime {
	/** The session is done: hand out the unsent active ms and stop counting
	 *  (the end card is not practice) until `restart()`. */
	finish(): number;
	/** A new session or card begins: start from zero and count again. */
	restart(): void;
}

interface ActiveTimeOptions {
	/** `false` for a page that is only sometimes practice (the setup wizard
	 *  around the level check): nothing counts until `restart()`. */
	start?: boolean;
	/** Passive mode: whether the screen is one of the task's practice stages.
	 *  The clock runs only while true, so waiting for an episode to be written
	 *  or reading the end card does not count. Default true. */
	active?: boolean;
}

const ACTIONS = ["pointerdown", "pointerup", "keydown", "keyup", "wheel", "touchstart"] as const;

const visibleAndFocused = () => document.visibilityState === "visible" && document.hasFocus();

export function useActiveTime(
	activity: TimedActivity,
	mode: "interactive" | "passive",
	opts: ActiveTimeOptions = {},
): ActiveTime {
	const onStage = useRef(opts.active !== false);
	onStage.current = opts.active !== false;
	const clock = useRef<ActiveClock | null>(null);
	clock.current ??= createActiveClock(mode, { engaged: onStage.current });
	const stopped = useRef(opts.start === false);
	const kind = useRef(activity);
	kind.current = activity;
	const engaged = () => visibleAndFocused() && onStage.current;

	const api = useRef<ActiveTime>({
		finish() {
			const c = clock.current!;
			const ms = c.take();
			c.engage(false);
			stopped.current = true;
			return ms;
		},
		restart() {
			const c = clock.current!;
			c.reset();
			stopped.current = false;
			c.engage(engaged());
		},
	});

	// A change of stage (passive) is a change of engagement, not a flush.
	const stage = opts.active !== false;
	useEffect(() => {
		if (mode === "passive" && !stopped.current) clock.current!.engage(visibleAndFocused() && stage);
	}, [mode, stage]);

	useEffect(() => {
		const c = clock.current!;
		const flush = () => {
			if (stopped.current) return;
			const ms = c.take();
			if (ms < MIN_SEND_MS) return;
			// keepalive lets the request outlive the page; same path as every other API call.
			void fetch("/api/progress/time", {
				method: "POST",
				keepalive: true,
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ activity: kind.current, ms, tz: new Date().getTimezoneOffset() }),
			}).catch(() => {});
		};
		const act = () => {
			if (!stopped.current) c.act();
		};
		const sync = () => {
			if (!stopped.current) c.engage(visibleAndFocused() && onStage.current);
		};
		if (mode === "interactive")
			for (const e of ACTIONS) window.addEventListener(e, act, { capture: true, passive: true });
		else {
			sync();
			document.addEventListener("visibilitychange", sync);
			window.addEventListener("focus", sync);
			window.addEventListener("blur", sync);
		}
		window.addEventListener("pagehide", flush);
		return () => {
			if (mode === "interactive") for (const e of ACTIONS) window.removeEventListener(e, act, { capture: true });
			else {
				document.removeEventListener("visibilitychange", sync);
				window.removeEventListener("focus", sync);
				window.removeEventListener("blur", sync);
			}
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [mode]);

	return api.current;
}
