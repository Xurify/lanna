"use client";

import { useEffect } from "react";
import { useActiveLanguage } from "@/components/speech";
import { watchOutbox } from "@/components/lesson/outbox";
import { watchSessions } from "@/components/session-save";

/** Sends the lessons still waiting in the outbox, on every page (see outbox.ts). */
export function OutboxFlush() {
	const lang = useActiveLanguage();
	useEffect(() => {
		if (!lang) return;
		const stopLessons = watchOutbox(() => lang.code);
		const stopSessions = watchSessions(() => lang.code);
		return () => {
			stopLessons();
			stopSessions();
		};
	}, [lang]);
	return null;
}
