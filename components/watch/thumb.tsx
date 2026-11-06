"use client";

import { useState } from "react";
import { MonitorPlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The video's YouTube thumbnail, loaded from YouTube's image host in the
 *  browser; the icon stands in when YouTube has none. The box is 16:9 so the
 *  row does not move when the image arrives. */
export function Thumb({ id, watched }: { id: string; watched: boolean }) {
	const [missing, setMissing] = useState(false);
	if (missing) {
		return (
			<span className={cn("flex h-[50px] w-[89px] shrink-0 items-center justify-center rounded-md", watched ? "bg-well-2 text-ink-3" : "bg-teal-wash text-teal-2")}>
				<MonitorPlayIcon className="size-5" />
			</span>
		);
	}
	return (
		// next/image would need YouTube's image host allowed in its config; the plain image needs no setup.
		// eslint-disable-next-line @next/next/no-img-element
		<img src={`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`} alt="" loading="lazy" onError={() => setMissing(true)} className="h-[50px] w-[89px] shrink-0 rounded-md bg-well-2 object-cover" />
	);
}
