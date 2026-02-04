import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { User, Play } from "iconoir-react";
import { Header } from "@/components/layout/Header";
import { getCharacters } from "@/lib/characters";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const characters = await getCharacters();

  return (
    <div className="min-h-screen grid-bg">
      <Header
        breadcrumb={[
          { label: "Dashboard", href: "/" },
          { label: "Preview" },
        ]}
      />

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground tracking-wider">
                  STATE MACHINE PREVIEW
                </span>
                <span className="text-xs text-muted-foreground">
                  Select a character
                </span>
              </div>
              <div className="p-4 text-xs text-muted-foreground leading-relaxed">
                Build real game-style animation states with entry, loop, and exit
                clips. Configure key bindings and validate transitions in real time.
              </div>
            </div>
            <div className="col-span-4 tech-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground tracking-wider">
                  Status
                </span>
                <div className="flex items-center gap-2">
                  <div className="status-dot status-dot-online" />
                  <span className="text-xs text-success">Ready</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Characters</span>
                  <span className="metric-value">{characters.length}</span>
                </div>
              </div>
            </div>
          </div>

          {characters.length === 0 ? (
            <div className="tech-border corner-brackets bg-card p-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto border border-border flex items-center justify-center">
                <User
                  className="w-6 h-6 text-muted-foreground"
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p className="text-xs font-medium">No characters yet</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Create a character and animations first to use the preview.
                </p>
              </div>
              <Link href="/characters/new">
                <Button className="bg-primary hover:bg-primary/80 text-primary-foreground h-8 px-4 text-xs tracking-wider">
                  CREATE CHARACTER
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {characters.map((character) => {
                const primaryRef =
                  character.referenceImages.find((img) => img.isPrimary) ??
                  character.referenceImages[0];

                return (
                  <Link
                    key={character.id}
                    href={`/preview/${character.id}`}
                    className="block"
                  >
                    <div className="tech-border bg-card p-4 hover-highlight cursor-pointer transition-colors hover:border-primary/50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-muted-foreground tracking-wider">
                          Character
                        </div>
                        <Play className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 border border-border flex items-center justify-center bg-secondary overflow-hidden">
                          {primaryRef?.url ? (
                            <Image
                              src={primaryRef.url}
                              alt={character.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User
                              className="w-5 h-5 text-primary"
                              strokeWidth={1.5}
                            />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{character.name}</p>
                          <p className="text-[10px] text-muted-foreground tracking-wider capitalize">
                            {character.style.replace("-", " ")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Click to open preview</span>
                        <span className="text-primary">→</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
