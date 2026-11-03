import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Script from "next/script";
import { Geist, JetBrains_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell, SidebarProvider } from "@/components/sidebar";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-cookie";
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
const geist = Geist({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-geist" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-jetbrains" });

// The theme is Day or Night, from the learner's choice (localStorage
// "lh:theme": day, night, or absent = follow the system). The script runs
// before paint so a Night learner never sees a Day flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("lh:theme");var n=t==="night"||(t!=="day"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",n);document.documentElement.dataset.theme=n?"night":"day";document.documentElement.style.colorScheme=n?"dark":"light"}catch(e){}`;

// Full-bleed on a notched phone or an iPad: the shell pads for the safe areas
// (components/sidebar.tsx, components/phone-nav.tsx), and the theme color
// paints the status bar. viewport-fit=cover is what lets the page run under it.
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#101214" },
	],
	colorScheme: "light dark",
};

export const metadata: Metadata = {
	title: "LangHarness",
		applicationName: "LangHarness",
		appleWebApp: { capable: true, title: "LangHarness", statusBarStyle: "default" },
			// Next 16 emits the standard mobile-web-app-capable tag for capable: true;
			// iOS Safari still reads the Apple name to launch full screen, so both go out.
			other: { "apple-mobile-web-app-capable": "yes" },
	description: "A Slovak and Russian tutor with a memory: sessions, practice, spaced review, and a knowledge graph of what you know.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const sidebarOpen = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
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
		<html lang="en" className={`${geist.variable} ${mono.variable}`} style={vars as React.CSSProperties} suppressHydrationWarning>
			<body className="min-h-dvh antialiased">
			{/* The notification channel rides OUTSIDE everything: sidebar, dock,
				 and pages all subscribe as the polls retire (push S3, 2026-10-02). */}
			<Script id="lh-theme" strategy="beforeInteractive">{THEME_SCRIPT}</Script>
				<ServerEventsProvider>
				<AppearanceProvider initialDelta={appearance}>
					<SidebarProvider initialOpen={sidebarOpen}>
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
