import * as React from "react";

import { cn } from "@/lib/utils";

export function CapLabel({ className, ...props }: React.ComponentProps<"span">) {
	return <span data-slot="label" className={cn("cap-center", className)} {...props} />;
}

const isText = (node: React.ReactNode): node is string | number => typeof node === "string" || typeof node === "number";

export function withCapLabels(children: React.ReactNode): React.ReactNode {
	const nodes = React.Children.toArray(children);
	if (!nodes.some(isText)) return children;
	const out: React.ReactNode[] = [];
	let run: (string | number)[] = [];
	const flush = () => {
		if (run.length === 0) return;
		if (run.join("").trim()) out.push(<CapLabel key={`label-${out.length}`}>{run.join("")}</CapLabel>);
		else out.push(...run);
		run = [];
	};
	for (const node of nodes) {
		if (isText(node)) run.push(node);
		else {
			flush();
			out.push(node);
		}
	}
	flush();
	return out;
}
