import { Pulse } from "@/components/task-frame";

/**
 * Shown the moment a tab is clicked. Every page is rendered on the server per
 * request (it reads the learner's files), so without this a click waits for
 * that render, with no change on screen and the URL not yet updated, which
 * feels like a dead button. With it, the route changes at once and the page
 * fills in. The shapes match the page header every screen starts with, so
 * little moves when the real page arrives.
 */
export default function Loading() {
	return (
		<div className="min-h-dvh bg-background" aria-busy="true" aria-live="polite" data-testid="route-loading">
			<div className="mx-auto w-full max-w-3xl px-5 pt-16">
				<Pulse className="h-3.5 w-14" />
				<Pulse className="mt-4 block h-9 w-56" />
				<Pulse className="mt-4 block h-4 w-full max-w-lg" />
				<Pulse className="mt-2 block h-4 w-2/3 max-w-sm" />
				<Pulse className="mt-8 block h-40 w-full rounded-xl" />
				<span className="sr-only">Loading</span>
			</div>
		</div>
	);
}
