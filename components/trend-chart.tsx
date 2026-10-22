"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrendPoint = { label: string; purchases: number; members: number };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[200px] w-full" role="img" aria-label="Weekly verified purchases and new members">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, left: -22, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="#efe8dc" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#746a5f" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#746a5f" }} />
          <Tooltip
            cursor={{ fill: "#f4efe6" }}
            contentStyle={{ borderRadius: 10, border: "1px solid #e6ded1", fontSize: 12 }}
            labelStyle={{ color: "#17130f", fontWeight: 600 }}
          />
          <Bar dataKey="purchases" name="Purchases" fill="#17553f" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="members" name="New members" fill="#b4653a" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
