"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** The channel's picture from Google's image host; the first letter shows
 *  when there is none or it does not load. The circle is the same size
 *  either way, so the row does not move when the picture arrives. */
export function Avatar({ name, src, size = "md" }: { name: string; src?: string; size?: "xs" | "md" | "lg" }) {
	const [failed, setFailed] = useState(false);
	return (
		<span
			aria-hidden="true"
			className={cn(
				"relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-well-2 font-ui font-[600] text-ink-2",
				size === "xs" ? "size-4 text-[9px]" : size === "md" ? "size-9 text-[15px]" : "size-14 text-xl",
			)}
		>
			{[...name.replace(/^[^\p{L}\p{N}]+/u, "")][0]?.toLocaleUpperCase() ?? "?"}
			{src && !failed && (
				// next/image would need Google's image host allowed in its config; the plain image needs no setup.
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={src}
					alt=""
					loading="lazy"
					decoding="async"
					referrerPolicy="no-referrer"
					onError={() => setFailed(true)}
					className="absolute inset-0 size-full object-cover"
				/>
			)}
		</span>
	);
}
