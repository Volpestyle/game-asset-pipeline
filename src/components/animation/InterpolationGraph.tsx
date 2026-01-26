"use client";

import React from "react";
import type { EasingType } from "@/types";

interface InterpolationGraphProps {
  easing: EasingType;
  width?: number;
  height?: number;
  className?: string;
}

export function InterpolationGraph({
  easing,
  width = 120,
  height = 60,
  className = "",
}: InterpolationGraphProps) {
  // Define path based on easing
  const getPath = (e: EasingType, w: number, h: number) => {
    // Start at bottom-left (0, h), End at top-right (w, 0)
    // SVG coordinates: (0,0) is top-left.
    const start = `M 0 ${h}`;
    const end = `${w} 0`;

    switch (e) {
      case "linear":
        return `${start} L ${end}`;
      case "ease-in":
        // Control point near start-bottom
        return `${start} Q ${w * 0.4} ${h}, ${end}`;
      case "ease-out":
         // Control point near end-top
        return `${start} Q ${w * 0.6} 0, ${end}`;
      case "ease-in-out":
        // S-curve
        return `${start} C ${w * 0.4} ${h}, ${w * 0.6} 0, ${end}`;
      case "hold":
        // Flat until the very end
        return `${start} L ${w} ${h} L ${w} 0`;
      default:
        return `${start} L ${end}`;
    }
  };

  const path = getPath(easing, width, height);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Grid lines */}
        <line x1="0" y1="0" x2="0" y2={height} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="0" y1={height} x2={width} y2={height} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
        <line x1={width} y1="0" x2={width} y2={height} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
        <line x1="0" y1="0" x2={width} y2="0" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />

        {/* The curve */}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start/End points */}
        <circle cx="0" cy={height} r="3" className="fill-primary" />
        <circle cx={width} cy="0" r="3" className="fill-primary" />
      </svg>
    </div>
  );
}
