import Link from "next/link";
import { Button } from "@/components/ui/button";
import { User } from "iconoir-react";
import { Header } from "@/components/layout/Header";
import { getCharacters } from "@/lib/characters";

export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const characters = await getCharacters();

  return (
    <div className="min-h-screen grid-bg">
      <Header backHref="/">
        <Link href="/characters">
          <Button
            variant="outline"
            className="h-7 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
          >
            REFRESH
          </Button>
        </Link>
        <Link href="/characters/new">
          <Button className="bg-primary hover:bg-primary/80 text-primary-foreground h-7 px-3 text-[10px] tracking-wider">
            NEW CHARACTER
          </Button>
        </Link>
      </Header>

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground tracking-wider">Character Registry</span>
                <span className="text-xs text-muted-foreground">
                  {characters.length} entries
                </span>
              </div>
              <div className="p-4 text-xs text-muted-foreground leading-relaxed">
                Manage reference sets and identity profiles. Select any entry to build animations or update references.
              </div>
            </div>
            <div className="col-span-4 tech-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground tracking-wider">Status</span>
                <div className="flex items-center gap-2">
                  <div className="status-dot status-dot-online" />
                  <span className="text-xs text-success">
                    Ready
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="metric-value">{characters.length}</span>
                </div>
              </div>
            </div>
          </div>

          {characters.length === 0 ? (
            <div className="tech-border corner-brackets bg-card p-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto border border-border flex items-center justify-center">
                <User className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-medium">No characters yet</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Upload reference images to start a new character profile.
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
              {characters.map((character) => (
                <div key={character.id} className="tech-border bg-card p-4 hover-highlight">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-muted-foreground tracking-wider">Character</div>
                    <span className="text-[10px] text-muted-foreground">
                      {character.referenceImages.length} refs
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border border-border flex items-center justify-center bg-secondary">
                      <User className="w-5 h-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{character.name}</p>
                      <p className="text-[10px] text-muted-foreground tracking-wider capitalize">
                        {character.style.replace("-", " ")}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>ID</span>
                    <span className="text-primary">{character.id.slice(0, 8)}</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <Link href={`/animations/new?characterId=${character.id}`} className="flex-1">
                        <Button
                          variant="outline"
                          className="w-full h-8 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
                        >
                          CREATE ANIMATION
                        </Button>
                      </Link>
                      <Link href={`/characters/${character.id}`}>
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-[10px] tracking-wider border-border hover:border-primary hover:text-primary"
                        >
                          EDIT
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
