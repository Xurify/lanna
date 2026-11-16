"use client";
/**
 * Settings primitives: sections, groups, rows and controls. Everything SSRs
 * clean (render tests pin the markup). A dependency-grayed row dims as a whole
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
		<section data-testid={testid} className="p-6 max-md:px-4 max-md:py-5">
			<div className="mb-5 flex flex-col gap-1 border-b border-border pb-4">
				<h2 className="font-ui text-xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
				{hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
			</div>
			<div className="flex flex-col gap-2">{children}</div>
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
			<p className="font-ui text-[13px] font-semibold tracking-[-0.003em] text-ink-2">{label}</p>
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
	stack,
}: {
	label: string;
	hint?: ReactNode;
	children: React.ReactNode;
	testid?: string;
	/** Dims the whole row when the control is inert (parent off, no file yet). */
	dimmed?: boolean;
	/** Put the control under the text, full width. Default: when the hint is longer than one short line. */
	stack?: boolean;
}) {
	const stacked = stack ?? (typeof hint === "string" ? hint.length > 64 : false);
	return (
		<div
			data-testid={testid}
			className={cn(
				"flex rounded-lg bg-well px-4 py-3",
				stacked ? "flex-col gap-3" : "items-center justify-between gap-4 max-md:flex-wrap max-md:gap-y-3",
				dimmed && "opacity-40",
			)}
		>
			<span className={cn("min-w-0 flex-1", !stacked && "max-md:basis-48")}>
				<span className="block font-ui text-sm font-medium text-foreground">{label}</span>
				{hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{hint}</span>}
			</span>
			<div className={stacked ? "w-full" : "shrink-0"}>{children}</div>
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
		<div data-testid={testid} className="rounded-lg bg-card p-4 shadow-raise">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				data-testid={testid ? `${testid}-toggle` : undefined}
				onClick={() => setOpen((v) => !v)}
				className="group flex w-full cursor-pointer items-center justify-between gap-3 text-left"
			>
				<div className="flex flex-col">
					<span className="font-ui text-[13px] font-semibold text-ink-2 transition-colors group-hover:text-foreground">
						{label}
					</span>
					<p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
				</div>
				<span className="rounded-md bg-card px-2.5 py-1 text-xs font-medium text-ink-2 ring-1 ring-line-2 transition-colors group-hover:bg-well">
					{open ? "Hide" : "Show"}
				</span>
			</button>
			{open && (
				<div id={panelId} className="mt-4 flex flex-col gap-2.5 border-t border-border pt-3">
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
		<div role="radiogroup" aria-label={ariaLabel} data-testid={testid} className="q-segc shrink-0">
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
						className={cn("whitespace-nowrap", active && "on")}
					>
						{o.label}
					</button>
				);
			})}
		</div>
	);
}

/** The on/off switch: a button in the switch role. On uses the go color, so it does not read as disabled. */
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
				checked ? "border-transparent bg-teal" : "border-transparent bg-line-2",
				disabled && "cursor-not-allowed opacity-50",
			)}
		>
			{discIcon ? (
				// The icon is the disc: same size, slide and colors.
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
						"bg-white",
						checked ? "translate-x-4" : "translate-x-0",
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
			className="h-9 w-44 rounded-md bg-card px-3 font-ui text-sm text-foreground outline-hidden ring-1 ring-line-2 placeholder:text-ink-4 transition-shadow focus:ring-2 focus:ring-teal"
		/>
	);
}
