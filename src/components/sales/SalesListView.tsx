import { useState, useMemo } from "react";
import { Download, Trash2, Plus, Ban, Pencil } from "lucide-react";
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
import { StatusPill } from "./StatusPill";
import { StatsBadge } from "./StatsBadge";
import { CancelModal } from "./CancelModal";
import { EditDateModal } from "./EditDateModal";
import { Sale, StatusFilter, PeriodFilter } from "@/types/sales";
import {
  formatBRL,
  toLocalDateInputValue,
  filterSales,
  calculateTotals,
  exportSalesToExcel,
} from "@/lib/sales-utils";

interface SalesListViewProps {
  sales: Sale[];
  onCancelSale: (id: string, motivo: string) => void;
  onClearAll: () => void;
  onNewSale: () => void;
  onUpdateSaleDate?: (id: string, newDate: string) => void;
  isAdmin?: boolean;
}

export function SalesListView({
  sales,
  onCancelSale,
  onClearAll,
  onNewSale,
  onUpdateSaleDate,
  isAdmin = false,
}: SalesListViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODAS");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("TUDO");
  const [dateFrom, setDateFrom] = useState(toLocalDateInputValue());
  const [dateTo, setDateTo] = useState(toLocalDateInputValue());

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const [editDateOpen, setEditDateOpen] = useState(false);
  const [editDateTarget, setEditDateTarget] = useState<{ id: string; date: string } | null>(null);

  function openEditDate(sale: Sale) {
    setEditDateTarget({ id: sale.id, date: sale.createdAt });
    setEditDateOpen(true);
  }

  function confirmEditDate(newDate: string) {
    if (editDateTarget && onUpdateSaleDate) {
      onUpdateSaleDate(editDateTarget.id, newDate);
    }
    setEditDateOpen(false);
    setEditDateTarget(null);
  }

  const filtered = useMemo(
    () =>
      filterSales(sales, statusFilter, periodFilter, dateFrom, dateTo, searchQuery),
    [sales, statusFilter, periodFilter, dateFrom, dateTo, searchQuery]
  );

  const totals = useMemo(() => calculateTotals(filtered), [filtered]);

  function openCancel(id: string) {
    setCancelTargetId(id);
    setCancelOpen(true);
  }

  function confirmCancel(motivo: string) {
    if (cancelTargetId) {
      onCancelSale(cancelTargetId, motivo);
    }
    setCancelOpen(false);
    setCancelTargetId(null);
  }

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Vendas Registradas</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportSalesToExcel(filtered)}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              disabled={sales.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Apagar tudo
            </Button>
            <Button size="sm" onClick={onNewSale}>
              <Plus className="h-4 w-4 mr-2" />
              Nova venda
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatsBadge label="Registros" value={totals.totalRegistros} />
          <StatsBadge label="Ativas" value={totals.totalAtivas} variant="success" />
          <StatsBadge
            label="Canceladas"
            value={`${totals.totalCanceladas} (${totals.pctCancel.toFixed(1)}%)`}
            variant={totals.totalCanceladas > 0 ? "warning" : "muted"}
          />
          <StatsBadge
            label="Líquido"
            value={formatBRL(totals.liquidoAtivas)}
            variant="success"
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
                <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead> {/* Nova coluna */}
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Unit.</TableHead>
                <TableHead className="text-right">Desc.</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Pgto</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Troco</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={13}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhuma venda encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow
                    key={s.id}
                    className={
                      s.status === "CANCELADA" ? "opacity-60" : undefined
                    }
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1">
                        {new Date(s.createdAt).toLocaleString("pt-BR")}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={() => openEditDate(s)}
                            title="Alterar data"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={s.status} />
                    </TableCell>
                    <TableCell className="font-semibold">{s.vendedor}</TableCell>
                    <TableCell className="font-mono text-sm">{s.barcode}</TableCell>
                    <TableCell>{s.productName}</TableCell> {/* Exibir nome do produto */}
                    <TableCell className="text-right">{s.quantidade}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatBRL(s.valorUnitario)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatBRL(s.desconto)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-bold">
                      {formatBRL(s.totalLiquido)}
                    </TableCell>
                    <TableCell>{s.formaPagamento}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatBRL(s.valorPago)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatBRL(s.troco)}
                    </TableCell>
                    <TableCell>
                      {s.status === "ATIVA" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openCancel(s.id)}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {s.cancelMotivo}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <CancelModal
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          onConfirm={confirmCancel}
        />

        {editDateTarget && (
          <EditDateModal
            open={editDateOpen}
            currentDate={editDateTarget.date}
            onClose={() => {
              setEditDateOpen(false);
              setEditDateTarget(null);
            }}
            onConfirm={confirmEditDate}
          />
        )}
      </CardContent>
    </Card>
  );
}