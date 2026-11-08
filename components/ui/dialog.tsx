"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import { useBackdropDismiss } from "@/components/backdrop-dismiss";
import { cn } from "@/lib/utils";

interface DialogContextValue {
	onClose?: () => void;
}

const DialogContext = React.createContext<DialogContextValue>({});

export function Dialog({
	open = true,
	onClose,
	children,
}: {
	open?: boolean;
	onClose?: () => void;
	children: React.ReactNode;
}) {
	if (!open) return null;

	return (
		<DialogContext.Provider value={{ onClose }}>
			{children}
		</DialogContext.Provider>
	);
}

export function DialogPortal({
	children,
	container,
}: {
	children: React.ReactNode;
	container?: Element | null;
}) {
	if (typeof document === "undefined") {
		return <>{children}</>;
	}
	return createPortal(children, container ?? document.body);
}

export function DialogOverlay({
	className,
	children,
	onClose,
	...props
}: React.HTMLAttributes<HTMLDivElement> & { onClose?: () => void }) {
	const ctx = React.useContext(DialogContext);
	const handleClose = onClose ?? ctx.onClose;
	const backdropDismiss = useBackdropDismiss(handleClose ?? (() => {}));

	return (
		<div
			className={cn(
				"fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-100",
				className
			)}
			{...(handleClose ? backdropDismiss : {})}
			{...props}
		>
			{children}
		</div>
	);
}

export function DialogContent({
	className,
	children,
	showClose = false,
	onClose,
	...props
}: React.HTMLAttributes<HTMLDivElement> & {
	showClose?: boolean;
	onClose?: () => void;
}) {
	const ctx = React.useContext(DialogContext);
	const handleClose = onClose ?? ctx.onClose;

	return (
		<div
			role="dialog"
			aria-modal="true"
			onClick={(e) => e.stopPropagation()}
			className={cn(
				"relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card p-6 shadow-raise-hi animate-in zoom-in-95 duration-150",
				className
			)}
			{...props}
		>
			{children}
			{showClose && handleClose && (
				<button
					type="button"
					aria-label="Close"
					onClick={handleClose}
					className="absolute right-5 top-5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-well hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-teal"
				>
					<XIcon className="size-4" />
				</button>
			)}
		</div>
	);
}