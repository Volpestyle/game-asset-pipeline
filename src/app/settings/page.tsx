import { Header } from "@/components/layout";
import { OutputConfig } from "@/components/dashboard";

export default function SettingsPage() {
  return (
    <div className="min-h-screen grid-bg">
      <Header
        breadcrumb={[
          { label: "Dashboard", href: "/" },
          { label: "Settings" },
        ]}
      />

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 tech-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground tracking-wider">
                  Pipeline Settings
                </span>
                <span className="text-xs text-muted-foreground">Project</span>
              </div>
              <div className="p-4 text-xs text-muted-foreground leading-relaxed">
                Manage default canvas sizing and normalization behavior for exports.
                Character-level overrides remain available inside each character profile.
              </div>
            </div>
            <OutputConfig />
          </div>

          <div className="tech-border bg-card p-4 text-xs text-muted-foreground">
            Additional pipeline controls will appear here as they are added.
          </div>
        </div>
      </main>
    </div>
  );
}
