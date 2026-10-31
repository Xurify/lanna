"use client";
/**
 * The Keys section: a minimal key-value table. Writable rows unfold an inline
 * paste editor. Env-owned rows are read only, since a paste box there would
 * mislead. The Add-provider control is the last row.
 *
 * Groups: Model API keys, Subscriptions, Speech, Dictation, Web search. Unknown
 * variables stay masked and read only at the end of Model API keys.
 *
 * API: GET /api/keys, PUT /api/keys/:id (400s show inline), DELETE. Saves take
 * effect at once; plaintext never returns from the store.
 */

import { useEffect, useRef, useState } from "react";
import { AUTH_KEYS, isPlainAuthSetting, type AuthKeyStatus } from "@/src/core";
import { SettingsGroup } from "./controls.tsx";
import { SubscriptionConnections } from "./subscription-connections.tsx";
import { ProviderMenuList } from "./model-menu.tsx";
import { MenuShell } from "@/components/menu-shell";
import { notifySettingsSaved } from "@/components/settings-signal";

/** Which settings group a service key sits in (LangHarness adds Speech). */
function TOOL_KEY_GROUP(id: string): "Speech" | "Dictation" | "Web search" {
	if (id === "ELEVENLABS_API_KEY" || id.startsWith("AZURE_SPEECH_")) return "Speech";
	if (id === "DEEPGRAM_API_KEY") return "Dictation";
	return "Web search";
}

export interface ProviderKeyInfo {
	id: string;
	envVar: string;
	label: string;
}

interface KeysResponse {
	keys: AuthKeyStatus[];
	providers?: ProviderKeyInfo[];
}

/** Curated tool key ids, derived from the catalog so this section cannot drift from core/auth-keys.ts. */
const TOOL_IDS = AUTH_KEYS.map((k) => k.id) as readonly string[];

/** Splits statuses into the table groups. */
export function classifyKeys(
	statuses: readonly AuthKeyStatus[],
	providers: readonly ProviderKeyInfo[] | undefined,
): {
	/** Stored provider keys (env or file), in GET order. */
	providerRows: AuthKeyStatus[];
	/** Curated tool rows, synthesized when absent so their docs links always show. */
	toolRows: AuthKeyStatus[];
	/** Unknown file vars — preserved, read-only. */
	unknownRows: AuthKeyStatus[];
	/** Providers without a stored key — the Add dropdown's options. */
	addable: ProviderKeyInfo[];
} {
	const byId = new Map(statuses.map((s) => [s.id, s]));
	const isTool = (id: string) => (TOOL_IDS as readonly string[]).includes(id);
	const providerEnv = new Set((providers ?? []).map((p) => p.envVar));
	const synth = (id: string): AuthKeyStatus => ({
		id,
		info: null,
		present: false,
		masked: null,
		source: "none",
		shadowedByEnv: false,
	});
	const providerRows: AuthKeyStatus[] = [];
	const unknownRows: AuthKeyStatus[] = [];
	for (const s of statuses) {
		if (isTool(s.id)) continue;
		if (providerEnv.has(s.id) || (!s.info && providers === undefined)) providerRows.push(s);
		else if (!s.info) unknownRows.push(s);
		// Keep unclassified statuses visible as provider rows.
		else providerRows.push(s);
	}
	return {
		providerRows,
		toolRows: TOOL_IDS.map((id) => byId.get(id) ?? synth(id)),
		unknownRows,
		addable: (providers ?? []).filter((p) => !byId.has(p.envVar)),
	};
}

/** Status line such as "…ab12 · 64 chars · saved 2026-10-28". " · env" marks an env-owned value. */
export function keyStatusLine(status: AuthKeyStatus): string {
	if (!status.present || !status.masked) return "not set";
	const tail = status.masked.replace(/ \((\d+) chars\)$/, "");
	const chars = status.masked.match(/\((\d+) chars\)$/)?.[1] ?? "?";
	const saved = status.savedAt ? ` · saved ${status.savedAt.slice(0, 10)}` : "";
	return `${tail} · ${chars}${saved}${status.source === "env" ? " · env" : ""}`;
}

/** One table row: label left, docs link and status right. Env-owned rows are dimmed and read only. */
function KeyTableRow({
	label,
	docsUrl,
	status,
	expanded,
	onToggle,
	onSave,
	onDelete,
	onCancel,
	testid,
}: {
	label: string;
	/** The "Get a key ↗" target — curated keys carry one. */
	docsUrl?: string;
	status: AuthKeyStatus;
	expanded: boolean;
	onToggle: () => void;
	onSave: (value: string) => Promise<string | null>;
	onDelete?: () => Promise<void>;
	/** Folds the editor. Cancel sits beside Save, so the way out stays visible. */
	onCancel: () => void;
	testid: string;
}) {
	const envOwned = status.source === "env";
	const [value, setValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	// The pasted key stays masked until revealed. Folding the editor hides it again.
	const [reveal, setReveal] = useState(false);
	useEffect(() => {
		if (!expanded) setReveal(false);
	}, [expanded]);

	async function save() {
		if (!value.trim() || busy) return;
		setBusy(true);
		setError(null);
		const err = await onSave(value);
		if (err) setError(err);
		else setValue("");
		setBusy(false);
	}

	// The expanded row becomes the editor itself: label, paste field, then Save | Cancel | Delete.
	if (expanded && !envOwned) {
		return (
			<div data-testid={testid}>
				<div className="flex items-center gap-2 rounded-sm px-1 py-1.5" data-testid={`${testid}-editor`}>
					<span className="shrink-0 font-ui text-xs text-foreground">{label}</span>
					<input
						type={reveal ? "text" : "password"}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") void save();
						}}
						placeholder="Paste key…"
						aria-label={`${label} key`}
						autoComplete="off"
						spellCheck={false}
						data-testid={`${testid}-input`}
						disabled={busy}
						autoFocus
						className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground/50"
					/>
					<button
						type="button"
						onClick={() => setReveal((r) => !r)}
						aria-pressed={reveal}
						aria-label={`${reveal ? "Hide" : "Show"} ${label} key`}
						data-testid={`${testid}-reveal`}
						disabled={busy}
						className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					>
						{reveal ? "Hide" : "Show"}
					</button>
					<button
						type="button"
						onClick={() => void save()}
						disabled={busy || !value.trim()}
						data-testid={`${testid}-save`}
						className="shrink-0 text-xs text-foreground underline-offset-2 hover:underline disabled:text-muted-foreground/40 disabled:no-underline"
					>
						Save
					</button>
					<button
						type="button"
						onClick={() => {
							setConfirmDelete(false);
							onCancel();
						}}
						disabled={busy}
						data-testid={`${testid}-cancel`}
						className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					>
						Cancel
					</button>
					{status.present && status.source === "file" && onDelete && !confirmDelete && (
						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							disabled={busy}
							data-testid={`${testid}-delete`}
							className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-miss hover:underline"
						>
							Delete
						</button>
					)}
					{confirmDelete && (
						<span className="flex shrink-0 items-center gap-2 text-xs" data-testid={`${testid}-delete-confirm`}>
							<span className="text-muted-foreground">Delete this key?</span>
							<button
								type="button"
								onClick={() => {
									setConfirmDelete(false);
									void onDelete?.();
								}}
								disabled={busy}
								data-testid={`${testid}-delete-confirm-yes`}
								className="text-miss underline-offset-2 hover:underline"
							>
								Delete
							</button>
							<button
								type="button"
								onClick={() => setConfirmDelete(false)}
								className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
							>
								Keep
							</button>
						</span>
					)}
				</div>
				{error && (
					<p role="alert" data-testid={`${testid}-error`} className="px-1 text-xs text-miss">
						{error}
					</p>
				)}
			</div>
		);
	}

	return (
		<div data-testid={testid} className={envOwned ? "opacity-40" : undefined}>
			<button
				type="button"
				aria-expanded={expanded}
				data-testid={`${testid}-row`}
				onClick={() => !envOwned && onToggle()}
				title={envOwned ? `Set by the ${status.id} environment variable, which wins over a saved key. Remove it from the environment and restart to edit it here.` : undefined}
				className={`flex w-full items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-left ${
					envOwned ? "cursor-default" : "cursor-pointer transition-colors hover:bg-accent/50"
				}`}
			>
				<span className="font-ui text-xs text-foreground">{label}</span>
				<span className="flex items-center gap-2">
					{docsUrl && (
						<a
							href={docsUrl}
							target="_blank"
							rel="noreferrer"
							onClick={(e) => e.stopPropagation()}
							className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
						>
							key ↗
						</a>
					)}
					<span data-testid={`${testid}-status`} className="font-mono text-[11px] text-muted-foreground">
						{keyStatusLine(status)}
					</span>
				</span>
			</button>
			{error && (
				<p role="alert" data-testid={`${testid}-error`} className="pl-6 text-xs text-miss">
					{error}
				</p>
			)}
		</div>
	);
}

/** A plain setting stored with the keys (the Azure region): a visible text field under its key's group. Commits on blur or Enter; Escape drops the draft; empty removes it. */
function PlainSettingRow({
	label,
	placeholder,
	status,
	onSave,
	onClear,
	testid,
}: {
	label: string;
	placeholder: string;
	status: AuthKeyStatus;
	/** The keys section's saveKey: a 400's message, or null on success. */
	onSave: (value: string) => Promise<string | null>;
	onClear: () => Promise<void>;
	testid: string;
}) {
	const envOwned = status.source === "env";
	const stored = status.value ?? "";
	const [draft, setDraft] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Escape blurs the field; the blur must not then save the draft.
	const cancelling = useRef(false);

	async function commit() {
		if (draft === null || busy) return;
		// Region names are lowercase with no spaces ("West Europe" → "westeurope").
		const next = draft.trim().toLowerCase().replace(/\s+/g, "");
		if (next === stored) {
			setDraft(null);
			return;
		}
		setBusy(true);
		setError(null);
		const err = next === "" ? (await onClear(), null) : await onSave(next);
		setBusy(false);
		if (err) setError(err);
		else setDraft(null);
	}

	return (
		<div data-testid={testid} className="flex flex-col pl-3">
			<div className={`flex items-center justify-between gap-3 px-1 py-1.5 ${envOwned ? "opacity-40" : ""}`}>
				<span className="font-ui text-xs text-foreground">{label}</span>
				<input
					value={draft ?? stored}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={() => {
						if (cancelling.current) {
							cancelling.current = false;
							return;
						}
						void commit();
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") e.currentTarget.blur();
						if (e.key === "Escape") {
							cancelling.current = true;
							setDraft(null);
							setError(null);
							e.currentTarget.blur();
						}
					}}
					disabled={envOwned}
					placeholder={placeholder}
					title={envOwned ? `Set by the ${status.id} environment variable, which wins over a saved value. Remove it from the environment and restart to edit it here.` : undefined}
					aria-label={label}
					autoComplete="off"
					spellCheck={false}
					data-testid={`${testid}-input`}
					className="h-7 w-40 rounded-sm border border-border bg-background px-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring disabled:cursor-default"
				/>
			</div>
			{error && (
				<p role="alert" data-testid={`${testid}-error`} className="px-1 text-xs text-miss">
					{error}
				</p>
			)}
		</div>
	);
}

/** The Add-provider control: the table's last row, with the shared dropdown. */
function AddProviderRow({
	addable,
	onPick,
}: {
	addable: ProviderKeyInfo[];
	onPick: (p: ProviderKeyInfo) => void;
}) {
	const [open, setOpen] = useState(false);
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (anchorRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest("[data-lh-menu]")) return;
			if (target instanceof Element && target.closest('[role="dialog"]')) setOpen(false);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<div ref={anchorRef} className="relative">
			<button
				type="button"
				aria-expanded={open}
				data-testid="add-provider"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-left font-ui text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
			>
				<span>+ Add provider key</span>
				{addable.length > 0 && <span className="font-mono text-[11px]">{addable.length}</span>}
			</button>
			{open && (
				<MenuShell
					anchorRef={anchorRef}
					testid="add-provider-menu"
					preferredSide="down"
					menuClass="flex w-72 flex-col rounded-xl border border-border bg-card p-2 text-xs shadow-xl"
				>
					{/* Picking a provider closes the dropdown; the paste row is the next step. */}
					<ProviderMenuList
						providers={addable}
						onPick={(p) => {
							setOpen(false);
							onPick(p);
						}}
					/>
				</MenuShell>
			)}
		</div>
	);
}

export function KeysSection({
	/** Row to unfold on arrival, e.g. DEEPGRAM_API_KEY from the dictation error. Followed while mounted too. */
	initialRow,
}: {
	initialRow?: string;
}) {
	const [statuses, setStatuses] = useState<AuthKeyStatus[] | null>(null);
	const [providers, setProviders] = useState<ProviderKeyInfo[] | undefined>(undefined);
	const [loading, setLoading] = useState(true);
	/** Unfolded row id; null = all folded. */
	const [openRow, setOpenRow] = useState<string | null>(initialRow ?? null);
	/** The paste editor for a freshly chosen Add-provider target. */
	const [adding, setAdding] = useState<ProviderKeyInfo | null>(null);
	const [addError, setAddError] = useState<string | null>(null);

	// Escape folds any open editor without closing the dialog. Capture phase, so it runs before the input's handler and the dialog's listener.
	useEffect(() => {
		if (openRow === null && adding === null) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopPropagation();
			setOpenRow(null);
			setAdding(null);
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, [openRow, adding]);

	const reload = () =>
		fetch("/api/keys")
			.then((r) => r.json())
			.then((body: KeysResponse) => {
				setStatuses(body.keys ?? []);
				if (body.providers) setProviders(body.providers);
			})
			.catch(() => setStatuses([]))
			.finally(() => setLoading(false));

	useEffect(() => {
		void reload();
	}, []);

	// A retarget while open unfolds the named row. A fresh mount seeds it via useState.
	useEffect(() => {
		if (initialRow !== undefined) setOpenRow(initialRow);
	}, [initialRow]);

	async function saveKey(id: string, value: string): Promise<string | null> {
		const res = await fetch(`/api/keys/${id}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ value }),
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			return body.error ?? `Save failed (${res.status})`;
		}
		await reload();
		// Cross-surface signal: other keys readers re-read here (deletes too).
		notifySettingsSaved("keys");
		return null;
	}

	async function deleteKey(id: string): Promise<void> {
		await fetch(`/api/keys/${id}`, { method: "DELETE" }).catch(() => undefined);
		await reload();
		notifySettingsSaved("keys");
	}

	if (loading || statuses === null) {
		// A skeleton the shape of the key rows: the panel does not jump when they land.
		return (
			<div className="flex flex-col gap-3 px-6 py-5" aria-busy="true" aria-label="Loading keys">
				{[0, 1, 2].map((i) => (
					<div key={i} className="h-12 animate-pulse rounded-lg bg-accent/60" />
				))}
			</div>
		);
	}

	const { providerRows, toolRows, unknownRows, addable } = classifyKeys(statuses, providers);

	async function saveNewProvider(p: ProviderKeyInfo, value: string) {
		const err = await saveKey(p.envVar, value);
		if (err) setAddError(err);
		else {
			setAdding(null);
			setAddError(null);
		}
	}

	return (
		<>
			<SettingsGroup label="Model API keys" testid="group-provider-keys">
				{providerRows.map((status) => (
					<KeyTableRow
						key={status.id}
						label={providers?.find((p) => p.envVar === status.id)?.label ?? status.info?.label ?? status.id}
						docsUrl={status.info?.docsUrl}
						status={status}
						expanded={openRow === status.id}
						onToggle={() => setOpenRow(openRow === status.id ? null : status.id)}
						onSave={async (v) => {
							const err = await saveKey(status.id, v);
							if (!err) setOpenRow(null); // fold on success — rest state
							return err;
						}}
						onCancel={() => setOpenRow(null)}
						onDelete={() => deleteKey(status.id)}
						testid={`key-${status.id.toLowerCase()}`}
					/>
				))}
				{providers !== undefined && (
					<AddProviderRow
						addable={addable}
						onPick={(p) => {
							setAdding(p);
							setAddError(null);
						}}
					/>
				)}
				{adding && (
					<div className="flex items-center gap-2 rounded-sm px-1 py-1.5" data-testid={`key-${adding.id}-editor`}>
						<span className="shrink-0 font-ui text-xs text-foreground">{adding.label}</span>
						<AddProviderEditor provider={adding} onSave={(v) => void saveNewProvider(adding, v)} onCancel={() => setAdding(null)} error={addError} />
					</div>
				)}
				{unknownRows.length > 0 && <div data-testid="group-unknown-keys">
					{unknownRows.map((status) => <div key={status.id} data-testid={`unknown-${status.id}`} className="flex items-center justify-between gap-3 px-1 py-1.5 opacity-40">
						<span className="font-mono text-xs text-foreground">{status.id}</span>
						<span className="font-mono text-[11px] text-muted-foreground">{status.masked}</span>
					</div>)}
				</div>}
			</SettingsGroup>

			<SettingsGroup label="Subscriptions" testid="group-subscriptions">
				<SubscriptionConnections />
			</SettingsGroup>

			{(["Speech", "Dictation", "Web search"] as const).map((label) => <SettingsGroup key={label} label={label} testid={label === "Dictation" ? "group-dictation" : label === "Speech" ? "group-speech" : "group-search"}>
				{toolRows.filter((status) => TOOL_KEY_GROUP(status.id) === label).map((status) =>
					isPlainAuthSetting(status.id) ? (
						// The Azure region: a setting under the Azure key, not a key.
						<PlainSettingRow
							key={status.id}
							label="Region"
							placeholder="e.g. westeurope"
							status={status}
							onSave={(v) => saveKey(status.id, v)}
							onClear={() => deleteKey(status.id)}
							testid={`key-${status.id.toLowerCase()}`}
						/>
					) : (
						<KeyTableRow
							key={status.id}
							label={status.info?.label ?? status.id}
							docsUrl={status.info?.docsUrl}
							status={status}
							expanded={openRow === status.id}
							onToggle={() => setOpenRow(openRow === status.id ? null : status.id)}
							onSave={async (v) => {
								const err = await saveKey(status.id, v);
								if (!err) setOpenRow(null);
								return err;
							}}
							onCancel={() => setOpenRow(null)}
							onDelete={() => deleteKey(status.id)}
							testid={`key-${status.id.toLowerCase()}`}
						/>
					),
				)}
			</SettingsGroup>)}

		</>
	);
}

/** Paste field for a provider chosen in the Add dropdown, until saved or cancelled. */
function AddProviderEditor({
	provider,
	onSave,
	onCancel,
	error,
}: {
	provider: ProviderKeyInfo;
	onSave: (value: string) => void;
	onCancel: () => void;
	error: string | null;
}) {
	const [value, setValue] = useState("");
	return (
		<>
			<input
				type="text"
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && value.trim()) onSave(value);
				}}
				placeholder="Paste key…"
				aria-label={`${provider.label} key`}
				data-testid={`key-${provider.id}-input`}
				autoFocus
				className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground/50"
			/>
			<button
				type="button"
				onClick={() => value.trim() && onSave(value)}
				disabled={!value.trim()}
				data-testid={`key-${provider.id}-save`}
				className="shrink-0 text-xs text-foreground underline-offset-2 hover:underline disabled:text-muted-foreground/40 disabled:no-underline"
			>
				Save
			</button>
			<button
				type="button"
				onClick={onCancel}
				data-testid={`key-${provider.id}-cancel`}
				className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
			>
				Cancel
			</button>
			{error && (
				<p role="alert" className="w-full pl-0 text-xs text-red-500" data-testid={`key-${provider.id}-error`}>
					{error}
				</p>
			)}
		</>
	);
}
