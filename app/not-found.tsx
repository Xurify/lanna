import Link from "next/link";
import { QIcon } from "@/components/quiet/icon";

/** The app's own not-found page (instead of the framework's bare 404). */
export default function NotFound() {
	return (
		<div className="flex min-h-dvh items-center justify-center px-6">
			<div className="w-full max-w-md">
				<div className="q-card p-6">
					<h1 className="text-[20px] font-semibold tracking-[-0.018em] text-foreground">Nothing here</h1>
					<p className="q-line dim mt-1.5 !text-[15px]">
						There is no page at this address. It may have moved, or the link is old.
					</p>
					<div className="q-acts">
						<Link href="/" className="q-btn primary">
							<QIcon name="arrow" className="size-4" />
							Back to Today
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
