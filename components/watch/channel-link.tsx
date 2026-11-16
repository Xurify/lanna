"use client";

import { Avatar } from "@/components/watch/avatar";
import { channelUrl, isChannelId } from "@/src/core";

/** A channel's name (and picture, when asked) as a link to it on YouTube, in a new tab. Plain text when the channel's id is not known. */
export function ChannelLink({
	id,
	handle,
	name,
	avatar,
	withAvatar,
}: {
	id?: string;
	handle?: string;
	name: string;
	avatar?: string;
	withAvatar?: boolean;
}) {
	const inner = (
		<>
			{withAvatar && <Avatar name={name} src={avatar} size="xs" />}
			<span className="truncate">{name}</span>
		</>
	);
	if (!id || !isChannelId(id)) return <span className="inline-flex min-w-0 items-center gap-1.5">{inner}</span>;
	return (
		<a
			href={channelUrl({ id, handle })}
			target="_blank"
			rel="noreferrer"
			title={`${name} (opens on YouTube)`}
			className="inline-flex min-w-0 items-center gap-1.5 rounded-sm hover:text-ink-2 hover:underline focus-visible:underline"
		>
			{inner}
		</a>
	);
}
