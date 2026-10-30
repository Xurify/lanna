"use client";

import { useEffect } from "react";
import { useActiveLanguage } from "@/components/speech";
import { watchOutbox } from "@/components/lesson/outbox";

/** Sends the lessons still waiting in the outbox, on every page (see outbox.ts). */
export function OutboxFlush() {
	const lang = useActiveLanguage();
	useEffect(() => {
		if (!lang) return;
		return watchOutbox(() => lang.code);
	}, [lang]);
	return null;
}
