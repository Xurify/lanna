"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { MAX_CUSTOM_LENGTH, type MilestonesReport } from "@/src/core";
import { DatePicker } from "./date-picker";

export function MilestoneForm({
	modelReady,
	today,
	onAdded,
}: {
	modelReady: boolean;
	today?: string;
	onAdded: (report: MilestonesReport, id?: string) => void;
}) {
	const [text, setText] = useState("");
	const [hasTarget, setHasTarget] = useState(false);
	const [date, setDate] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const add = async () => {
		if (adding || !modelReady || text.trim().length < 3 || (hasTarget && !date)) return;
		setAdding(true);
		setError(null);
		try {
			const route = hasTarget ? "/api/milestones/dated" : "/api/milestones";
			const res = await fetch(`${route}?tz=${new Date().getTimezoneOffset()}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ text: text.trim(), ...(hasTarget ? { date } : {}) }),
			});
			const body = (await res.json()) as { message?: string; id?: string; report?: MilestonesReport };
			if (!res.ok || !body.report) throw new Error(body.message ?? `HTTP ${res.status}`);
			onAdded(body.report, body.id);
			setText("");
			setDate(null);
			setHasTarget(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setAdding(false);
		}
	};

	return (
		<section
			id="milestone-add"
			className="mt-10 scroll-mt-16 q-card p-4 sm:p-5"
			aria-labelledby="milestone-add-title"
			data-testid="milestone-add"
		>
			<h2 id="milestone-add-title" className="font-ui text-lg font-semibold text-foreground">
				Add a milestone
			</h2>
			<p className="mt-1 font-prose text-sm text-muted-foreground">
				Something you want to do in the language. The app estimates when you could be ready.
			</p>
			<form
				className="mt-3 flex flex-col gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					void add();
				}}
			>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="milestone-text" className="font-ui text-sm font-semibold text-foreground">
						I want to be able to…
					</label>
					<input
						id="milestone-text"
						value={text}
						onChange={(event) => setText(event.target.value.slice(0, MAX_CUSTOM_LENGTH))}
						maxLength={MAX_CUSTOM_LENGTH}
						placeholder="Follow family phone calls, read a lease…"
						disabled={!modelReady || adding}
						className="q-field min-h-11 w-full min-w-0 rounded-lg px-4 py-2.5 text-base"
						data-testid="milestone-input"
					/>
				</div>
				<button
					type="button"
					aria-expanded={hasTarget}
					aria-controls="milestone-target"
					disabled={adding}
					onClick={() => {
						setHasTarget((value) => !value);
						setError(null);
					}}
					className="q-btn sec min-h-11 self-start"
					data-testid="milestone-target-toggle"
				>
					{hasTarget ? "Remove target date" : "Add a target date (optional)"}
				</button>
				{hasTarget && (
					<div id="milestone-target" className="flex flex-col gap-3 rounded-lg bg-well p-3 sm:p-4">
						<h3 className="font-ui text-sm font-semibold text-foreground">When do you want to be ready?</h3>
						<p className="font-prose text-sm text-muted-foreground">
							Have something coming up, like lunch with friends? Add its date to check whether your measured pace gets
							you there. Afterward, you can record how it went.
						</p>
						<fieldset disabled={adding} className="min-w-0">
							<legend className="sr-only">Target date</legend>
							{today ? <DatePicker value={date} today={today} onChange={setDate} /> : <p>Loading dates…</p>}
						</fieldset>
					</div>
				)}
				<p className="font-prose text-sm text-muted-foreground" aria-live="polite">
					{hasTarget
						? "Your target date is a goal, not a promise. The readiness estimate still follows your progress."
						: "No deadline needed. Your readiness estimate updates as you practice."}
				</p>
				{!modelReady && (
					<p className="font-prose text-sm text-muted-foreground">
						Turn on AI in Settings → AI models to add your own milestone.
					</p>
				)}
				{error && (
					<p role="alert" className="font-ui text-sm text-miss">
						{error}
					</p>
				)}
				<button
					type="submit"
					disabled={!modelReady || adding || text.trim().length < 3 || (hasTarget && !date)}
					className="q-btn primary min-h-11 w-full sm:w-auto sm:self-start"
					data-testid="milestone-submit"
				>
					<PlusIcon className="q-ico" />
					{adding ? "Estimating…" : hasTarget ? "Add milestone with target date" : "Add milestone"}
				</button>
			</form>
		</section>
	);
}
