import { ZeroKeysPill } from "@/components/setup-cta";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SetupCtaProps {
	zeroKeys: boolean;
	configured: boolean;
	onOpen: () => void;
}

export function SetupCta({ zeroKeys, configured, onOpen }: SetupCtaProps) {
	if (zeroKeys) return <ZeroKeysPill onOpen={onOpen} />;
	if (configured) return null;
	return (
		<div className="relative h-0">
			<div className="pointer-events-auto absolute inset-x-0 bottom-2 flex justify-center">
				<button
					type="button"
					data-testid="setup-cta"
					onClick={onOpen}
					className={cn(
						buttonVariants({ variant: "accent-soft", size: "sm" }),
						"cursor-pointer rounded-full font-ui font-semibold",
					)}
				>
					Add an AI key
				</button>
			</div>
		</div>
	);
}
