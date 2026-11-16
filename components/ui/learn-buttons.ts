import { cn } from "@/lib/utils";

/**
 * The one button family of the learning screens, in the Quiet tool look
 * (copied from the mockup's `.btn`): 36px tall, 8px radius, 14px / 550. Today,
 * the lessons, Review and every task screen take their buttons from here, so a
 * "Check" or a "Start" looks and behaves the same wherever it appears. The main
 * action is the teal: one filled button per screen.
 */
export const BUTTON =
	"lh-press inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 font-ui text-sm font-[550] tracking-[-0.005em]";
export const PRIMARY = cn(
	BUTTON,
	"bg-sun text-sun-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-sun",
);
export const SECONDARY = cn(
	BUTTON,
	"bg-card px-3.5 text-foreground shadow-[0_0_0_1px_var(--q-line-2),0_1px_2px_rgb(var(--q-shadow-rgb)/0.05)] hover:bg-well disabled:opacity-50",
);
/** A quiet text action beside a primary one ("I don't know", "Skip"). */
export const QUIET = cn(BUTTON, "px-2.5 text-muted-foreground hover:bg-well hover:text-ink-2 disabled:opacity-50");
/** The compact size, for actions inside a card or a row. */
export const SMALL = "h-8 rounded-md px-3 text-[13px]";
/** A key name shown next to the action it triggers. */
export const KBD =
	"inline-flex h-5 items-center rounded-[5px] bg-background px-1.5 font-ui text-xs font-[550] text-ink-3 shadow-[0_0_0_1px_var(--q-line-2),0_1px_0_var(--q-line-2)]";
