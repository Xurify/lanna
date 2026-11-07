"use client";

/**
 * What the chat page shows instead of a stock 404 when the session at this
 * address is not in the list: it was deleted (and can be put back, since
 * deletion only moves the file to the trash), or it never existed here.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveRestoreIcon, SearchXIcon, SunIcon } from "lucide-react";

export function SessionGone({ id, trashed }: { id: string; trashed: boolean }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);

	const restore = async () => {
		setBusy(true);
		setFailed(false);
		try {
			const res = await fetch(`/api/chats/${encodeURIComponent(id)}/restore`, { method: "POST" });
			if (!res.ok) throw new Error(String(res.status));
			router.refresh();
		} catch {
			setFailed(true);
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-dvh items-center justify-center px-6" data-testid="session-gone">
			<div className="w-full max-w-md text-center">
				<div className="mx-auto flex size-20 items-center justify-center rounded-full bg-accent text-muted-foreground">
					{trashed ? <ArchiveRestoreIcon className="size-9" /> : <SearchXIcon className="size-9" />}
				</div>
				<h1 className="mt-5 font-ui text-2xl font-black text-foreground">{trashed ? "This chat was deleted" : "No chat here"}</h1>
				<p className="mt-2 font-prose text-base text-muted-foreground">
					{trashed ? "It is in the trash, so you can put it back in your list." : "Nothing is saved at this address. It may have been removed, or the link is old."}
				</p>
				{failed && (
					<p className="mt-3 font-prose text-sm text-miss" role="alert">
						Couldn&apos;t restore it. Try again.
					</p>
				)}
				<div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					{trashed && (
						<button
							type="button"
							onClick={() => void restore()}
							disabled={busy}
							data-testid="session-restore"
							className="flex h-11 items-center gap-2 rounded-xl bg-go px-5 font-ui text-sm font-bold text-go-ink transition-[filter,opacity] hover:brightness-110 disabled:opacity-60"
						>
							<ArchiveRestoreIcon className="size-4" />
							{busy ? "Restoring…" : "Put it back"}
						</button>
					)}
					<Link href="/" className="flex h-11 items-center gap-2 rounded-xl border-2 px-5 font-ui text-sm font-bold text-foreground transition-colors hover:bg-accent">
						<SunIcon className="size-4" />
						Back to Today
					</Link>
				</div>
			</div>
		</div>
	);
}
