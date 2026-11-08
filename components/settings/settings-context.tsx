"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SectionId } from "./settings-dialog.tsx";

/** `open(section?, row?)`. `row` is the key id (the env-var name) to unfold in Keys. */
const DialogContext = createContext<{ open: (section?: string, row?: string) => void }>({ open: () => {} });

// The dialog's code (sections, provider pickers, key forms) is a large share of
// the first load, and it is only needed once the learner opens it.
const SettingsDialogOpen = dynamic(() => import("./settings-dialog.tsx").then((m) => m.SettingsDialogOpen), { ssr: false });

/** AppShell-level mount: the sidebar row and the mod+, chord call this.
 *  `open(section)` lands the dialog on a specific section (the first-run
 *  setup flow deep-links to Keys when no provider key exists yet). */
export function SettingsDialogProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [show, setShow] = useState(false);
	const [landOn, setLandOn] = useState<SectionId>("general");
	const [landOnRow, setLandOnRow] = useState<string | null>(null);
	const open = useCallback((section?: string, row?: string) => {
		setLandOn(section ? section as SectionId : "general");
		setLandOnRow(row ?? null);
		setShow(true);
	}, []);
	useEffect(() => window.lh?.onOpenSettings?.((section) => open(section)), [open]);
	return (
		<DialogContext.Provider value={{ open }}>
			{children}
			{show && <SettingsDialogOpen onClose={() => setShow(false)} initialSection={landOn} initialRow={landOnRow} />}
		</DialogContext.Provider>
	);
}

export function useSettingsDialog() {
	return useContext(DialogContext);
}
