import type { Metadata } from "next";
import "../lib/mac-chrome/styles/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mac Prototype",
  description: "A mac-style product prototype.",
  icons: {
    icon: "/mac-chrome-showcase.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
