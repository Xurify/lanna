"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface VariantGroup {
	label: string;
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

/** A design-review harness: switches `?__variant=` on the current page. Kept outside the design system on purpose. */
export function VariantPicker({ groups, value }: { groups: VariantGroup[]; value: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [open, setOpen] = useState(true);
	const [hidden, setHidden] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);
	const flat = groups.flatMap((g) => g.variants);
	const current = flat.find((v) => v.id === value) ?? flat[0];

	const go = (id: string) => {
		const next = new URLSearchParams(params.toString());
		next.set("__variant", id);
		router.replace(`${pathname}?${next.toString()}`, { scroll: false });
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return;
			if (e.key === "h" || e.key === "H") {
				setHidden((h) => !h);
				return;
			}
			const step =
				e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
			if (!step || !current) return;
			e.preventDefault();
			const i = flat.findIndex((v) => v.id === current.id);
			const next = flat[(i + step + flat.length) % flat.length];
			if (next) go(next.id);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	useEffect(() => {
		listRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
	}, [value]);

	return (
		<>
			<style>{CSS}</style>
			<nav className="vp" aria-label="Variants" data-open={open} data-hidden={hidden}>
				<button type="button" className="vp-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
					<span>Variant</span>
					{current?.label}
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
						const headingId = `vp-${g.label.toLowerCase().replace(/\W+/g, "-")}`;
						return (
							<div key={g.label} className="vp-group" role="group" aria-labelledby={headingId}>
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
									<button key={v.id} type="button" aria-pressed={v.id === current?.id} onClick={() => go(v.id)}>
										{v.label}
									</button>
								))}
							</div>
						);
					})}
					<p className="vp-keys">← → or ↑ ↓ switch · H hides</p>
				</div>
			</nav>
		</>
	);
}
