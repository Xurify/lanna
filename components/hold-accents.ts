"use client";

import { useCallback, useEffect, useState } from "react";

const HOLD_ACCENTS_KEY = "lanna-hold-accents";
const HOLD_ACCENTS_EVENT = "lanna:hold-accents-change";

export function readHoldAccents(): boolean {
	if (typeof window === "undefined") return true;
	try {
		return localStorage.getItem(HOLD_ACCENTS_KEY) !== "0";
	} catch {
		return true;
	}
}

export function writeHoldAccents(next: boolean): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(HOLD_ACCENTS_KEY, next ? "1" : "0");
		window.dispatchEvent(new CustomEvent(HOLD_ACCENTS_EVENT, { detail: next }));
	} catch {
		// storage blocked
	}
}

export function useHoldAccents(): [boolean, (next: boolean) => void] {
	const [enabled, setEnabled] = useState(true);

	useEffect(() => {
		setEnabled(readHoldAccents());
		const sync = () => setEnabled(readHoldAccents());
		window.addEventListener(HOLD_ACCENTS_EVENT, sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener(HOLD_ACCENTS_EVENT, sync);
			window.removeEventListener("storage", sync);
		};
	}, []);

	const update = useCallback((next: boolean) => {
		setEnabled(next);
		writeHoldAccents(next);
	}, []);

	return [enabled, update];
}
