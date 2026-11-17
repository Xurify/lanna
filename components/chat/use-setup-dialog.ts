import { useCallback, useState } from "react";
import { slotsConfigured, type ModelsSettings } from "@/src/core";
import { useZeroKeys } from "@/components/setup-cta";
import { useSettingsSaved } from "@/components/settings-signal";

export function useSetupDialog(initialConfigured: boolean) {
	const [setupOpen, setSetupOpen] = useState(false);
	const [configured, setConfigured] = useState(initialConfigured);
	const zeroKeys = useZeroKeys();

	useSettingsSaved((section) => {
		if (section !== "models") return;
		fetch("/api/settings")
			.then((response) => response.json() as Promise<{ settings?: { models?: ModelsSettings } | null } | null>)
			.then((body) => setConfigured(slotsConfigured(body?.settings?.models)))
			.catch(() => {});
	});

	const openSetup = useCallback(() => setSetupOpen(true), []);
	const closeSetup = useCallback(() => setSetupOpen(false), []);
	const finishSetup = useCallback(() => {
		setSetupOpen(false);
		setConfigured(true);
	}, []);

	return { setupOpen, openSetup, closeSetup, finishSetup, configured, zeroKeys };
}
