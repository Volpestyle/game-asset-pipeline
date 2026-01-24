import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono-primary",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono-display",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "SPRITE_FORGE // Animation Pipeline v2.1",
  description: "Technical animation frame generation system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${ibmPlexMono.variable} ${spaceMono.variable} font-mono antialiased`}
      >
        <div className="scanlines min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
