"use client";
/**
 * The Keys section: a minimal key-value table. Writable rows unfold an inline
 * paste editor. Env-owned rows are read only, since a paste box there would
 * mislead. The Add-provider control is the last row.
 *
 * Groups: Model API keys, Subscriptions, Speech, Dictation, Web search. Unknown
 * variables stay masked and read only at the end of Model API keys; one held
 * in the file can be deleted (a stray test fixture reached a real profile).
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
import { ProviderIcon } from "./provider-icons.tsx";

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
function keyStatusLine(status: AuthKeyStatus): string {
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
	providerId,
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
	providerId?: string;
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
				<div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-accent/25 p-2.5" data-testid={`${testid}-editor`}>
					<span className="flex shrink-0 items-center gap-2 font-ui text-xs font-semibold text-foreground">
						<ProviderIcon provider={providerId ?? (status.id.replace(/_API_KEY|_KEY/g, "").toLowerCase() || label)} />
						{label}
					</span>
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
						className="h-8.5 min-w-0 flex-1 rounded-lg border border-border/80 bg-background/80 px-2.5 font-mono text-xs text-foreground outline-hidden placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
					/>
					<button
						type="button"
						onClick={() => setReveal((r) => !r)}
						aria-pressed={reveal}
						aria-label={`${reveal ? "Hide" : "Show"} ${label} key`}
						data-testid={`${testid}-reveal`}
						disabled={busy}
						className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						{reveal ? "Hide" : "Show"}
					</button>
					<button
						type="button"
						onClick={() => void save()}
						disabled={busy || !value.trim()}
						data-testid={`${testid}-save`}
						className="shrink-0 cursor-pointer rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-2xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
						className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						Cancel
					</button>
					{status.present && status.source === "file" && onDelete && !confirmDelete && (
						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							disabled={busy}
							data-testid={`${testid}-delete`}
							className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-miss"
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
								className="cursor-pointer font-medium text-miss underline-offset-2 hover:underline"
							>
								Delete
							</button>
							<button
								type="button"
								onClick={() => setConfirmDelete(false)}
								className="cursor-pointer text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
							>
								Keep
							</button>
						</span>
					)}
				</div>
				{error && (
					<p role="alert" data-testid={`${testid}-error`} className="px-1 pt-1 text-xs text-miss">
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
				className={`flex w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-accent/15 px-3.5 py-2.5 text-left transition-colors ${
					envOwned ? "cursor-default" : "cursor-pointer hover:border-border/80 hover:bg-accent/30"
				}`}
			>
				<span className="flex items-center gap-2.5 font-ui text-xs font-semibold text-foreground">
					<ProviderIcon provider={providerId ?? (status.id.replace(/_API_KEY|_KEY/g, "").toLowerCase() || label)} />
					{label}
				</span>
				<span className="flex items-center gap-2">
					{docsUrl && (
						<a
							href={docsUrl}
							target="_blank"
							rel="noreferrer"
							onClick={(e) => e.stopPropagation()}
							className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
						>
							Get a key ↗
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
		<div data-testid={testid} className={envOwned ? "opacity-40" : undefined}>
			<div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-accent/15 px-3.5 py-2.5 transition-colors hover:border-border/80 hover:bg-accent/30">
				<span className="flex items-center gap-2.5 font-ui text-xs font-semibold text-foreground">
					<ProviderIcon provider="azure" />
					<span>{label}</span>
					<span className="text-[11px] font-normal text-muted-foreground">Azure resource region</span>
				</span>
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
					className="h-8.5 w-48 rounded-lg border border-border/80 bg-background/80 px-3 font-mono text-xs text-foreground outline-hidden placeholder:text-ink-4 transition-[color,background-color,border-color,box-shadow] hover:border-border hover:bg-background focus:border-ring focus:ring-1 focus:ring-ring disabled:cursor-default"
				/>
			</div>
			{error && (
				<p role="alert" data-testid={`${testid}-error`} className="px-1 pt-1 text-xs text-miss">
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
				className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-accent/10 px-3.5 py-2.5 text-left font-ui text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/25 hover:text-foreground"
			>
				<span className="flex items-center gap-2.5">
					<span className="flex size-5 items-center justify-center rounded-md bg-accent font-semibold text-foreground">
						+
					</span>
					<span>Add provider key</span>
				</span>
				{addable.length > 0 && (
					<span className="rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
						{addable.length}
					</span>
				)}
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
			return body.error ?? `Couldn't save the key (error ${res.status}). Try again.`;
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
			<SettingsGroup
				label="Model API keys"
				hint="Powers tutor chats, grammar coaching, and practice drills. Pick the models in AI models."
				testid="group-provider-keys"
			>
				{providerRows.map((status) => {
					const provider = providers?.find((p) => p.envVar === status.id);
					return (
						<KeyTableRow
							key={status.id}
							label={provider?.label ?? status.info?.label ?? status.id}
							providerId={provider?.id}
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
					);
				})}
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
					<div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-accent/25 p-2.5" data-testid={`key-${adding.id}-editor`}>
						<span className="flex shrink-0 items-center gap-2 font-ui text-xs font-semibold text-foreground">
							<ProviderIcon provider={adding.id} />
							{adding.label}
						</span>
						<AddProviderEditor provider={adding} onSave={(v) => void saveNewProvider(adding, v)} onCancel={() => setAdding(null)} error={addError} />
					</div>
				)}
				{unknownRows.length > 0 && <div data-testid="group-unknown-keys" className="flex flex-col gap-2">
					{unknownRows.map((status) => <UnknownKeyRow key={status.id} status={status} onDelete={() => deleteKey(status.id)} />)}
				</div>}
			</SettingsGroup>

			<SettingsGroup label="Subscriptions" testid="group-subscriptions">
				<SubscriptionConnections />
			</SettingsGroup>

			{([
				{ id: "Speech", label: "Speech (TTS)", testid: "group-speech" },
				{ id: "Dictation", label: "Dictation (STT)", testid: "group-dictation" },
				{ id: "Web search", label: "Web search", testid: "group-search" },
			] as const).map(({ id, label, testid }) => <SettingsGroup key={id} label={label} testid={testid}>
				{toolRows.filter((status) => TOOL_KEY_GROUP(status.id) === id).map((status) =>
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
		<div className="flex min-w-0 flex-1 flex-col gap-1.5">
			<div className="flex items-center gap-2">
				<input
					type="password"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && value.trim()) onSave(value);
					}}
					placeholder="Paste API key…"
					aria-label={`${provider.label} key`}
					data-testid={`key-${provider.id}-input`}
					autoFocus
					className="h-8.5 min-w-0 flex-1 rounded-lg border border-border/80 bg-background/80 px-3 font-mono text-xs text-foreground outline-hidden placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
				/>
				<button
					type="button"
					onClick={() => value.trim() && onSave(value)}
					disabled={!value.trim()}
					data-testid={`key-${provider.id}-save`}
					className="shrink-0 cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-2xs transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Save
				</button>
				<button
					type="button"
					onClick={onCancel}
					data-testid={`key-${provider.id}-cancel`}
					className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					Cancel
				</button>
			</div>
			{error && (
				<p role="alert" className="w-full pl-0 text-xs text-miss" data-testid={`key-${provider.id}-error`}>
					{error}
				</p>
			)}
		</div>
	);
}

/** A var in auth.json that no catalog entry knows: read only, but removable. */
function UnknownKeyRow({ status, onDelete }: { status: AuthKeyStatus; onDelete: () => Promise<void> }) {
	const [confirm, setConfirm] = useState(false);
	const removable = status.source === "file";
	return (
		<div data-testid={`unknown-${status.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-accent/10 px-3.5 py-2.5">
			<span className="font-mono text-xs text-muted-foreground">{status.id}</span>
			<span className="flex items-center gap-3">
				<span className="font-mono text-[11px] text-muted-foreground">{status.masked}</span>
				{removable && !confirm && (
					<button
						type="button"
						onClick={() => setConfirm(true)}
						data-testid={`unknown-${status.id}-delete`}
						className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-miss"
					>
						Delete
					</button>
				)}
				{confirm && (
					<span className="flex shrink-0 items-center gap-2 text-xs" data-testid={`unknown-${status.id}-delete-confirm`}>
						<span className="text-muted-foreground">Delete this variable?</span>
						<button
							type="button"
							onClick={() => {
								setConfirm(false);
								void onDelete();
							}}
							data-testid={`unknown-${status.id}-delete-confirm-yes`}
							className="cursor-pointer font-medium text-miss underline-offset-2 hover:underline"
						>
							Delete
						</button>
						<button type="button" onClick={() => setConfirm(false)} className="cursor-pointer text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
							Keep
						</button>
					</span>
				)}
			</span>
		</div>
	);
}
