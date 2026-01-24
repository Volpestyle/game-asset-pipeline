import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sprite Pipeline",
  description: "AI-first 2D sprite pipeline demo"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-6xl px-6 py-10">
          <header className="flex items-center justify-between gap-6">
            <div>
              <div className="text-xl font-semibold">Sprite Pipeline</div>
              <div className="text-sm text-zinc-400">AI-first top-down character pipeline</div>
            </div>
            <nav className="flex items-center gap-3 text-sm">
              <a className="rounded-md px-3 py-2 hover:bg-zinc-900" href="/">Jobs</a>
              <a className="rounded-md px-3 py-2 hover:bg-zinc-900" href="/new">New job</a>
            </nav>
          </header>

          <main className="mt-8">{children}</main>

          <footer className="mt-14 border-t border-zinc-900 pt-6 text-xs text-zinc-500">
            Built for a flexible character asset pipeline (fal.ai / Replicate / Mock providers).
          </footer>
        </div>
      </body>
    </html>
  );
}
