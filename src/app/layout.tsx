import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import { Sidebar, SidebarProvider, SidebarShell } from "@/components/layout";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-mono-display",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "SPRITE FORGE // Animation Pipeline v2.1",
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
        className={`${spaceMono.variable} font-sans antialiased`}
      >
        <div className="scanlines min-h-screen">
          <SidebarProvider>
            <Sidebar />
            <SidebarShell>
              {children}
            </SidebarShell>
          </SidebarProvider>
        </div>
      </body>
    </html>
  );
}
