"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

export interface RankedBarDatum {
  label: string;
  value: number;
  sublabel?: string;
}

// Single sequential hue (accent blue) — this is magnitude/ranking of named items,
// not multi-series identity, so one hue is correct: no categorical assignment needed.
const BAR_FILL = "#3b82f6";
// Neutral gray-based (not white-based) so these read correctly on both a dark
// and a light chart surface without needing to thread theme state into recharts.
const GRID_COLOR = "rgba(128,128,128,0.18)";
const AXIS_COLOR = "#6b6b70";
const CURSOR_FILL = "rgba(128,128,128,0.10)";

const ChartTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as RankedBarDatum;
  return (
    <div className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-ink-primary">{d.label}</p>
      {d.sublabel && <p className="text-ink-muted">{d.sublabel}</p>}
      <p className="text-accent-text font-medium mt-0.5">{d.value.toLocaleString()}</p>
    </div>
  );
};

export const RankedBarChart: React.FC<{ data: RankedBarDatum[]; height?: number }> = ({ data, height }) => {
  const rowHeight = 34;
  const chartHeight = height ?? Math.max(data.length * rowHeight, 120);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tickLine={false}
          axisLine={false}
          tick={{ fill: AXIS_COLOR, fontSize: 12 }}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: CURSOR_FILL }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={BAR_FILL} maxBarSize={18}>
          {data.map((_, i) => <Cell key={i} />)}
          <LabelList dataKey="value" position="right" fill={AXIS_COLOR} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
