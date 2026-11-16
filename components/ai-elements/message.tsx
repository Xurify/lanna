"use client";

import { cn } from "@/lib/utils";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";

import type { ComponentProps, HTMLAttributes } from "react";
import type { LhViewMessage } from "@/src/core";
import { memo } from "react";
import remarkBreaks from "remark-breaks";
import { Streamdown, type PluginConfig } from "streamdown";
import { mdComponents } from "@/components/md-blocks";

type MessageProps = HTMLAttributes<HTMLDivElement> & {
	from: LhViewMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
	<div
		data-word-lookup-enabled={from === "assistant" ? "true" : undefined}
		className={cn(
			"group flex w-full max-w-[95%] flex-col gap-2",
			from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
			className,
		)}
		{...props}
	/>
);

type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
	<div
		className={cn(
			"is-user:dark flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-[15px]",
			"group-[.is-user]:ml-auto group-[.is-user]:rounded-xl group-[.is-user]:bg-well group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
			"group-[.is-assistant]:text-foreground",
			className,
		)}
		{...props}
	>
		{children}
	</div>
);

type MessageResponseProps = ComponentProps<typeof Streamdown>;

// remark-breaks rides in the cjk plugin's remarkPluginsAfter slot (public
// PluginConfig API): Streamdown's bare `remarkPlugins` PROP would REPLACE the
// defaults ([remark-gfm, codeMeta]), silently dropping GFM and code-fence
// metastring parsing. The slot appends after the defaults, which is the
// standard remark-gfm → remark-breaks order.
//
// MERMAID is app-owned since the chrome-melt wave (2026-09-19): the md-blocks
// `code` override intercepts mermaid fences and renders via
// components/mermaid-render.ts — streamdown's internal mermaid machinery
// (the plugin entry + the `mermaid` prop) is retired with it.
export const streamdownPlugins = {
	cjk: {
		...cjk,
		remarkPluginsAfter: [...cjk.remarkPluginsAfter, remarkBreaks],
	},
	code,
} satisfies PluginConfig;

export const MessageResponse = memo(
	({ className, children, ...props }: MessageResponseProps) => {
		return (
			<Streamdown
				className={cn(
					// Source Sans 3 + emphasis-color tokens on every markdown surface
					// (labels stay JetBrains Mono). Unlayered plain CSS wins over text-sm.
					"lh-prose size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
					className,
				)}
				components={mdComponents}
				plugins={streamdownPlugins}
				{...props}
			>
				{children}
			</Streamdown>
		);
	},
	(prevProps, nextProps) =>
		prevProps.children === nextProps.children && nextProps.isAnimating === prevProps.isAnimating,
);

MessageResponse.displayName = "MessageResponse";

/** Recovery is a tool-text presentation concern, not a shape/answer-data
 * transform. Ordinary assistant/user prose keeps MessageResponse unchanged. */
export function ToolContentResponse({ children, ...props }: MessageResponseProps) {
	return <MessageResponse {...props}>{children}</MessageResponse>;
}
