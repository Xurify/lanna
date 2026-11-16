import { cn } from "@/lib/utils";
import { SettingsLink } from "@/components/settings/settings-link";

/**
 * An empty, blocked or failed screen (Quiet tool). It sits near the top of a normal page, under the
 * page's own header, and does four things in plain words: says what the screen is for, why it is
 * empty, what still works, and offers ONE primary action (plus at most a text link). It never blames
 * the learner and never names an internal term (slot, token, strong, cheap).
 */
export function EmptyState({
	title,
	children,
	action,
	secondary,
	className,
	testid,
}: {
	title: string;
	children: React.ReactNode;
	action?: React.ReactNode;
	secondary?: React.ReactNode;
	className?: string;
	testid?: string;
}) {
	return (
		<section
			className={cn("max-w-[560px]", className)}
			data-testid={testid}
			aria-labelledby={testid ? `${testid}-title` : undefined}
		>
			<h2
				id={testid ? `${testid}-title` : undefined}
				className="text-[20px] font-semibold leading-[1.25] tracking-[-0.018em] text-foreground"
			>
				{title}
			</h2>
			<div className="q-line dim mt-1.5 !text-[15px] [&_p+p]:mt-2">{children}</div>
			{(action || secondary) && (
				<div className="q-acts" style={{ marginTop: 16 }}>
					{action}
					{secondary}
				</div>
			)}
		</section>
	);
}

/** The quiet line for a feature that needs an AI key, with the one place to add it. */
export function KeyNote({ children = "New ones are written with an AI key." }: { children?: React.ReactNode }) {
	return (
		<p className="q-needs" data-testid="key-note">
			<span>
				{children}{" "}
				<SettingsLink keys className="text-ink-2 underline decoration-line-2 underline-offset-[3px]">
					Add one in Settings → API keys.
				</SettingsLink>
			</span>
		</p>
	);
}

/** The primary action that opens Settings on the keys page. */
export function AddKeyButton({ label = "Add an AI key" }: { label?: string }) {
	return (
		<SettingsLink keys className="q-btn primary">
			{label}
		</SettingsLink>
	);
}
