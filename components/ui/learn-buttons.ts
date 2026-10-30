import { cn } from "@/lib/utils";

/**
 * The one button family of the learning screens: flat, sentence case, 48px
 * tall so the main action is an easy target. Today, the lessons, Review and
 * every task screen take their buttons from here, so a "Check" or a "Start"
 * looks and behaves the same wherever it appears.
 */
export const BUTTON = "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 font-ui text-base font-extrabold transition-[filter,transform,background-color] active:scale-[0.98]";
export const PRIMARY = cn(BUTTON, "bg-go text-go-ink hover:brightness-110 disabled:cursor-not-allowed disabled:bg-accent disabled:text-muted-foreground disabled:hover:brightness-100 disabled:active:scale-100");
export const SECONDARY = cn(BUTTON, "bg-foreground/10 px-5 text-foreground hover:bg-foreground/15 disabled:opacity-50");
/** A quiet text action beside a primary one ("I don't know", "Skip"). */
export const QUIET = cn(BUTTON, "px-4 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50");
/** The compact size, for actions inside a card or a row. */
export const SMALL = "h-10 rounded-lg px-4 text-sm";
/** A key name shown next to the action it triggers. */
export const KBD = "rounded-md border border-border bg-background px-1.5 py-0.5 font-ui text-xs font-bold text-muted-foreground";
