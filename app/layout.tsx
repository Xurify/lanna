import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Bricolage_Grotesque, JetBrains_Mono, Source_Sans_3 } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./press.css";
import { AppShell, SidebarProvider } from "@/components/sidebar";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-cookie";
import { appearanceVars, resolveAppearance } from "@/lib/appearance-vars";
import { readSettingsRecord } from "@/src/server";
import type { AppearanceSettings } from "@/src/core";
import { ActivityProvider } from "@/components/activity-dock";
import { ServerEventsProvider } from "@/components/server-events";
import { AppearanceProvider } from "@/components/settings/appearance";
import UpdateBanner from "@/components/update-banner";
import { KeyboardFocusMode } from "@/components/keyboard-focus-mode";
import { OutboxFlush } from "@/components/lesson/outbox-flush";

// Chrome = JetBrains Mono, teaching prose = Source Sans 3, titles = CMU
// Serif (the bundled lh-cmu @font-face in globals.css — no CDN).
// LangHarness: latin-ext carries Slovak (ľ ĺ ŕ ť ď ô ä), cyrillic carries Russian.
const ui = JetBrains_Mono({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-jetbrains" });
const prose = Source_Sans_3({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-sans3" });
// Trail design (2026-11-02): the chrome is Bricolage Grotesque, a grotesque
// with an optical-size axis, so 12 px labels get its text cut and the big
// numbers its display cut. latin-ext carries every Slovak letter; JetBrains
// Mono stays for code and key hints.
const chrome = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-bricolage", axes: ["opsz"] });

// Full-bleed on a notched phone or an iPad: the shell pads for the safe areas
// (components/sidebar.tsx, components/phone-nav.tsx), and the theme color
// paints the status bar. viewport-fit=cover is what lets the page run under it.
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#0f1519",
	colorScheme: "dark",
};

export const metadata: Metadata = {
	title: "LangHarness",
		applicationName: "LangHarness",
		appleWebApp: { capable: true, title: "LangHarness", statusBarStyle: "black-translucent" },
			// Next 16 emits the standard mobile-web-app-capable tag for capable: true;
			// iOS Safari still reads the Apple name to launch full screen, so both go out.
			other: { "apple-mobile-web-app-capable": "yes" },
	description: "A Slovak and Russian tutor with a memory: sessions, practice, spaced review, and a knowledge graph of what you know.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const sidebarOpen = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "0";
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
		<html lang="en" className={`dark ${ui.variable} ${prose.variable} ${chrome.variable}`} style={vars as React.CSSProperties}>
			<body className="min-h-dvh antialiased">
			{/* The notification channel rides OUTSIDE everything: sidebar, dock,
				 and pages all subscribe as the polls retire (push S3, 2026-10-02). */}
			<ServerEventsProvider>
				<AppearanceProvider initialDelta={appearance}>
					<SidebarProvider initialOpen={sidebarOpen}>
						<ActivityProvider>
							<AppShell>{children}</AppShell>
						</ActivityProvider>
					</SidebarProvider>
				</AppearanceProvider>
			</ServerEventsProvider>
			<KeyboardFocusMode />
			{/* Lessons finished but not yet recorded are sent again (components/lesson/outbox.ts). */}
			<OutboxFlush />
			{/* Auto-update banner (Wave C): fixed card, Electron-only pushes. */}
			<UpdateBanner />
		</body>
		</html>
	);
}
