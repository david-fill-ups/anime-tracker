"use client";

import { useState } from "react";

type DataPoint = { year: number; score: number; title: string };

const PAD = { top: 10, right: 20, bottom: 30, left: 32 };
const W = 560;
const H = 180;

export function ScoreByYearScatter({ data }: { data: DataPoint[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; score: number } | null>(null);

  if (data.length === 0) {
    return <p className="text-slate-500 text-sm">Rate more anime to see this chart.</p>;
  }

  const years = data.map((d) => d.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearRange = maxYear === minYear ? 1 : maxYear - minYear;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xOf = (year: number) => PAD.left + ((year - minYear) / yearRange) * plotW;
  // score 1–5, y=top is high score
  const yOf = (score: number) => PAD.top + ((5 - score) / 4) * plotH;

  // ~5 evenly spaced year labels
  const yearLabels: number[] = [];
  const steps = Math.min(5, maxYear - minYear + 1);
  for (let i = 0; i < steps; i++) {
    yearLabels.push(Math.round(minYear + (i / Math.max(steps - 1, 1)) * yearRange));
  }

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 320 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y axis labels (1–5) */}
        {[1, 2, 3, 4, 5].map((s) => (
          <text
            key={s}
            x={PAD.left - 6}
            y={yOf(s) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#64748b"
          >
            {s}
          </text>
        ))}

        {/* Y axis gridlines */}
        {[1, 2, 3, 4, 5].map((s) => (
          <line
            key={s}
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={yOf(s)}
            y2={yOf(s)}
            stroke="#1e293b"
            strokeWidth={1}
          />
        ))}

        {/* X axis labels */}
        {yearLabels.map((yr) => (
          <text
            key={yr}
            x={xOf(yr)}
            y={H - 6}
            textAnchor="middle"
            fontSize={10}
            fill="#64748b"
          >
            {yr}
          </text>
        ))}

        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xOf(d.year)}
            cy={yOf(d.score)}
            r={4}
            fill="#facc15"
            fillOpacity={0.7}
            className="cursor-pointer"
            onMouseEnter={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              const svgX = xOf(d.year);
              const svgY = yOf(d.score);
              const scaleX = rect.width / W;
              const scaleY = rect.height / H;
              setTooltip({
                x: svgX * scaleX,
                y: svgY * scaleY,
                title: d.title,
                score: d.score,
              });
            }}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 shadow-lg max-w-[200px]"
          style={{
            left: tooltip.x + 8,
            top: tooltip.y - 36,
          }}
        >
          <p className="font-medium leading-tight">{tooltip.title}</p>
          <p className="text-slate-400 mt-0.5">★ {tooltip.score} / 5</p>
        </div>
      )}
    </div>
  );
}
