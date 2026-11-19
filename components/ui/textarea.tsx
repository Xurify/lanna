import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"q-field block min-h-44 w-full resize-y px-4 py-3 font-prose text-lg leading-7 placeholder:text-ink-3 disabled:cursor-wait",
				className,
			)}
			{...props}
		/>
	);
}
