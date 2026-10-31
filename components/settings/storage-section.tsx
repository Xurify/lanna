"use client";
/**
 * Settings → Storage: what the app keeps on this computer, and what can be
 * cleared. The desktop app's HTTP cache (audio and pages it keeps so they load
 * faster) clears through the desktop bridge. Voice clips, progress and backups
 * are measured by GET /api/storage and never offer a clear. A browser keeps its
 * own cache, so the web build says where to clear it.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes, type StorageArea, type StorageReport } from "@/src/core";
import { SettingsGroup, SettingsRow } from "./controls.tsx";

const CACHE_HINT = "Audio and pages the app keeps so they load faster. Clearing them is safe: they download again when needed.";
const BROWSER_CACHE_HINT = "Your browser keeps its own copy of audio and pages. Clear it in the browser’s settings, under cached images and files.";
const CLEARED = "Cache cleared. Audio and pages download again when you need them.";
const CLEAR_FAILED = "Couldn’t clear the cache. Try again.";
const LOAD_FAILED = "Couldn’t measure storage. Refresh to try again.";

function savedHint(area: StorageArea, language: string): string {
	if (area.id === "clips") return "Every spoken sentence, kept so it never needs generating again.";
	if (area.id === "progress") return `Chats, reviews, lessons and stories for ${language}. Reset moves them to Backups.`;
	return "Data moved aside by Reset. Nothing is deleted.";
}

export function StorageSection() {
	// Read on the first render: this section mounts on a click, so the cache
	// row never flashes the browser label on the desktop.
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
				<div data-testid="storage-row-cache" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1">
					<span className="min-w-0 flex-1">
						<span className="block font-prose text-(length:--lh-prose-size)">{desktop ? "App cache" : "Browser cache"}</span>
						<span className="block text-xs text-muted-foreground">{desktop ? CACHE_HINT : BROWSER_CACHE_HINT}</span>
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
								disabled={busy}
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
				{report ? (
					report.areas.map((area) => (
						<SettingsRow
							key={area.id}
							label={area.label}
							testid={`storage-row-${area.id}`}
							hint={
								<>
									{savedHint(area, report.language)}
									<span className="block break-all font-mono">{area.path}</span>
								</>
							}
						>
							<span className="shrink-0 font-ui text-xs tabular-nums text-foreground" data-testid={`storage-size-${area.id}`}>
								{area.files === 0 ? "Empty" : formatBytes(area.bytes)}
							</span>
						</SettingsRow>
					))
				) : (
					<p role={loadFailed ? "alert" : undefined} className="text-xs text-muted-foreground">
						{loadFailed ? LOAD_FAILED : "Measuring…"}
					</p>
				)}
			</SettingsGroup>
		</>
	);
}
