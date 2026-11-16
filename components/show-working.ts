"use client";

/**
 * "Show the tutor's working" (redesign, 2026-10-27): the chat
 * hides the agent's reasoning and its bookkeeping tool calls (file reads)
 * by default — a learner reads the lesson,
 * not the engine room. One chip in the chat header turns them back on; the
 * choice is remembered in this browser.
 */

import { useSyncExternalStore } from "react";

const KEY = "lanna-show-working";
const listeners = new Set<() => void>();

function read(): boolean {
	try {
		return localStorage.getItem(KEY) === "1";
	} catch {
		return false;
	}
}

export function setShowWorking(on: boolean): void {
	try {
		localStorage.setItem(KEY, on ? "1" : "0");
	} catch {
		// not remembered
	}
	for (const l of listeners) l();
}

export function useShowWorking(): boolean {
	return useSyncExternalStore(
		(cb) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		read,
		() => false,
	);
}

/** Tool cards that are machinery, not teaching. */
export const WORKING_TOOLS = new Set(["read", "ls", "find", "grep"]);
