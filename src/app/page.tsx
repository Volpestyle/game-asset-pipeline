import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Mark */}
            <div className="w-8 h-8 rounded bg-gradient-to-br from-gold to-gold-muted flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-semibold text-lg tracking-tight">Sprite Forge</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/characters" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Characters
            </Link>
            <Link href="/animations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Animations
            </Link>
            <div className="w-px h-5 bg-border" />
            <Button size="sm" className="bg-gold hover:bg-gold/90 text-primary-foreground">
              New Project
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text Content */}
            <div className="space-y-8 stagger-children">
              <div className="space-y-4">
                <p className="text-gold font-mono text-sm tracking-widest uppercase">
                  AI Animation Pipeline
                </p>
                <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
                  Forge sprites that
                  <br />
                  <span className="text-gold">move</span>
                </h1>
              </div>

              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                Upload your character concepts. Describe the motion.
                Watch AI generate consistent, game-ready animation frames.
              </p>

              <div className="flex items-center gap-4 pt-4">
                <Link href="/characters/new">
                  <Button size="lg" className="bg-gold hover:bg-gold/90 text-primary-foreground px-8 h-12">
                    Start Creating
                  </Button>
                </Link>
                <Link href="#workflow">
                  <Button variant="outline" size="lg" className="h-12 border-border hover:bg-secondary">
                    See How It Works
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 pt-8 border-t border-border">
                <div>
                  <p className="text-2xl font-bold text-gold">8-32</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Frames per animation</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div>
                  <p className="text-2xl font-bold">AI</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Powered generation</p>
                </div>
                <div className="w-px h-10 bg-border" />
                <div>
                  <p className="text-2xl font-bold">100%</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Character consistency</p>
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="relative">
              {/* Decorative frame */}
              <div className="absolute -inset-4 rounded-2xl border border-gold/20 glow-gold-subtle" />

              {/* Main visual container */}
              <div className="relative rounded-xl overflow-hidden bg-card border border-border">
                {/* Simulated animation preview */}
                <div className="aspect-[4/3] bg-gradient-to-br from-secondary to-card flex items-center justify-center">
                  {/* Frame strip visualization */}
                  <div className="flex gap-2 p-8">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="w-16 h-20 rounded bg-muted border border-border flex items-center justify-center"
                        style={{
                          animationDelay: `${i * 100}ms`,
                          opacity: 0.4 + (i * 0.1)
                        }}
                      >
                        <div className="w-8 h-10 rounded-sm bg-gold/20 border border-gold/30" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="px-4 py-3 border-t border-border bg-secondary/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-muted-foreground font-mono">walk_cycle.anim</span>
                  </div>
                  <span className="text-xs text-gold font-mono">6 frames @ 12fps</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-24 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <p className="text-gold font-mono text-sm tracking-widest uppercase">Workflow</p>
            <h2 className="text-3xl lg:text-4xl font-bold">From concept to animation</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-6 stagger-children">
            {/* Step 1 */}
            <div className="group p-6 rounded-xl bg-card border border-border hover:border-gold/30 transition-all duration-300 hover:glow-gold-subtle">
              <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                <span className="text-gold font-mono font-bold">01</span>
              </div>
              <h3 className="font-semibold mb-2">Upload References</h3>
              <p className="text-sm text-muted-foreground">
                Drop in your character concept art. Multiple angles work best.
              </p>
            </div>

            {/* Step 2 */}
            <div className="group p-6 rounded-xl bg-card border border-border hover:border-gold/30 transition-all duration-300 hover:glow-gold-subtle">
              <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                <span className="text-gold font-mono font-bold">02</span>
              </div>
              <h3 className="font-semibold mb-2">Create Identity</h3>
              <p className="text-sm text-muted-foreground">
                AI extracts your character&apos;s visual DNA for consistent generation.
              </p>
            </div>

            {/* Step 3 */}
            <div className="group p-6 rounded-xl bg-card border border-border hover:border-gold/30 transition-all duration-300 hover:glow-gold-subtle">
              <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                <span className="text-gold font-mono font-bold">03</span>
              </div>
              <h3 className="font-semibold mb-2">Define Animation</h3>
              <p className="text-sm text-muted-foreground">
                Describe the motion. Set keyframes. Choose frame count and timing.
              </p>
            </div>

            {/* Step 4 */}
            <div className="group p-6 rounded-xl bg-card border border-border hover:border-gold/30 transition-all duration-300 hover:glow-gold-subtle">
              <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-4 group-hover:bg-gold/20 transition-colors">
                <span className="text-gold font-mono font-bold">04</span>
              </div>
              <h3 className="font-semibold mb-2">Generate & Export</h3>
              <p className="text-sm text-muted-foreground">
                AI fills the frames. Export as spritesheet, WebP, or individual PNGs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl lg:text-4xl font-bold">
            Ready to bring your characters to life?
          </h2>
          <p className="text-lg text-muted-foreground">
            Start with a single character reference. See what&apos;s possible.
          </p>
          <Link href="/characters/new">
            <Button size="lg" className="bg-gold hover:bg-gold/90 text-primary-foreground px-12 h-14 text-lg animate-pulse-gold">
              Create Your First Animation
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 rounded bg-gold/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-gold" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm">Sprite Forge</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI-powered animation for game developers
          </p>
        </div>
      </footer>
    </div>
  );
}
