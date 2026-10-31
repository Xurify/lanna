"use client";

/**
 * The "Set up a model" and "Settings → Keys" lines on the learning screens.
 * There is no settings page (the dialog is modal-only, settings-dialog.tsx),
 * so these open the dialog in place.
 *
 * Model setup lands on Providers while no provider key exists (the model
 * list only offers what keys unlock), else on Agent, where the model slots
 * are. `keys` always lands on Providers, for the speech-to-text keys.
 */

import type { ReactNode } from "react";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { useZeroKeys } from "@/components/setup-cta";

export function SettingsLink({ keys = false, className, children }: { keys?: boolean; className?: string; children: ReactNode }) {
	const { open } = useSettingsDialog();
	const zeroKeys = useZeroKeys();
	return (
		<button type="button" onClick={() => open(keys || zeroKeys ? "keys" : "agent")} className={className}>
			{children}
		</button>
	);
}
