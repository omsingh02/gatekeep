import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteDescription =
  "Open-source, self-hosted file sharing. Short links, a password per recipient, expiry and download limits, in-browser previews and a full audit log.";

// Absolute base for OG/Twitter image URLs; tolerate a value without a protocol
const appUrl = (() => {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return "http://localhost:3000";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
})();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Gatekeep — Share files with exactly the people you choose",
  description: siteDescription,
  applicationName: "Gatekeep",
  authors: [{ name: "Om Singh" }],
  openGraph: {
    type: "website",
    siteName: "Gatekeep",
    title: "Gatekeep — Share files with exactly the people you choose",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Gatekeep — Share files with exactly the people you choose",
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  themeColor: "#07080c",
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
