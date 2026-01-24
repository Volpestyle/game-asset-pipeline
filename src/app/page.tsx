import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MediaImage, Folder } from "iconoir-react";

export default function Home() {
  return (
    <div className="min-h-screen grid-bg">
      {/* Top Status Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="h-10 px-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-primary crt-glow">[SPRITE FORGE]</span>
              <span className="text-muted-foreground">v2.1.0</span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <Link href="/characters" className="hover:text-primary transition-colors">
                characters
              </Link>
              <Link href="/animations" className="hover:text-primary transition-colors">
                animations
              </Link>
              <Link href="/export" className="hover:text-primary transition-colors">
                export
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="status-dot status-dot-online animate-pulse-terminal" />
              <span className="text-muted-foreground">SYS ONLINE</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <span className="text-muted-foreground data-readout">
              {new Date().toISOString().split("T")[0]}
            </span>
          </div>
        </div>
      </header>

      {/* Main Dashboard Area */}
      <main className="pt-16 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* System Header */}
          <section className="py-12 border-b border-border">
            <div className="grid lg:grid-cols-[1fr,auto] gap-12 items-start">
              {/* Left: System Info */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground tracking-widest">
                    ANIMATION PIPELINE SYSTEM
                  </p>
                  <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
                    <span className="text-primary crt-glow">SPRITE</span>
                    <span className="text-muted-foreground">_</span>
                    <span>FORGE</span>
                  </h1>
                </div>

                <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                  AI-driven frame generation system. Input character reference data,
                  define motion parameters, output game-ready animation sequences.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <Link href="/characters/new">
                    <Button className="bg-primary hover:bg-primary/80 text-primary-foreground h-9 px-4 text-xs tracking-wider">
                      [NEW CHARACTER]
                    </Button>
                  </Link>
                  <Link href="#specs">
                    <Button variant="outline" className="h-9 px-4 text-xs tracking-wider border-border hover:border-primary hover:text-primary">
                      [VIEW_SPECS]
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right: Quick Stats Panel */}
              <div className="tech-border corner-brackets bg-card p-4 min-w-[280px]">
                <div className="text-xs text-muted-foreground mb-3 tracking-widest">
                  SYSTEM METRICS
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">FRAME RANGE</span>
                    <span className="text-sm text-primary metric-value">8-32</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">ENGINE TYPE</span>
                    <span className="text-sm metric-value">AI GEN</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">CONSISTENCY</span>
                    <span className="text-sm text-success metric-value">100%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">STATUS</span>
                    <span className="text-sm text-success metric-value flex items-center gap-2">
                      <div className="status-dot status-dot-online" />
                      READY
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Animation Preview Panel */}
          <section className="py-8 border-b border-border">
            <div className="grid lg:grid-cols-[1fr,320px] gap-6">
              {/* Frame Visualizer */}
              <div className="tech-border bg-card">
                <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground tracking-wider">
                    FRAME BUFFER
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="status-dot status-dot-online" />
                    <span className="text-xs text-muted-foreground">LIVE</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-center gap-2 stagger-children">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div
                        key={i}
                        className="relative group"
                      >
                        <div
                          className="w-14 h-18 bg-secondary border border-border flex items-center justify-center transition-all duration-150 hover:border-primary hover:crt-glow-box"
                          style={{
                            opacity: 0.4 + (i * 0.08),
                          }}
                        >
                          <div className="w-6 h-8 border border-primary/30 bg-primary/10" />
                        </div>
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
                          {String(i).padStart(2, "0")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">walk_cycle.seq</span>
                  <span className="text-primary metric-value">8F @ 12FPS</span>
                </div>
              </div>

              {/* Output Config */}
              <div className="space-y-4">
                <div className="tech-border bg-card p-4">
                  <div className="text-xs text-muted-foreground mb-3 tracking-widest">
                    OUTPUT CONFIG
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">FORMAT</span>
                      <span>PNG_SEQ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RESOLUTION</span>
                      <span>128x128</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">COLOR DEPTH</span>
                      <span>32BIT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">COMPRESSION</span>
                      <span className="text-success">LOSSLESS</span>
                    </div>
                  </div>
                </div>

                <div className="tech-border bg-card p-4">
                  <div className="text-xs text-muted-foreground mb-3 tracking-widest">
                    EXPORT TARGETS
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <MediaImage className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                      <span>Spritesheet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                      <span>Individual Frames</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MediaImage className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                      <span>WebP Animation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MediaImage className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                      <span>GIF Preview</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Pipeline Steps */}
          <section id="specs" className="py-8">
            <div className="mb-6">
              <span className="text-xs text-muted-foreground tracking-widest">
                PIPELINE SEQUENCE
              </span>
            </div>

            <div className="grid md:grid-cols-4 gap-4 stagger-children">
              {/* Step 01 */}
              <div className="tech-border bg-card p-4 hover-highlight group">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-primary text-lg font-bold metric-value">01</span>
                  <div className="h-px flex-1 bg-border group-hover:bg-primary/30 transition-colors" />
                </div>
                <h3 className="text-sm font-medium mb-2">INPUT REF</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upload character reference images. Multiple viewing angles recommended for optimal extraction.
                </p>
              </div>

              {/* Step 02 */}
              <div className="tech-border bg-card p-4 hover-highlight group">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-primary text-lg font-bold metric-value">02</span>
                  <div className="h-px flex-1 bg-border group-hover:bg-primary/30 transition-colors" />
                </div>
                <h3 className="text-sm font-medium mb-2">EXTRACT ID</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  System extracts visual DNA from references. Character identity locked for consistent generation.
                </p>
              </div>

              {/* Step 03 */}
              <div className="tech-border bg-card p-4 hover-highlight group">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-primary text-lg font-bold metric-value">03</span>
                  <div className="h-px flex-1 bg-border group-hover:bg-primary/30 transition-colors" />
                </div>
                <h3 className="text-sm font-medium mb-2">DEFINE MOTION</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Specify animation parameters. Keyframes, timing, frame count. Text description supported.
                </p>
              </div>

              {/* Step 04 */}
              <div className="tech-border bg-card p-4 hover-highlight group">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-primary text-lg font-bold metric-value">04</span>
                  <div className="h-px flex-1 bg-border group-hover:bg-primary/30 transition-colors" />
                </div>
                <h3 className="text-sm font-medium mb-2">GENERATE OUT</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AI generates frames. Export as spritesheet, individual PNGs, or animated WebP format.
                </p>
              </div>
            </div>
          </section>

          {/* Quick Start Terminal */}
          <section className="py-8 border-t border-border">
            <div className="tech-border bg-card">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="status-dot status-dot-online animate-pulse-terminal" />
                  <span className="text-xs text-muted-foreground tracking-wider">QUICK START</span>
                </div>
                <span className="text-xs text-muted-foreground">session_01</span>
              </div>
              <div className="p-6 font-mono text-sm">
                <div className="space-y-2 text-muted-foreground">
                  <p><span className="text-primary">$</span> sprite forge --new-character</p>
                  <p className="text-xs pl-4">Loading character creation module...</p>
                  <p className="text-xs pl-4">Reference input: <span className="text-foreground">AWAITING</span></p>
                  <p className="text-xs pl-4">Style config: <span className="text-foreground">AWAITING</span></p>
                  <p className="text-xs pl-4 text-success">System ready for input.</p>
                </div>
                <div className="mt-6 flex items-center gap-4">
                  <Link href="/characters/new">
                    <Button className="bg-primary hover:bg-primary/80 text-primary-foreground h-8 px-4 text-xs tracking-wider">
                      [EXECUTE]
                    </Button>
                  </Link>
                  <span className="text-xs text-muted-foreground">or run: <span className="text-primary">sf new</span></span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-primary">[SF]</span>
            <span>SPRITE FORGE</span>
          </div>
          <div className="flex items-center gap-4">
            <span>AI Animation Pipeline</span>
            <span className="text-border">|</span>
            <span className="metric-value">v2.1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
