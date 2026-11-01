"use client";
/**
 * Settings primitives: sections, groups, rows and controls. Everything SSRs
 * clean (render tests pin the markup). A dependency-greyed row dims as a whole
 * and locks its control; the row owns the dim.
 */

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A section block: pronounced mono heading + content. */
export function SettingsSection({
	title,
	hint,
	children,
	testid,
}: {
	title: string;
	/** One quiet line under the header — only where it earns its place. */
	hint?: string;
	children: React.ReactNode;
	testid?: string;
}) {
	return (
		<section data-testid={testid} className="p-6">
			<div className="mb-6 flex flex-col gap-1 border-b border-border/40 pb-4">
				<h2 className="font-ui text-lg font-bold tracking-tight text-foreground">{title}</h2>
				{hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
			</div>
			<div className="flex flex-col gap-6">{children}</div>
		</section>
	);
}

/** A labeled sub-group inside a section. */
export function SettingsGroup({
	label,
	hint,
	children,
	testid,
}: {
	label: string;
	hint?: React.ReactNode;
	children: React.ReactNode;
	testid?: string;
}) {
	return (
		<div data-testid={testid} className="flex flex-col gap-2.5">
			<p className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">{label}</p>
			{hint && <span className="-mt-1 font-ui text-xs text-muted-foreground">{hint}</span>}
			<div className="flex flex-col gap-2">{children}</div>
		</div>
	);
}

/** One label + one control. Label left (with optional muted hint), control
 *  right — the settings row shape. */
export function SettingsRow({
	label,
	hint,
	children,
	testid,
	dimmed,
}: {
	label: string;
	hint?: ReactNode;
	children: React.ReactNode;
	testid?: string;
	/** Dims the whole row when the control is inert (parent off, no file yet). */
	dimmed?: boolean;
}) {
	return (
		<div
			data-testid={testid}
			className={cn(
				"flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-accent/15 px-4 py-3 transition-colors hover:border-border/80 hover:bg-accent/25",
				dimmed && "opacity-40",
			)}
		>
			<span className="min-w-0 flex-1">
				<span className="block font-ui text-xs font-semibold text-foreground">{label}</span>
				{hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{hint}</span>}
			</span>
			<div className="shrink-0">{children}</div>
		</div>
	);
}

/** A collapsed block for rarely used controls. Closed by default; the hint stays visible. Content mounts only while open, so hidden controls take no tab stop. */
export function SettingsDisclosure({
	label,
	hint,
	children,
	testid,
	defaultOpen = false,
}: {
	label: string;
	hint: string;
	children: React.ReactNode;
	testid?: string;
	/** Open on mount (the SSR pins render the content). */
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	const panelId = useId();
	return (
		<div data-testid={testid} className="rounded-2xl border border-border/60 bg-muted/10 p-4 transition-all">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				data-testid={testid ? `${testid}-toggle` : undefined}
				onClick={() => setOpen((v) => !v)}
				className="group flex w-full cursor-pointer items-center justify-between gap-3 text-left"
			>
				<div className="flex flex-col">
					<span className="font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
						{label}
					</span>
					<p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
				</div>
				<span className="rounded-lg border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-2xs transition-colors group-hover:border-border group-hover:bg-accent group-hover:text-foreground">
					{open ? "Hide" : "Show"}
				</span>
			</button>
			{open && (
				<div id={panelId} className="mt-4 flex flex-col gap-2.5 border-t border-border/50 pt-3">
					{children}
				</div>
			)}
		</div>
	);
}

/** A segmented control with radio semantics: exactly one option is active. The caller writes the choice. */
export function SettingsSegmented<T extends string | number>({
	options,
	value,
	onChange,
	ariaLabel,
	testid,
}: {
	options: readonly { value: T; label: string }[];
	value: T;
	onChange: (next: T) => void;
	ariaLabel: string;
	/** The group's test id; each option reads `${testid}-${value}`. */
	testid: string;
}) {
	return (
		<div
			role="radiogroup"
			aria-label={ariaLabel}
			data-testid={testid}
			className="flex shrink-0 items-center gap-1 rounded-xl border border-border/70 bg-background/80 p-1 shadow-2xs"
		>
			{options.map((o) => {
				const active = o.value === value;
				return (
					<button
						key={String(o.value)}
						type="button"
						role="radio"
						aria-checked={active}
						data-testid={`${testid}-${o.value}`}
						onClick={() => onChange(o.value)}
						className={cn(
							"h-7 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-all",
							active
								? "border border-border/60 bg-accent font-semibold text-foreground shadow-xs"
								: "border border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground",
						)}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}

/** The on/off switch: a button in the switch role. On uses the go colour, so it does not read as disabled. */
export function Toggle({
	checked,
	disabled,
	onChange,
	label,
	discIcon,
	title,
	testid,
}: {
	checked: boolean;
	disabled?: boolean;
	onChange: (next: boolean) => void;
	/** Accessible name for the switch role. */
	label: string;
	/** Icon rendered as the knob disc, e.g. the invert toggle's contrast circle. */
	discIcon?: ReactNode;
	/** Optional native tooltip on the switch. */
	title?: string;
	/** Overrides the test id derived from the label, so a visible name can
	 *  change without re-pinning every test that finds the switch. */
	testid?: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			{...(title ? { title } : {})}
			disabled={disabled}
			data-testid={testid ?? `toggle-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative h-5 w-9 shrink-0 rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
				checked ? "border-go bg-go" : "border-border bg-accent",
				disabled && "cursor-not-allowed opacity-50",
			)}
		>
			{discIcon ? (
				// The icon is the disc: same size, slide and colours.
				<span
					className={cn(
						"absolute left-px top-px flex size-4 items-center justify-center rounded-full transition-transform",
						checked ? "translate-x-4 text-white" : "translate-x-0 text-muted-foreground",
					)}
				>
					{discIcon}
				</span>
			) : (
				// 1px inset from the track's border, in both states.
				<span
					className={cn(
						"absolute left-px top-px size-4 rounded-full shadow-sm transition-transform",
						checked ? "translate-x-4 bg-white" : "translate-x-0 bg-muted-foreground",
					)}
				/>
			)}
		</button>
	);
}

/** A thin hex/text input committing on blur + Enter (settings pace, not
 *  typing pace — every commit is a section PUT). */
export function CommitInput({
	value,
	placeholder,
	onCommit,
	ariaLabel,
	testid,
	type = "text",
}: {
	/** "" = unset (the factory default). Mirrors the stored record, so a clamped commit snaps back to the stored value. */
	value: string;
	placeholder?: string;
	onCommit: (next: string) => void;
	ariaLabel: string;
	testid?: string;
	type?: "text" | "number";
}) {
	// The draft exists only while editing; blur shows the stored value again.
	const [draft, setDraft] = useState(value);
	const [editing, setEditing] = useState(false);
	return (
		<input
			type={type}
			value={editing ? draft : value}
			placeholder={placeholder}
			aria-label={ariaLabel}
			data-testid={testid}
			onChange={(e) => {
				setEditing(true);
				setDraft(e.target.value);
			}}
			onBlur={() => {
				if (!editing) return;
				setEditing(false);
				const next = draft.trim();
				if (next !== value) onCommit(next);
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter") e.currentTarget.blur();
				if (e.key === "Escape") {
					setEditing(false);
					e.currentTarget.blur();
				}
			}}
			className="h-8.5 w-44 rounded-xl border border-border/80 bg-background/80 px-3 font-ui text-xs text-foreground outline-hidden placeholder:text-muted-foreground/60 transition-all hover:border-border hover:bg-background focus:border-ring focus:ring-1 focus:ring-ring"
		/>
	);
}
