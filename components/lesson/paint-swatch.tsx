import type { CSSProperties } from "react";
import { Sheet } from "@/components/lesson/ink";
import { patchD } from "@/components/lesson/ink-paths";
import type { Paint } from "@/src/core";

export function PaintSwatch({ paint, label, className }: { paint: Paint; label: string; className?: string }) {
	const dab = patchD(30, 15, 25, 11, 11);
	return (
		<span role="img" aria-label={label} className={className} data-paint={paint}>
			<Sheet viewBox="0 0 60 30" className="block h-full w-full">
				<path d={dab} style={{ fill: `var(--q-paint-${paint})` } as CSSProperties} className="ink-fade" />
				<path
					d={dab}
					className="ink-fade fill-none stroke-current text-ink-2"
					strokeWidth={1.2}
					strokeLinejoin="round"
				/>
			</Sheet>
		</span>
	);
}
