import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from "recharts";
import { formatBRL } from "@/lib/sales-utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SalesLineChartProps {
  data: { date: string; totalLiquido: number }[];
}

export function SalesLineChart({ data }: SalesLineChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    formattedDate: format(new Date(item.date), "dd/MM", { locale: ptBR }),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={formattedData}
        margin={{
          top: 5,
          right: 20,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="formattedDate"
          tickFormatter={(value) => value}
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
          labelFormatter={(label: string) => `Data: ${label}`}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
          itemStyle={{ color: "hsl(var(--fiorenzza-primary))" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="totalLiquido"
          name="Vendas Líquidas"
          stroke="hsl(var(--fiorenzza-primary))"
          activeDot={{ r: 8 }}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}