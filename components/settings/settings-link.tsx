"use client";

/**
 * The "Set up a model" and "Settings → API keys" lines on the learning screens.
 * There is no settings page (the dialog is modal-only, settings-dialog.tsx),
 * so these open the dialog in place.
 *
 * Model setup lands on Keys while no provider key exists (the model list
 * only offers what keys unlock), else on AI models, where the model slots are.
 * `keys` always lands on Keys, for the speech-to-text keys.
 */

import type { ReactNode } from "react";
import { useSettingsDialog } from "@/components/settings/settings-context";
import { useZeroKeys } from "@/components/setup-cta";

export function SettingsLink({ keys = false, className, children }: { keys?: boolean; className?: string; children: ReactNode }) {
	const { open } = useSettingsDialog();
	const zeroKeys = useZeroKeys();
	return (
		<button type="button" onClick={() => open(keys || zeroKeys ? "keys" : "ai")} className={className}>
			{children}
		</button>
	);
}
