import { Header } from "@/components/layout/Header";
import {
  QuickActions,
  StatsOverview,
  SystemStatus,
  CharactersPreview,
  RecentActivity,
  PipelineTools,
  OutputConfig,
  ExportTargets,
} from "@/components/dashboard";

export default function Home() {
  return (
    <div className="min-h-screen grid-bg">
      <Header />

      <main className="pt-14 pb-6 px-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Top Row: Quick Actions + Stats */}
          <div className="grid grid-cols-12 gap-4">
            <QuickActions />
            <StatsOverview />
            <SystemStatus />
          </div>

          {/* Middle Row: Characters + Recent Activity */}
          <div className="grid grid-cols-12 gap-4">
            <CharactersPreview />
            <RecentActivity />
          </div>

          {/* Bottom Row: Quick Tools + Output Config */}
          <div className="grid grid-cols-12 gap-4">
            <PipelineTools />
            <OutputConfig />
            <ExportTargets />
          </div>
        </div>
      </main>
    </div>
  );
}
