import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-inter" });
const libreCaslonText = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-libre-caslon",
});
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "ClaimSense - Plum OPD Claim Adjudication",
  description: "AI-assisted OPD insurance claim adjudication tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full ${inter.variable} ${libreCaslonText.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        {/* Icon ligature font, loaded as a plain stylesheet — next/font targets text fonts, not icon fonts. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
