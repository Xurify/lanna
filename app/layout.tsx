import type { Metadata } from "next";
import { cookies } from "next/headers";
import { JetBrains_Mono, Nunito, Source_Sans_3 } from "next/font/google";
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

// Chrome = JetBrains Mono, teaching prose = Source Sans 3, titles = CMU
// Serif (the bundled lh-cmu @font-face in globals.css — no CDN).
// LangHarness: latin-ext carries Slovak (ľ ĺ ŕ ť ď ô ä), cyrillic carries Russian.
const ui = JetBrains_Mono({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-jetbrains" });
const prose = Source_Sans_3({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-sans3" });
// LangHarness redesign: the chrome is a rounded, friendly sans (Nunito);
// JetBrains Mono stays for code, numbers in tables and key hints.
const chrome = Nunito({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-nunito" });

export const metadata: Metadata = {
	title: "LangHarness",
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
			{/* Auto-update banner (Wave C): fixed card, Electron-only pushes. */}
			<UpdateBanner />
		</body>
		</html>
	);
}
