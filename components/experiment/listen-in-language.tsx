"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { switchLanguage } from "@/components/switch-language";
import type { StudyLanguage } from "@/components/experiment/study-language";

const LISTEN_ROUTE = "/listen";

export function ListenInLanguage({ language, running, className, children, testId }: { language: StudyLanguage; running: string; className: string; children: ReactNode; testId?: string }) {
	const [error, setError] = useState<string | null>(null);
	const [switching, setSwitching] = useState(false);
	if (language.id === running) {
		return (
			<Link href={LISTEN_ROUTE} className={className} data-testid={testId}>
				{children}
			</Link>
		);
	}
	return (
		<span className="inline-flex flex-col items-end gap-1">
			<button
				type="button"
				className={className}
				data-testid={testId}
				disabled={switching}
				onClick={() => {
					setSwitching(true);
					setError(null);
					switchLanguage(language.id, language.name, LISTEN_ROUTE).catch((err: unknown) => {
						setSwitching(false);
						setError(err instanceof Error ? err.message : `Couldn't switch to ${language.name}. Try again.`);
					});
				}}
			>
				{children}
			</button>
			{error && (
				<span role="alert" className="max-w-64 text-end text-xs text-miss">
					{error}
				</span>
			)}
		</span>
	);
}
