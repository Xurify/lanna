"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface VariantGroup {
	label: string;
	param: string;
	value: string;
	variants: Array<{ id: string; label: string }>;
}

const CSS = `
.vp { position: fixed; right: 16px; bottom: 16px; z-index: 90; width: 220px; max-height: calc(100dvh - 32px); display: flex; flex-direction: column; border-radius: 14px; background: rgb(20 20 20 / 0.94); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 8px 24px rgb(0 0 0 / 0.3); font: 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: rgb(255 255 255); user-select: none; }
.vp[data-hidden="true"] { display: none; }
.vp button { all: unset; box-sizing: border-box; cursor: pointer; }
.vp button:focus-visible { outline: 2px solid rgb(255 255 255 / 0.7); outline-offset: 2px; }
.vp .vp-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-radius: 14px; font-weight: 500; }
.vp-toggle span { color: rgb(255 255 255 / 0.5); font-weight: 400; }
.vp-toggle svg { transition: rotate 200ms ease-out; color: rgb(255 255 255 / 0.6); }
.vp[data-open="false"] .vp-toggle svg { rotate: 180deg; }
.vp-list { display: flex; flex-direction: column; gap: 14px; padding: 0 6px 6px; overflow-y: auto; scrollbar-width: none; }
.vp[data-open="false"] .vp-list { display: none; }
.vp-group { display: flex; flex-direction: column; gap: 2px; }
.vp-heading { display: flex; align-items: center; gap: 6px; padding: 4px 10px 6px; font-size: 11px; font-weight: 500; color: rgb(255 255 255 / 0.45); }
.vp-list button { padding: 8px 10px; border-radius: 8px; color: rgb(255 255 255 / 0.6); transition: color 200ms ease-out; }
.vp-list button:hover { color: rgb(255 255 255 / 0.85); }
.vp-list button[aria-pressed="true"] { background: rgb(255 255 255 / 0.14); color: rgb(255 255 255); font-weight: 500; }
.vp-keys { padding: 4px 10px 2px; font-size: 11px; color: rgb(255 255 255 / 0.35); line-height: 1.4; }
@media (prefers-reduced-motion: reduce) { .vp * { transition: none !important; } }
`;

function typingIn(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement ||
		(target instanceof HTMLElement && target.isContentEditable)
	);
}

export function VariantPicker({ groups }: { groups: VariantGroup[] }) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [open, setOpen] = useState(true);
	const [hidden, setHidden] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);
	const motion = groups.find((g) => g.param === "__motion")?.value;
	const summary = groups.map((g) => g.variants.find((v) => v.id === g.value)?.label.split(" · ")[0]).join(" · ");

	const go = (param: string, id: string) => {
		const next = new URLSearchParams(params.toString());
		next.set(param, id);
		router.replace(`${pathname}?${next.toString()}`, { scroll: false });
	};

	useEffect(() => {
		if (motion) document.documentElement.dataset.speakMotion = motion;
		return () => {
			delete document.documentElement.dataset.speakMotion;
		};
	}, [motion]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return;
			if (e.key === "h" || e.key === "H") {
				setHidden((h) => !h);
				return;
			}
			const first = groups[0];
			if (!first || !(e.key === "[" || e.key === "]")) return;
			e.preventDefault();
			const i = first.variants.findIndex((v) => v.id === first.value);
			const step = e.key === "]" ? 1 : -1;
			const next = first.variants[(i + step + first.variants.length) % first.variants.length];
			if (next) go(first.param, next.id);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	return (
		<>
			<style>{CSS}</style>
			<nav className="vp" aria-label="Variants" data-open={open} data-hidden={hidden}>
				<button type="button" className="vp-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
					<span>Variant</span>
					{summary}
					<svg
						aria-hidden="true"
						viewBox="0 0 16 16"
						width="12"
						height="12"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="m4 6 4 4 4-4" />
					</svg>
				</button>
				<div className="vp-list" ref={listRef}>
					{groups.map((g) => {
						const headingId = `vp-${g.param}`;
						return (
							<div key={g.param} className="vp-group" role="group" aria-labelledby={headingId}>
								<span className="vp-heading" id={headingId}>
									<svg
										aria-hidden="true"
										viewBox="0 0 16 16"
										width="12"
										height="12"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M3 3v4a3 3 0 0 0 3 3h7" />
										<path d="m10 7 3 3-3 3" />
									</svg>
									{g.label}
								</span>
								{g.variants.map((v) => (
									<button key={v.id} type="button" aria-pressed={v.id === g.value} onClick={() => go(g.param, v.id)}>
										{v.label}
									</button>
								))}
							</div>
						);
					})}
					<p className="vp-keys">[ ] switch layout · H hides</p>
				</div>
			</nav>
		</>
	);
}
