import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomNav } from "@/components/SiteNav";
import { LEAGUE_NAME } from "@/lib/config";
import { hasBracket } from "@/lib/playoff";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${LEAGUE_NAME} · College Football`,
  description: "Weekly college football picks against the spread.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: LEAGUE_NAME },
};

export const viewport: Viewport = {
  themeColor: "#06070b",
  width: "device-width",
  initialScale: 1,
  // Lets the layout run under the notch / home indicator on iPhone.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // One row check, so the bracket tab appears the moment a field is seeded.
  const bracket = await hasBracket().catch(() => false);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* Bottom padding clears the fixed mobile tab bar. */}
      <body className="min-h-full flex flex-col pb-[calc(3.4rem+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
        <BottomNav bracket={bracket} />
      </body>
    </html>
  );
}
