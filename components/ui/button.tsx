import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-[550] tracking-[-0.005em] whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,scale] active:not-disabled:scale-[0.97] outline-none focus-visible:ring-[3px] focus-visible:ring-teal/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					"bg-teal text-primary-foreground hover:bg-teal-2 shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_1px_2px_rgb(10_84_82/0.35)]",
				destructive:
					"bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
				// A quiet destructive action: tinted fill, no border, so it reads as
				// a button without shouting. The solid `destructive` is for the
				// confirm step of a dialog.
				"destructive-soft":
					"bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:ring-destructive/30",
				// The gold call to action ("Set up your models"): tinted fill, no border.
				"accent-soft": "bg-gold/15 text-gold hover:bg-gold/25 focus-visible:ring-gold/30",
				outline:
					"bg-card text-foreground shadow-[0_0_0_1px_var(--q-line-2),0_1px_2px_rgb(var(--q-shadow-rgb)/0.05)] hover:bg-well",
				secondary: "bg-well-2 text-foreground hover:bg-well",
				ghost: "text-ink-3 hover:bg-well hover:text-ink-2",
				link: "text-teal-2 underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
