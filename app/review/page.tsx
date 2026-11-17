import { ReviewSession } from "@/components/review-session";

export const metadata = { title: "Review" };

/** Spaced review: cloze cards from the dictionary, FSRS-scheduled. */
export default function ReviewPage() {
	return <ReviewSession />;
}
