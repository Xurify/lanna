import Link from "next/link";
import { SearchXIcon, SunIcon } from "lucide-react";

/** The app's own not-found page (instead of the framework's bare 404). */
export default function NotFound() {
	return (
		<div className="flex min-h-dvh items-center justify-center px-6">
			<div className="w-full max-w-md text-center">
				<div className="mx-auto flex size-20 items-center justify-center rounded-full bg-accent text-muted-foreground">
					<SearchXIcon className="size-9" />
				</div>
				<h1 className="mt-5 font-ui text-2xl font-black text-foreground">Nothing here</h1>
				<p className="mt-2 font-prose text-base text-muted-foreground">There is no page at this address. It may have moved, or the link is old.</p>
				<div className="mt-6 flex justify-center">
					<Link href="/" className="flex h-11 items-center gap-2 rounded-xl bg-go px-5 font-ui text-sm font-bold text-go-ink transition-all hover:brightness-110">
						<SunIcon className="size-4" />
						Back to Today
					</Link>
				</div>
			</div>
		</div>
	);
}
