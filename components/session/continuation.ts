import { needsContinuation, type LannaMessage } from "../../src/core";
import { visibleError } from "./project";
import type { SessionData, SessionKind } from "./state";

export function continuationOwed(data: SessionData, record: readonly LannaMessage[], kind: SessionKind): boolean {
	return (
		data.status === "ready" &&
		!data.automaticContinuationBlocked &&
		visibleError(data) === null &&
		needsContinuation(record, kind)
	);
}
