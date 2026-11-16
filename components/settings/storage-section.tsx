"use client";
/**
 * Settings → Data: what the app keeps on this computer. The desktop app's HTTP
 * cache clears through the desktop bridge. Saved areas are measured and never
 * cleared. A browser keeps its own cache, so the web build says where to clear it.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes, STORAGE_AREAS, type StorageArea, type StorageReport } from "@/src/core";
import { SettingsGroup, SettingsRow } from "./controls.tsx";

const CACHE_HINT =
	"Audio and pages the app keeps so they load faster. Clearing them is safe: they download again when needed.";
const BROWSER_CACHE_HINT =
	"Your browser keeps its own copy of audio and pages. Clear it in the browser’s settings, under cached images and files.";
const CLEARED = "Cache cleared. Audio and pages download again when you need them.";
const CLEAR_FAILED = "Couldn’t clear the cache. Restart LangHarness and try again.";
// An older desktop process has no storage handlers; a restart fixes it.
const UNREADABLE_HINT = "Restart LangHarness to measure and clear the app cache.";
const LOAD_FAILED = "Couldn’t measure storage. Refresh to try again.";

function savedHint(id: StorageArea["id"], language: string | null): string {
	if (id === "clips") return "Every spoken sentence, kept so it never needs generating again.";
	if (id === "progress")
		return `Chats, reviews, lessons and stories${language ? ` for ${language}` : ""}. Reset moves them to Backups.`;
	return "Data moved aside by Reset. Nothing is deleted.";
}

export function StorageSection() {
	// Read on the first render, so the cache row never flashes the browser label.
	const [desktop] = useState(() => typeof window !== "undefined" && Boolean(window.lh?.storage));
	const [report, setReport] = useState<StorageReport | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const [cacheBytes, setCacheBytes] = useState<number | null>(null);
	const [cacheFailed, setCacheFailed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

	useEffect(() => {
		let live = true;
		const storage = window.lh?.storage;
		if (storage) {
			void storage.cacheSize().then(
				(bytes) => {
					if (live) setCacheBytes(bytes);
				},
				() => {
					if (live) setCacheFailed(true);
				},
			);
		}
		void fetch("/api/storage", { cache: "no-store" })
			.then((r) => (r.ok ? (r.json() as Promise<StorageReport>) : Promise.reject(new Error(`storage ${r.status}`))))
			.then((next) => {
				if (live) setReport(next);
			})
			.catch(() => {
				if (live) setLoadFailed(true);
			});
		return () => {
			live = false;
		};
	}, []);

	const clear = async () => {
		const storage = window.lh?.storage;
		if (!storage || busy) return;
		setBusy(true);
		setNotice(null);
		try {
			setCacheBytes(await storage.clearCache());
			setCacheFailed(false);
			setNotice({ tone: "ok", text: CLEARED });
		} catch {
			setNotice({ tone: "error", text: CLEAR_FAILED });
		} finally {
			setBusy(false);
		}
	};

	const cacheValue = cacheFailed ? "Unavailable" : cacheBytes === null ? "…" : formatBytes(cacheBytes);

	return (
		<>
			<SettingsGroup label="Cache" testid="storage-cache">
				{/* Wraps the control under the hint on a phone, where SettingsRow would overlap them. */}
				<div
					data-testid="storage-row-cache"
					className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1"
				>
					<span className="min-w-0 flex-1">
						<span className="block font-prose text-(length:--lh-prose-size)">
							{desktop ? "App cache" : "Browser cache"}
						</span>
						<span className="block text-xs text-muted-foreground">
							{!desktop ? BROWSER_CACHE_HINT : cacheFailed ? UNREADABLE_HINT : CACHE_HINT}
						</span>
					</span>
					{desktop && (
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							<span className="font-ui text-xs tabular-nums text-foreground" data-testid="storage-cache-size">
								{cacheValue}
							</span>
							<Button
								type="button"
								size="xs"
								variant="outline"
								className="cursor-pointer disabled:cursor-not-allowed"
								data-testid="storage-clear-cache"
								disabled={busy || cacheFailed}
								aria-busy={busy}
								onClick={() => void clear()}
							>
								Clear cache
							</Button>
						</div>
					)}
				</div>
				{notice && (
					<p
						role={notice.tone === "error" ? "alert" : "status"}
						className={notice.tone === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
						data-testid="storage-notice"
					>
						{notice.text}
					</p>
				)}
			</SettingsGroup>
			<SettingsGroup label="Saved" testid="storage-saved">
				{!report && !loadFailed && (
					<span role="status" className="sr-only">
						Measuring…
					</span>
				)}
				{STORAGE_AREAS.map(({ id, label }) => {
					const area = report?.areas.find((a) => a.id === id);
					return (
						<SettingsRow
							key={id}
							label={label}
							testid={`storage-row-${id}`}
							hint={
								<>
									{savedHint(id, report?.language ?? null)}
									{/* Holds the path's line until the measure lands, so the rows keep their height. */}
									<span className="block min-h-4 break-all font-mono">{area?.path}</span>
								</>
							}
						>
							<span
								className="shrink-0 font-ui text-xs tabular-nums text-foreground"
								data-testid={`storage-size-${id}`}
							>
								{loadFailed ? "Unavailable" : area ? (area.files === 0 ? "Empty" : formatBytes(area.bytes)) : "…"}
							</span>
						</SettingsRow>
					);
				})}
				{loadFailed && (
					<p role="alert" className="text-xs text-muted-foreground">
						{LOAD_FAILED}
					</p>
				)}
			</SettingsGroup>
		</>
	);
}
