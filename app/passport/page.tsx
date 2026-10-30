import { redirect } from "next/navigation";

/** The passport (E14) is gone: each open chapter's exam is a row on the
 *  path (E15), so the old address goes to /curriculum. */
export default function PassportPage() {
	redirect("/curriculum");
}
