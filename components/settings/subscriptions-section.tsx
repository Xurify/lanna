"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerEvent } from "@/components/server-events";
import { notifySettingsSaved } from "@/components/settings-signal";
import type { SubscriptionId, SubscriptionStatus } from "@/src/core";
import { ConnectionRow } from "./connection-controls.tsx";

const PATH = "/api/subscriptions";
const HEADERS = { "Content-Type": "application/json", "x-lanna-subscriptions": "1" };

async function readStatus(): Promise<SubscriptionStatus[]> {
	const response = await fetch(PATH, { headers: HEADERS, cache: "no-store" });
	if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error);
	return (await response.json()) as SubscriptionStatus[];
}

async function send(
	op: "start" | "respond" | "cancel" | "sign-out",
	provider: SubscriptionId,
	value?: string,
): Promise<SubscriptionStatus[]> {
	const response = await fetch(PATH, {
		method: "POST",
		headers: HEADERS,
		body: JSON.stringify({ op, provider, ...(value === undefined ? {} : { value }) }),
	});
	const body = (await response.json().catch(() => ({}))) as SubscriptionStatus[] | { error?: string };
	if (!response.ok || !Array.isArray(body)) throw new Error((body as { error?: string }).error);
	return body;
}

function useSubscriptions() {
	const [statuses, setStatuses] = useState<SubscriptionStatus[]>([]);
	const [unavailable, setUnavailable] = useState<string | null>(null);
	const refresh = useCallback(() => {
		readStatus()
			.then((next) => {
				setStatuses(next);
				setUnavailable(null);
			})
			.catch((error: unknown) =>
				setUnavailable(error instanceof Error && error.message ? error.message : "Sign-ins are unavailable."),
			);
	}, []);
	useEffect(refresh, [refresh]);
	useServerEvent("subscriptions-changed", refresh);
	const signingIn = statuses.some((s) => s.login);
	useEffect(() => {
		if (!signingIn) return;
		const timer = setInterval(refresh, 1500);
		return () => clearInterval(timer);
	}, [signingIn, refresh]);
	const act = useCallback(
		async (op: "start" | "respond" | "cancel" | "sign-out", provider: SubscriptionId, value?: string) => {
			const next = await send(op, provider, value);
			setStatuses(next);
			if (op === "sign-out") notifySettingsSaved("keys");
		},
		[],
	);
	return { statuses, unavailable, act };
}

function PromptField({ status, onAnswer }: { status: SubscriptionStatus; onAnswer: (value: string) => void }) {
	const [value, setValue] = useState("");
	const prompt = status.login?.prompt;
	if (!prompt) return null;
	if (prompt.type === "select")
		return (
			<div className="flex flex-wrap gap-2">
				{prompt.options?.map((option) => (
					<Button key={option.id} type="button" size="xs" variant="outline" onClick={() => onAnswer(option.id)}>
						{option.label}
					</Button>
				))}
			</div>
		);
	return (
		<form
			className="flex items-center gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				if (value.trim()) onAnswer(value.trim());
			}}
		>
			<input
				type={prompt.type === "secret" ? "password" : "text"}
				value={value}
				placeholder={prompt.placeholder}
				aria-label={prompt.message}
				data-testid={`subscription-prompt-${status.id}`}
				onChange={(event) => setValue(event.target.value)}
				className="h-8 min-w-0 flex-1 rounded-md bg-card px-3 font-ui text-sm text-foreground outline-hidden ring-1 ring-line-2 placeholder:text-ink-4 transition-shadow focus:ring-2 focus:ring-teal"
			/>
			<Button type="submit" size="xs" disabled={!value.trim()}>
				Send
			</Button>
		</form>
	);
}

function SignInSteps({ status, act }: { status: SubscriptionStatus; act: ReturnType<typeof useSubscriptions>["act"] }) {
	const login = status.login;
	if (!login) return null;
	return (
		<div
			className="flex flex-col gap-2 rounded-xl border border-border/50 px-3.5 py-3 text-xs text-muted-foreground"
			data-testid={`subscription-login-${status.id}`}
		>
			{login.userCode ? (
				<p>
					Open the sign-in page and enter{" "}
					<span className="font-mono text-sm font-semibold tracking-wider text-foreground">{login.userCode}</span>
				</p>
			) : login.url ? (
				<p>Open the sign-in page and sign in, in a browser on the computer that runs Lanna.</p>
			) : (
				<p>{login.message ?? "Starting the sign-in…"}</p>
			)}
			{login.prompt?.type === "manual_code" ? (
				<p>If the page ends on an address that does not load, paste that address here.</p>
			) : (
				login.prompt && <p className="text-foreground">{login.prompt.message}</p>
			)}
			<PromptField status={status} onAnswer={(value) => void act("respond", status.id, value)} />
			<div className="flex items-center gap-3">
				{login.url && (
					<a
						href={login.url}
						target="_blank"
						rel="noreferrer"
						className="font-semibold text-teal underline-offset-2 hover:underline"
					>
						Open the sign-in page
					</a>
				)}
				<button
					type="button"
					className="cursor-pointer underline-offset-2 hover:underline"
					onClick={() => void act("cancel", status.id)}
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

export function SubscriptionsSection() {
	const { statuses, unavailable, act } = useSubscriptions();
	const [error, setError] = useState<string | null>(null);
	const run = (op: "start" | "sign-out", id: SubscriptionId) => {
		setError(null);
		act(op, id).catch((e: unknown) => setError(e instanceof Error && e.message ? e.message : "That did not work."));
	};
	if (unavailable) return <p className="text-xs text-muted-foreground">{unavailable}</p>;
	return (
		<div className="flex flex-col gap-2" data-testid="subscriptions">
			{statuses.map((status) => (
				<div key={status.id} className="flex flex-col gap-2">
					<ConnectionRow
						label={status.label}
						testid={`subscription-${status.id}`}
						action={status.connected ? "Sign out" : "Connect"}
						disabled={Boolean(status.login)}
						onAction={() => run(status.connected ? "sign-out" : "start", status.id)}
					>
						<span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
							{status.connected ? (status.account ?? "Signed in") : ""}
						</span>
					</ConnectionRow>
					<SignInSteps status={status} act={act} />
					{status.error && (
						<p role="alert" className="text-xs text-red-400">
							{status.error}
						</p>
					)}
				</div>
			))}
			{error && (
				<p role="alert" className="text-xs text-red-400">
					{error}
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				What you send goes to the company you sign in with, under your plan&apos;s limits. The sign-in stays on the
				computer that runs Lanna.
			</p>
		</div>
	);
}
