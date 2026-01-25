"use client";

interface TimelineRulerProps {
  frameCount: number;
  frameWidth: number;
  minFrameWidth: number;
}

export function TimelineRuler({
  frameCount,
  frameWidth,
  minFrameWidth,
}: TimelineRulerProps) {
  return (
    <div className="px-4 py-1 border-b border-border overflow-x-auto">
      <div className="flex" style={{ minWidth: frameCount * minFrameWidth }}>
        {Array.from({ length: frameCount }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 text-center text-[9px] text-muted-foreground"
            style={{ width: frameWidth }}
          >
            {i % 5 === 0 ? i : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
