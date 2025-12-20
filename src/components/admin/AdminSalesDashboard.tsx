import { useState, useMemo } from "react";
import { Calendar as CalendarIcon, BarChart3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatsBadge } from "@/components/sales/StatsBadge";
import { Sale, StatusFilter, Seller } from "@/types/sales";
import {
  formatBRL,
  filterSales,
  calculateTotals,
  calculateVendorReport,
  loadSellers,
  aggregateSalesByDate,
} from "@/lib/sales-utils";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { SalesLineChart } from "./SalesLineChart";
import { SalesBarChart } from "./SalesBarChart";

interface AdminSalesDashboardProps {
  sales: Sale[];
  onDeleteCancelledSale?: (id: string) => Promise<boolean>;
}

export function AdminSalesDashboard({ sales, onDeleteCancelledSale }: AdminSalesDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODAS"); // Alterado para "TODAS"
  const [vendorFilter, setVendorFilter] = useState<string>("TODOS");

  const sellers = useMemo(() => loadSellers(), []);

  const filteredSales = useMemo(() => {
    const fromDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
    const toDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "";

    return filterSales(
      sales,
      statusFilter,
      "CUSTOM", // Always use custom period for calendar selection
      fromDate,
      toDate,
      "", // No search query in this dashboard
      vendorFilter // Apply vendor filter
    );
  }, [sales, dateRange, statusFilter, vendorFilter]);

  const totals = useMemo(() => calculateTotals(filteredSales), [filteredSales]);
  const vendorReport = useMemo(() => calculateVendorReport(filteredSales), [filteredSales]);
  const dailySalesData = useMemo(() => aggregateSalesByDate(filteredSales, "day"), [filteredSales]); // Dados para o gráfico de linha

  const handlePresetDateRange = (preset: string) => {
    const today = new Date();
    let from: Date | undefined;
    let to: Date | undefined;

    switch (preset) {
      case "today":
        from = startOfDay(today);
        to = endOfDay(today);
        break;
      case "last7days":
        from = startOfDay(subDays(today, 6));
        to = endOfDay(today);
        break;
      case "last30days":
        from = startOfDay(subDays(today, 29));
        to = endOfDay(today);
        break;
      case "thisMonth":
        from = startOfMonth(today);
        to = endOfDay(today);
        break;
      case "lastMonth":
        from = startOfMonth(subMonths(today, 1));
        to = endOfMonth(subMonths(today, 1));
        break;
      case "thisYear":
        from = startOfYear(today);
        to = endOfDay(today);
        break;
      case "lastYear":
        from = startOfYear(subYears(today, 1));
        to = endOfYear(subYears(today, 1));
        break;
      default:
        from = undefined;
        to = undefined;
    }
    setDateRange({ from, to });
  };

  const displayDateRange = dateRange?.from
    ? `${format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${
        dateRange.to ? format(dateRange.to, "dd/MM/yyyy", { locale: ptBR }) : "..."
      }`
    : "Selecione um período";

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Dashboard de Vendas
          </CardTitle>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatsBadge label="Período" value={displayDateRange} />
          <StatsBadge
            label="Líquido"
            value={formatBRL(totals.liquidoAtivas)}
            variant="success"
          />
          <StatsBadge
            label="Desconto"
            value={formatBRL(totals.descAtivas)}
            variant="muted"
          />
          <StatsBadge label="Itens" value={totals.itensAtivas} />
          <StatsBadge
            label="% Canceladas"
            value={`${totals.pctCancel.toFixed(1)}%`}
            variant={totals.pctCancel > 10 ? "warning" : "muted"}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateRange?.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {displayDateRange}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-col sm:flex-row">
                <div className="flex flex-col p-4 border-b sm:border-b-0 sm:border-r">
                  <Button variant="ghost" onClick={() => handlePresetDateRange("today")}>Hoje</Button>
                  <Button variant="ghost" onClick={() => handlePresetDateRange("last7days")}>Últimos 7 dias</Button>
                  <Button variant="ghost" onClick={() => handlePresetDateRange("last30days")}>Últimos 30 dias</Button>
                  <Button variant="ghost" onClick={() => handlePresetDateRange("thisMonth")}>Este Mês</Button>
                  <Button variant="ghost" onClick={() => handlePresetDateRange("lastMonth")}>Mês Passado</Button>
                  <Button variant="ghost" onClick={() => handlePresetDateRange("thisYear")}>Este Ano</Button>
                  <Button variant="ghost" onClick={() => handlePresetDateRange("lastYear")}>Ano Passado</Button>
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="ATIVAS">Somente ativas</SelectItem>
              <SelectItem value="CANCELADAS">Somente canceladas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os Vendedores</SelectItem>
              {sellers.map((seller) => (
                <SelectItem key={seller.id} value={seller.name}>
                  {seller.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-none border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Vendas Diárias (Líquido)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] p-0">
              <SalesLineChart data={dailySalesData} />
            </CardContent>
          </Card>

          <Card className="shadow-none border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Vendas por Vendedor (Líquido)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] p-0">
              <SalesBarChart data={vendorReport} />
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">% Cancel.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorReport.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Sem vendas ativas no filtro selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                vendorReport.map((r) => (
                  <TableRow key={r.vendedor}>
                    <TableCell className="font-bold">{r.vendedor}</TableCell>
                    <TableCell className="text-right">{r.vendas}</TableCell>
                    <TableCell className="text-right">{r.itens}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatBRL(r.bruto)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatBRL(r.desconto)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-bold text-primary">
                      {formatBRL(r.liquido)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatBRL(r.pago)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatBRL(r.diferenca)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          r.pctCancel > 10
                            ? "text-destructive font-medium"
                            : ""
                        }
                      >
                        {r.pctCancel.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Nota: Valores consideram apenas vendas <strong>ATIVAS</strong>.
          Canceladas entram apenas na % de cancelamento.
        </p>

        {/* Seção de Vendas Canceladas */}
        {onDeleteCancelledSale && (
          <CancelledSalesSection 
            sales={filteredSales.filter(s => s.status === "CANCELADA")} 
            onDelete={onDeleteCancelledSale} 
          />
        )}
      </CardContent>
    </Card>
  );
}

interface CancelledSalesSectionProps {
  sales: Sale[];
  onDelete: (id: string) => Promise<boolean>;
}

function CancelledSalesSection({ sales, onDelete }: CancelledSalesSectionProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (sales.length === 0) return null;

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <Trash2 className="h-4 w-4 text-destructive" />
        Vendas Canceladas ({sales.length})
      </h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>{sale.vendedor}</TableCell>
                <TableCell className="max-w-[200px] truncate">{sale.productName || "-"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatBRL(sale.totalLiquido)}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {sale.cancelMotivo || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === sale.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir venda permanentemente?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A venda será removida permanentemente do sistema.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(sale.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}