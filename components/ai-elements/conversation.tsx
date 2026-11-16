"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => (
	<StickToBottom
		className={cn("relative flex-1 overflow-y-hidden", className)}
		initial="smooth"
		resize="smooth"
		role="log"
		{...props}
	/>
);

type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
	<StickToBottom.Content className={cn("flex flex-col gap-8 p-4", className)} {...props} />
);

type ConversationEmptyStateProps = ComponentProps<"div"> & {
	title?: string;
	description?: string;
	icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
	className,
	title = "No messages yet",
	description = "Start a conversation to see messages here",
	icon,
	children,
	...props
}: ConversationEmptyStateProps) => (
	<div
		className={cn("flex size-full flex-col items-center justify-center gap-3 p-8 text-center", className)}
		{...props}
	>
		{children ?? (
			<>
				{icon && (
					<div className="flex size-14 items-center justify-center rounded-2xl bg-card text-muted-foreground">
						{icon}
					</div>
				)}
				<div className="max-w-md space-y-1.5">
					<h3 className="font-ui text-2xl font-semibold text-foreground">{title}</h3>
					{description && <p className="text-base text-muted-foreground">{description}</p>}
				</div>
			</>
		)}
	</div>
);

type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({ className, ...props }: ConversationScrollButtonProps) => {
	const { isAtBottom, scrollToBottom } = useStickToBottomContext();

	const handleScrollToBottom = useCallback(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	return (
		!isAtBottom && (
			<Button
				className={cn(
					"absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full dark:bg-background dark:hover:bg-muted",
					className,
				)}
				onClick={handleScrollToBottom}
				size="icon"
				type="button"
				variant="outline"
				{...props}
			>
				<ArrowDownIcon className="size-4" />
			</Button>
		)
	);
};
