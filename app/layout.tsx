import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteTitle = "Gatekeep — Secure file delivery with receipts";
const siteDescription =
  "Send files to named people, see who opened them and take access back at any time. Open-source, self-hosted file delivery with a receipt for everything.";
const socialDescription =
  "Send it. See who opened it. Take it back. Open-source, self-hosted file delivery for people who send files that matter.";

// Absolute base for OG/Twitter image URLs; tolerate a value without a protocol
const appUrl = (() => {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return "http://localhost:3000";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
})();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "Gatekeep",
  authors: [{ name: "Om Singh" }],
  openGraph: {
    type: "website",
    siteName: "Gatekeep",
    title: siteTitle,
    description: socialDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: socialDescription,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
