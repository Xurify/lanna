import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/login-form";
import { DEVICE_COOKIE, isPairedToken, safeNext } from "@/src/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Sign in",
	robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
	const { next } = await searchParams;
	const target = safeNext(typeof next === "string" ? next : null);
	if (isPairedToken((await cookies()).get(DEVICE_COOKIE)?.value ?? null)) redirect(target);
	return <LoginForm next={target} />;
}
