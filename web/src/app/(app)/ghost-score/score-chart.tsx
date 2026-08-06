'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { GhostScorePoint } from '@/lib/ghost-score';

const CYAN = 'rgb(0 229 255)';

export function ScoreChart({ series }: { series: GhostScorePoint[] }) {
  const data = series.map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="ghostScoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CYAN} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(255 255 255 / 0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgb(255 255 255 / 0.4)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            stroke="rgb(255 255 255 / 0.4)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: 'rgb(10 14 20)',
              border: '1px solid rgb(255 255 255 / 0.1)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'rgb(255 255 255 / 0.6)' }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={CYAN}
            strokeWidth={2}
            fill="url(#ghostScoreFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
