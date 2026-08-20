import { Sale, SaleTotals, VendorReport, StatusFilter, PeriodFilter, Seller } from "@/types/sales";
import { format, startOfDay, endOfDay, subDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

const SALES_STORAGE_KEY = "lovable_sales_v2";
const SELLERS_STORAGE_KEY = "lovable_sellers_v1";

export function formatBRL(n: number | string): string {
  const v = Number(n || 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function safeNumber(x: unknown): number {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  const id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return id.split(".").join("");
}

export function loadSales(): Sale[] {
  try {
    const raw = localStorage.getItem(SALES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSales(list: Sale[]): void {
  localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify(list));
}

export function loadSellers(): Seller[] {
  try {
    const raw = localStorage.getItem(SELLERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSellers(list: Seller[]): void {
  localStorage.setItem(SELLERS_STORAGE_KEY, JSON.stringify(list));
}

export function addSeller(name: string): Seller {
  const newSeller: Seller = { id: uuid(), name: name.trim() };
  const currentSellers = loadSellers();
  saveSellers([...currentSellers, newSeller]);
  return newSeller;
}

export function toLocalDateInputValue(d: Date = new Date()): string {
  return format(d, "yyyy-MM-dd");
}

export function parseDateInputToRange(dateStr: string, includeEndOfDay: boolean = false): Date | null {
  const [y, m, d] = dateStr.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return includeEndOfDay ? endOfDay(dt) : startOfDay(dt);
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function escapeCSV(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.split('"').join('""')}"`;
  }
  return s;
}

export function filterSales(
  sales: Sale[],
  statusFilter: StatusFilter,
  periodFilter: PeriodFilter,
  dateFrom: string,
  dateTo: string,
  searchQuery: string,
  vendorFilter?: string // Adicionado filtro por vendedor
): Sale[] {
  let list = [...sales];

  // Filter by status
  if (statusFilter === "ATIVAS") list = list.filter((s) => s.status === "ATIVA");
  if (statusFilter === "CANCELADAS") list = list.filter((s) => s.status === "CANCELADA");

  // Filter by period
  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  if (periodFilter === "HOJE") {
    start = startOfDay(now);
    end = endOfDay(now);
  } else if (periodFilter === "7D") {
    start = startOfDay(subDays(now, 6)); // Last 7 days including today
    end = endOfDay(now);
  } else if (periodFilter === "30D") {
    start = startOfDay(subDays(now, 29)); // Last 30 days including today
    end = endOfDay(now);
  } else if (periodFilter === "CUSTOM") {
    start = parseDateInputToRange(dateFrom, false);
    end = parseDateInputToRange(dateTo, true);
  }

  if (start && end) {
    list = list.filter((s) => {
      const dt = new Date(s.createdAt);
      return isWithinInterval(dt, { start: start!, end: end! });
    });
  }

  // Search
  const term = searchQuery.trim().toLowerCase();
  if (term) {
    list = list.filter((s) => {
      return (
        String(s.vendedor || "").toLowerCase().includes(term) ||
        String(s.barcode || "").toLowerCase().includes(term) ||
        String(s.productName || "").toLowerCase().includes(term) || // Incluir nome do produto na busca
        String(s.formaPagamento || "").toLowerCase().includes(term) ||
        String(s.status || "").toLowerCase().includes(term)
      );
    });
  }

  // Filter by specific vendor for dashboard
  if (vendorFilter && vendorFilter !== "TODOS") {
    list = list.filter((s) => s.vendedor === vendorFilter);
  }

  return list;
}

export function calculateTotals(filtered: Sale[]): SaleTotals {
  const ativas = filtered.filter((s) => s.status === "ATIVA");
  const canceladas = filtered.filter((s) => s.status === "CANCELADA");

  const itensAtivas = ativas.reduce((acc, s) => acc + safeNumber(s.quantidade), 0);
  const brutoAtivas = ativas.reduce((acc, s) => acc + safeNumber(s.totalBruto), 0);
  const descAtivas = ativas.reduce((acc, s) => acc + safeNumber(s.desconto), 0);
  const liquidoAtivas = ativas.reduce((acc, s) => acc + safeNumber(s.totalLiquido), 0);
  const pagoAtivas = ativas.reduce((acc, s) => acc + safeNumber(s.valorPago), 0);

  const pctCancel = filtered.length ? (canceladas.length / filtered.length) * 100 : 0;

  return {
    totalRegistros: filtered.length,
    totalAtivas: ativas.length,
    totalCanceladas: canceladas.length,
    pctCancel,
    itensAtivas,
    brutoAtivas,
    descAtivas,
    liquidoAtivas,
    pagoAtivas,
    diferenca: pagoAtivas - liquidoAtivas,
  };
}

export function calculateVendorReport(filtered: Sale[]): VendorReport[] {
  const ativas = filtered.filter((s) => s.status === "ATIVA");
  const map = new Map<string, VendorReport>();

  for (const s of ativas) {
    const key = s.vendedor || "Sem vendedor";
    if (!map.has(key)) {
      map.set(key, {
        vendedor: key,
        vendas: 0,
        itens: 0,
        bruto: 0,
        desconto: 0,
        liquido: 0,
        pago: 0,
        diferenca: 0,
        pctCancel: 0,
      });
    }
    const row = map.get(key)!;
    row.vendas += 1;
    row.itens += safeNumber(s.quantidade);
    row.bruto += safeNumber(s.totalBruto);
    row.desconto += safeNumber(s.desconto);
    row.liquido += safeNumber(s.totalLiquido);
    row.pago += safeNumber(s.valorPago);
    row.diferenca = row.pago - row.liquido;
    map.set(key, row);
  }

  // Calculate cancel percentage per vendor
  const cancelMap = new Map<string, { total: number; cancel: number }>();
  for (const s of filtered) {
    const key = s.vendedor || "Sem vendedor";
    if (!cancelMap.has(key)) cancelMap.set(key, { total: 0, cancel: 0 });
    const c = cancelMap.get(key)!;
    c.total += 1;
    if (s.status === "CANCELADA") c.cancel += 1;
    cancelMap.set(key, c);
  }

  const rows = Array.from(map.values()).map((r) => {
    const c = cancelMap.get(r.vendedor) || { total: 0, cancel: 0 };
    const pctCancel = c.total ? (c.cancel / c.total) * 100 : 0;
    return { ...r, pctCancel };
  });

  rows.sort((a, b) => b.liquido - a.liquido);
  return rows;
}

export function aggregateSalesByDate(
  sales: Sale[],
  period: "day" | "month"
): { date: string; totalLiquido: number }[] {
  const aggregated = new Map<string, number>();

  for (const sale of sales) {
    if (sale.status === "ATIVA") {
      const date = parseISO(sale.createdAt);
      let key: string;
      if (period === "day") {
        key = format(date, "yyyy-MM-dd");
      } else {
        key = format(date, "yyyy-MM");
      }
      aggregated.set(key, (aggregated.get(key) || 0) + safeNumber(sale.totalLiquido));
    }
  }

  const sortedData = Array.from(aggregated.entries())
    .map(([date, totalLiquido]) => ({ date, totalLiquido }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return sortedData;
}

export function exportSalesToExcel(filtered: Sale[]): void {
  const data = filtered.map((s) => ({
    "ID": s.id,
    "Data/Hora": format(parseISO(s.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    "Vendedor": s.vendedor,
    "Código de Barras": s.barcode,
    "Produto": s.productName,
    "Quantidade": s.quantidade,
    "Valor Unitário": safeNumber(s.valorUnitario),
    "Total Bruto": safeNumber(s.totalBruto),
    "Desconto": safeNumber(s.desconto),
    "Total Líquido": safeNumber(s.totalLiquido),
    "Pgto PIX": safeNumber(s.pgtoPix),
    "Pgto Cartão": safeNumber(s.pgtoCartao),
    "Pgto Dinheiro": safeNumber(s.pgtoDinheiro),
    "Pgto Boleto": safeNumber(s.pgtoBoleto),
    "Pgto Outros": safeNumber(s.pgtoOutros),
    "Cliente": s.clientNome || "",
    "Observações": s.observacoes || "",
    "Forma de Pagamento": s.formaPagamento,
    "Status": s.status,
    "Motivo Cancelamento": s.cancelMotivo || "",
    "Data Cancelamento": s.canceledAt ? format(parseISO(s.canceledAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Ajustar largura das colunas
  const colWidths = [
    { wch: 36 }, // ID
    { wch: 18 }, // Data/Hora
    { wch: 20 }, // Vendedor
    { wch: 15 }, // Código de Barras
    { wch: 25 }, // Produto
    { wch: 12 }, // Quantidade
    { wch: 14 }, // Valor Unitário
    { wch: 14 }, // Total Bruto
    { wch: 12 }, // Desconto
    { wch: 14 }, // Total Líquido
    { wch: 14 }, // Pgto PIX
    { wch: 14 }, // Pgto Cartão
    { wch: 14 }, // Pgto Dinheiro
    { wch: 14 }, // Pgto Boleto
    { wch: 14 }, // Pgto Outros
    { wch: 25 }, // Observações
    { wch: 18 }, // Forma de Pagamento
    { wch: 12 }, // Status
    { wch: 25 }, // Motivo Cancelamento
    { wch: 18 }, // Data Cancelamento
  ];
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vendas");
  
  const filename = `vendas_${toLocalDateInputValue(new Date())}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function formatMonthYear(date: Date): string {
  return format(date, "MMM yyyy", { locale: ptBR });
}