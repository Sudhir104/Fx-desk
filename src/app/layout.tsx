import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "FX Macro Desk", description: "Central-bank policy, Red Folder data surprises and wire news for the eight major currencies" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-page font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
