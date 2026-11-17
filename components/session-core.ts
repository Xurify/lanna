import { needsContinuation, newProblemDismissedMarker, type ChatInput, type LannaMessage } from "../src/core";
import { bodyTextOr, chatPath, errorMessageOf, fetchAttach, jsonPost, readBodyText } from "./session/attach";
import { continuationOwed } from "./session/continuation";
import {
	admitsTurn,
	adoptAppend,
	appendTail,
	beginSubmit,
	cleanSlate,
	replaceRecord,
	retireRunningTurn,
	settleConsume,
	withError,
	withStatus,
} from "./session/data";
import { localId } from "./session/local-id";
import { projectSessionState } from "./session/project";
import { ConnectionDrop, turnFrames, type TurnFrame } from "./session/sse";
import { dropSteer, newSteerId, queueSteer } from "./session/steer-queue";
import {
	initialSessionData,
	type ConsumeEnd,
	type SessionData,
	type SessionKind,
	type SessionState,
	type SessionStatus,
} from "./session/state";
import { postTurnInput, TURN_RETRY_DEADLINE_MS, TURN_RETRY_POLL_MS, type TurnRetryTiming } from "./session/turn-post";
import { reduceWireEvent, type WireEvent } from "./session/wire";

export type { SessionState, SessionStatus, SteerQueueItem } from "./session/state";
export { absorbed } from "./session/absorb";
export { visibleQueuedSteers } from "./session/steer-queue";

const TURN_ALREADY_RUNNING = "A turn is already running — try again in a moment.";

const DONE: ConsumeEnd = { kind: "done" };
const SETTLED: ConsumeEnd = { kind: "settled" };
const DROPPED: ConsumeEnd = { kind: "dropped" };
const ABORTED: ConsumeEnd = { kind: "aborted" };

interface SessionModelOptions {
	chatId: string;
	initialMessages: LannaMessage[];
	initialError?: string;
	fetch?: typeof globalThis.fetch;
	pollMs?: number;
	waitMaxMs?: number;
	onChange?: () => void;
	onReattachSettled?: () => void;
}

interface RecordSnapshot {
	messages?: LannaMessage[];
	turnError?: string;
}

export class SessionModel {
	readonly chatId: string;
	fetch: typeof globalThis.fetch;
	onChange?: () => void;
	private data: SessionData;
	private readonly timing: TurnRetryTiming;
	private onReattachSettled?: () => void;
	private consumeAbort: AbortController | null = null;

	constructor(options: SessionModelOptions) {
		this.chatId = options.chatId;
		this.data = initialSessionData(options.initialMessages, options.initialError);
		// The browser's native fetch throws "Illegal invocation" unless it is called on the window object.
		this.fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
		this.timing = {
			pollMs: options.pollMs ?? TURN_RETRY_POLL_MS,
			waitMaxMs: options.waitMaxMs ?? TURN_RETRY_DEADLINE_MS,
		};
		this.onChange = options.onChange;
		this.onReattachSettled = options.onReattachSettled;
	}

	get status(): SessionStatus {
		return this.data.status;
	}

	get readyRef(): boolean {
		return this.data.status === "ready";
	}

	getState(): SessionState {
		return projectSessionState(this.data);
	}

	setReattachSettled(fn: () => void): void {
		this.onReattachSettled = fn;
	}

	postInputEvent(input: ChatInput, signal?: AbortSignal): Promise<Response> {
		return postTurnInput(this.fetch, this.chatId, input, this.timing, signal);
	}

	applyWireEvent(event: Record<string, unknown>): boolean {
		const step = reduceWireEvent(this.data, event as WireEvent);
		this.commit(step.data);
		return step.acted;
	}

	async consumeStream(
		response: Response,
		controller: AbortController | null = this.consumeAbort,
		allowRecovery = true,
	): Promise<void> {
		if (!response.body) throw new Error("The turn stream body is empty.");
		const reader = response.body.getReader();
		let end: ConsumeEnd = DROPPED;
		try {
			end = await this.applyFrames(turnFrames(reader), controller);
		} finally {
			await reader.cancel().catch(() => {});
			reader.releaseLock();
			if (this.consumeAbort === controller) this.commit(settleConsume(this.data, end));
		}
		if (this.consumeAbort !== controller || end.kind !== "dropped") return;
		if (!allowRecovery) throw new ConnectionDrop();
		await this.resumeStream(true, false);
	}

	async resumeStream(refetchRecordFirst = true, allowRecovery = true): Promise<void> {
		this.consumeAbort?.abort();
		const controller = new AbortController();
		this.consumeAbort = controller;
		if (!refetchRecordFirst) this.commit(cleanSlate(this.data));
		this.commit(withStatus(this.data, "submitted"));
		try {
			if (refetchRecordFirst) await this.refetchRecord(controller, allowRecovery);
			if (this.consumeAbort !== controller) return;
			const response = await fetchAttach(
				this.fetch,
				chatPath(this.chatId, "/stream"),
				controller.signal,
				!allowRecovery,
			);
			if (this.consumeAbort !== controller) return;
			if (!response.ok) throw new Error(await bodyTextOr(response, "Failed to attach to the running turn."));
			await this.consumeStream(response, controller, allowRecovery);
		} catch (error) {
			if (this.consumeAbort !== controller || controller.signal.aborted) return;
			this.fail(error);
		}
	}

	async send(input: ChatInput): Promise<void> {
		if (!admitsTurn(this.data.status)) return;
		this.consumeAbort?.abort();
		const controller = new AbortController();
		this.consumeAbort = controller;
		this.commit(beginSubmit(this.data, input));
		try {
			const response = await this.postInputEvent(input);
			if (response.status === 409) throw new Error(TURN_ALREADY_RUNNING);
			if (!response.ok) throw new Error(await bodyTextOr(response, `The send failed (${response.status}).`));
			await response.text().catch(() => {});
			if (this.consumeAbort !== controller) return;
			await this.resumeStream(true);
		} catch (error) {
			if (this.consumeAbort !== controller || controller.signal.aborted) return;
			this.fail(error);
		}
	}

	async steer(text: string): Promise<void> {
		const trimmed = text.trim();
		if (!trimmed) return;
		const id = newSteerId();
		this.commit(queueSteer(this.data, { id, text: trimmed }));
		try {
			const response = await this.fetch(
				chatPath(this.chatId, "/steer"),
				jsonPost({ input: { type: "steer", id, text: trimmed } }),
			);
			if (response.ok) return;
			this.commit(dropSteer(this.data, id));
			if (response.status === 409) {
				await this.send({ type: "text", text: trimmed });
				return;
			}
			this.commit(withError(this.data, await bodyTextOr(response, `The steer failed (${response.status}).`)));
		} catch (error) {
			this.commit(dropSteer(this.data, id));
			this.commit(withError(this.data, errorMessageOf(error)));
		}
	}

	async dismissProblem(problemCallId: string): Promise<void> {
		if (this.data.status !== "ready") return;
		this.commit(appendTail(this.data, [{ ...newProblemDismissedMarker(problemCallId), id: localId() }]));
		try {
			const response = await this.fetch(
				chatPath(this.chatId, "/dismiss"),
				jsonPost({ input: { type: "dismiss-problem", problemCallId } }),
			);
			if (!response.ok) throw new Error(`The dismissal failed (${response.status}).`);
		} catch (error) {
			this.commit(withError(this.data, errorMessageOf(error)));
		}
	}

	stop(): void {
		this.consumeAbort?.abort();
		this.consumeAbort = null;
		this.commit(withStatus(retireRunningTurn(this.data), "ready"));
	}

	setMessages(record: LannaMessage[], turnError?: string): void {
		this.commit(replaceRecord(this.data, record, turnError));
	}

	adoptRecord(record: LannaMessage[]): void {
		this.commit(adoptAppend(this.data, record));
	}

	async continueIfOwed(record: readonly LannaMessage[], kind: SessionKind = "chat"): Promise<void> {
		if (continuationOwed(this.data, record, kind)) await this.send({ type: "continue" });
	}

	clearError(): void {
		this.commit(withError(this.data, null));
	}

	static needsContinuation = needsContinuation;

	private commit(next: SessionData): void {
		if (next === this.data) return;
		this.data = next;
		this.onChange?.();
	}

	private fail(error: unknown): void {
		this.commit(withStatus(withError(this.data, errorMessageOf(error)), "error"));
	}

	private async refetchRecord(controller: AbortController, allowRecovery: boolean): Promise<void> {
		const response = await fetchAttach(this.fetch, chatPath(this.chatId), controller.signal, !allowRecovery);
		if (this.consumeAbort !== controller) return;
		if (!response.ok) {
			this.commit(cleanSlate(this.data));
			return;
		}
		const text = await readBodyText(response, controller.signal, !allowRecovery);
		const snapshot = JSON.parse(text) as RecordSnapshot;
		if (this.consumeAbort !== controller) return;
		this.commit(
			Array.isArray(snapshot.messages)
				? replaceRecord(this.data, snapshot.messages, snapshot.turnError)
				: cleanSlate(this.data),
		);
	}

	private async applyFrames(
		frames: AsyncGenerator<TurnFrame, boolean>,
		controller: AbortController | null,
	): Promise<ConsumeEnd> {
		let sawWork = false;
		for (;;) {
			let next: IteratorResult<TurnFrame, boolean>;
			try {
				next = await frames.next();
			} catch (error) {
				if (error instanceof ConnectionDrop) return DROPPED;
				throw error;
			}
			if (this.consumeAbort !== controller) return ABORTED;
			if (next.done) return next.value ? DONE : DROPPED;
			const frame = next.value;
			if (frame.type === "turn-settled") {
				this.onReattachSettled?.();
				return SETTLED;
			}
			const acted = this.applyWireEvent(frame);
			if (acted && !sawWork) {
				sawWork = true;
				if (this.data.status !== "error") this.commit(withStatus(this.data, "streaming"));
			}
		}
	}
}
