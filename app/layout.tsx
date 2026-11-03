import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, themeFromCookie } from "@/lib/theme";
import { Geist, JetBrains_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell, SidebarProvider } from "@/components/sidebar";
import { appearanceVars, resolveAppearance } from "@/lib/appearance-vars";
import { readSettingsRecord } from "@/src/server";
import type { AppearanceSettings } from "@/src/core";
import { ActivityProvider } from "@/components/activity-dock";
import { ServerEventsProvider } from "@/components/server-events";
import { AppearanceProvider } from "@/components/settings/appearance";
import UpdateBanner from "@/components/update-banner";
import { ThemeSync } from "@/components/quiet/theme-sync";
import { KeyboardFocusMode } from "@/components/keyboard-focus-mode";
import { OutboxFlush } from "@/components/lesson/outbox-flush";

// Quiet tool (2026-11-02): one family, Geist, for the chrome and the prose;
// JetBrains Mono stays for code. latin-ext carries Slovak (ľ ĺ ŕ ť ď ô ä),
// cyrillic carries Russian.
// Geist is preloaded and the fallback is size-matched, so a late font swaps in without moving the text. (display: optional was tried: the dev server does not preload fonts, so it left whole page views in the fallback face, and next/font accepts only literal option values, so it cannot be limited to production.)
const geist = Geist({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-geist", display: "swap" });
// Code only: not preloaded, so it never competes with Geist for the first paint.
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-jetbrains", preload: false });

// Full-bleed on a notched phone or an iPad: the shell pads for the safe areas
// (components/sidebar.tsx, components/phone-nav.tsx), and the theme color
// paints the status bar. viewport-fit=cover is what lets the page run under it.
export async function generateViewport(): Promise<Viewport> {
	// An explicit Day or Night paints the status bar in that mode whatever the system is set to; "system" lets the system decide.
	const theme = themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
	const themeColor = theme === "day" ? "#ffffff" : theme === "night" ? "#101214" : [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#101214" }];
	return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor, colorScheme: theme === "system" ? "light dark" : theme === "night" ? "dark" : "light" };
}

export const metadata: Metadata = {
	title: { default: "LangHarness", template: "%s · LangHarness" },
		applicationName: "LangHarness",
		appleWebApp: { capable: true, title: "LangHarness", statusBarStyle: "default" },
			// Next 16 emits the standard mobile-web-app-capable tag for capable: true;
			// iOS Safari still reads the Apple name to launch full screen, so both go out.
			other: { "apple-mobile-web-app-capable": "yes" },
	description: "A Slovak and Russian tutor with a memory: sessions, practice, spaced review, and a knowledge graph of what you know.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	// The saved theme goes into the first HTML, so a Night learner never sees a Day frame (or the reverse) while the scripts load.
	const theme = themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
	// Saved appearance goes into the first HTML (no flash of the factory
	// palette or font before the client provider would have applied it).
	let appearance: AppearanceSettings | undefined;
	try {
		const a = readSettingsRecord()?.appearance;
		appearance = a && typeof a === "object" ? (a as AppearanceSettings) : undefined;
	} catch {
		appearance = undefined;
	}
	const vars = appearanceVars(resolveAppearance(appearance));
	return (
		<html lang="en" className={`${geist.variable} ${mono.variable}${theme === "night" ? " dark" : ""}`} data-theme={theme === "system" ? undefined : theme} style={vars as React.CSSProperties} suppressHydrationWarning>
			<body className="min-h-dvh antialiased">
			{/* The notification channel rides OUTSIDE everything: sidebar, dock,
				 and pages all subscribe as the polls retire (push S3, 2026-10-02). */}
							<ServerEventsProvider>
				<AppearanceProvider initialDelta={appearance}>
					<SidebarProvider>
						<ActivityProvider>
							<AppShell>{children}</AppShell>
						</ActivityProvider>
					</SidebarProvider>
				</AppearanceProvider>
			</ServerEventsProvider>
			<ThemeSync />
				<KeyboardFocusMode />
			{/* Lessons finished but not yet recorded are sent again (components/lesson/outbox.ts). */}
			<OutboxFlush />
			{/* Auto-update banner (Wave C): fixed card, Electron-only pushes. */}
			<UpdateBanner />
		</body>
		</html>
	);
}
