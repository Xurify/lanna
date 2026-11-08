"use client";
/**
 * The Keyboard section: view, rebind and reset shortcuts over core/keyboard.ts.
 * Overrides persist in localStorage (lh:keymap, overrides only, merged over
 * DEFAULT_BINDINGS), so a rebind applies on the next keydown with no reload.
 *
 * Rebind captures the next keydown (capture phase). Escape cancels. displayOnly
 * actions belong to a surface and are listed but never rebindable. No conflict
 * detection: on a clash, the first match in registry order wins.
 */

import { useEffect, useState } from "react";
import {
	KEYBOARD_ACTIONS,
	eventBinding,
	formatBinding,
	loadOverrides,
	saveOverrides,
	type KeyAction,
	type KeyScope,
} from "@/src/core";
import { SettingsRow } from "./controls.tsx";

const SCOPES: { scope: KeyScope; label: string }[] = [
	{ scope: "global", label: "Global" },
	{ scope: "chat", label: "Chat" },
	{ scope: "graph", label: "Skill map" },
];

/** One change to the overrides map. binding null resets the action to its default. */
function nextOverrides(
	current: Partial<Record<KeyAction, string>>,
	id: KeyAction,
	binding: string | null,
): Partial<Record<KeyAction, string>> {
	const next = { ...current };
	if (binding === null) delete next[id];
	else next[id] = binding;
	return next;
}

export function KeyboardSection() {
	const [overrides, setOverrides] = useState<Partial<Record<KeyAction, string>>>({});
	const [rebinding, setRebinding] = useState<KeyAction | null>(null);
	const [nonce, setNonce] = useState(0);
	const [confirmReset, setConfirmReset] = useState(false);

	// localStorage is read post-mount (SSR-safe); `nonce` re-reads after writes.
	useEffect(() => {
		setOverrides(loadOverrides());
	}, [nonce]);

	// Capture listener, armed only while a rebind is pending.
	useEffect(() => {
		if (!rebinding) return;
		const onKey = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.key === "Escape") {
				setRebinding(null);
				return;
			}
			// Modifier keydowns are not bindings on their own; keep listening.
			if (e.key === "Control" || e.key === "Meta" || e.key === "Alt" || e.key === "Shift") return;
			const binding = eventBinding(e);
			if (!binding) return;
			const next = nextOverrides(loadOverrides(), rebinding, binding);
			saveOverrides(next);
			setRebinding(null);
			setNonce((n) => n + 1);
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [rebinding]);

	function resetOne(id: KeyAction) {
		saveOverrides(nextOverrides(loadOverrides(), id, null));
		setNonce((n) => n + 1);
	}

	function resetAll() {
		saveOverrides({});
		setNonce((n) => n + 1);
	}

	const overridden = (id: KeyAction) => overrides[id] !== undefined;

	return (
		<>
			{SCOPES.map(({ scope, label }) => {
				const actions = KEYBOARD_ACTIONS.filter((a) => a.scope === scope);
				if (!actions.length) return null;
				return (
					<div key={scope} data-testid={`kbd-scope-${scope}`}>
						<p className="mb-1 text-xs text-muted-foreground">{label}</p>
						<div className="flex flex-col gap-2">
							{actions.map((def) => {
								const effective = overrides[def.id] ?? def.binding;
								return (
									<SettingsRow
										key={def.id}
										label={def.label}
										hint={def.displayOnly ? "Fixed — part of this screen" : undefined}
										testid={`kbd-row-${def.id}`}
									>
										<span className="flex items-center gap-2">
											<kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-ui text-xs">
												{rebinding === def.id ? "Press keys…" : formatBinding(effective)}
											</kbd>
											{def.displayOnly ? null : rebinding === def.id ? (
												<button
													type="button"
													onClick={() => setRebinding(null)}
													className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
												>
													Cancel
												</button>
											) : (
												<>
													<button
														type="button"
														onClick={() => setRebinding(def.id)}
														data-testid={`kbd-rebind-${def.id}`}
														className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline max-md:min-h-10 max-md:px-2"
													>
														Rebind
													</button>
													{overridden(def.id) && (
														<button
															type="button"
															onClick={() => resetOne(def.id)}
															data-testid={`kbd-reset-${def.id}`}
															className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
														>
															Reset
														</button>
													)}
												</>
											)}
										</span>
									</SettingsRow>
								);
							})}
						</div>
					</div>
				);
			})}
			<div className="mt-1 flex items-center justify-between">
				<span className="text-xs text-muted-foreground">Saved on this device. Only changed shortcuts are stored.</span>
				{confirmReset ? (
					<span className="flex items-center gap-3 text-xs" data-testid="kbd-reset-confirm">
						<span className="text-muted-foreground">Reset every shortcut to its default?</span>
						<button
							type="button"
							onClick={() => {
								setConfirmReset(false);
								resetAll();
							}}
							data-testid="kbd-reset-all-confirm"
							className="text-foreground underline-offset-2 hover:underline"
						>
							Reset all
						</button>
						<button
							type="button"
							onClick={() => setConfirmReset(false)}
							className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
						>
							Keep
						</button>
					</span>
				) : (
					<button
						type="button"
						onClick={() => setConfirmReset(true)}
						data-testid="kbd-reset-all"
						className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					>
						Reset all to defaults
					</button>
				)}
			</div>
		</>
	);
}