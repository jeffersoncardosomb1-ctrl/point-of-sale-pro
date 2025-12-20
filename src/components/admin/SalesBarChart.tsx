import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";
import { formatBRL } from "@/lib/sales-utils";
import { VendorReport } from "@/types/sales";

interface SalesBarChartProps {
  data: VendorReport[];
}

export function SalesBarChart({ data }: SalesBarChartProps) {
  // Sort data by liquido in descending order for better visualization
  const sortedData = [...data].sort((a, b) => b.liquido - a.liquido);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={sortedData}
        margin={{
          top: 5,
          right: 20,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="vendedor"
          angle={-45}
          textAnchor="end"
          height={60}
          stroke="hsl(var(--muted-foreground))"
          tick={{ fontSize: 10 }}
        />
        <YAxis
          tickFormatter={(value) => formatBRL(value)}
          stroke="hsl(var(--muted-foreground))"
          tick={{ fontSize: 10 }}
        />
        <Tooltip
          formatter={(value: number) => formatBRL(value)}
          labelFormatter={(label: string) => `Vendedor: ${label}`}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
          itemStyle={{ color: "hsl(var(--fiorenzza-primary))" }}
        />
        <Legend />
        <Bar dataKey="liquido" name="Vendas Líquidas" fill="hsl(var(--fiorenzza-primary))" />
      </BarChart>
    </ResponsiveContainer>
  );
}