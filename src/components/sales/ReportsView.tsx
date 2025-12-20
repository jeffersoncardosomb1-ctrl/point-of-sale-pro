import { useState, useMemo } from "react";
import { Download, List, FileText } from "lucide-react";
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
import { SalesFilters } from "./SalesFilters";
import { StatsBadge } from "./StatsBadge";
import { Sale, StatusFilter, PeriodFilter } from "@/types/sales";
import {
  formatBRL,
  toLocalDateInputValue,
  filterSales,
  calculateTotals,
  calculateVendorReport,
  exportSalesToExcel,
} from "@/lib/sales-utils";
import { generateSalesReportPDF } from "@/lib/pdf-generator";
import { toast } from "sonner";

interface ReportsViewProps {
  sales: Sale[];
  onViewList: () => void;
}

export function ReportsView({ sales, onViewList }: ReportsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODAS");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("TUDO");
  const [dateFrom, setDateFrom] = useState(toLocalDateInputValue());
  const [dateTo, setDateTo] = useState(toLocalDateInputValue());

  const filtered = useMemo(
    () =>
      filterSales(sales, statusFilter, periodFilter, dateFrom, dateTo, searchQuery),
    [sales, statusFilter, periodFilter, dateFrom, dateTo, searchQuery]
  );

  const totals = useMemo(() => calculateTotals(filtered), [filtered]);
  const vendorReport = useMemo(() => calculateVendorReport(filtered), [filtered]);

  const periodLabel =
    periodFilter === "CUSTOM" ? `${dateFrom} → ${dateTo}` : periodFilter;

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Relatório por Vendedor</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await generateSalesReportPDF(vendorReport, totals, periodLabel);
                  toast.success("PDF gerado com sucesso!");
                } catch (e) {
                  toast.error("Erro ao gerar PDF");
                  console.error(e);
                }
              }}
              disabled={vendorReport.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportSalesToExcel(filtered)}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            <Button size="sm" onClick={onViewList}>
              <List className="h-4 w-4 mr-2" />
              Ver lista
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatsBadge label="Período" value={periodLabel} />
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
        <SalesFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          periodFilter={periodFilter}
          onPeriodChange={setPeriodFilter}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
        />

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
                <TableHead className="text-right">% Cancel.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorReport.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
      </CardContent>
    </Card>
  );
}
