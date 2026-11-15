import * as XLSX from "xlsx";

export function formatQty(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** Custo unitário em R$ com até 4 casas (custo médio é numeric(14,4)). */
export function formatCost(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Extrai a mensagem de erro do Supabase/Postgres sem os prefixos técnicos. */
export function dbErrorMessage(err: unknown): string {
  const raw =
    (err as { message?: string })?.message ||
    (typeof err === "string" ? err : "Erro inesperado");
  return raw.replace(/^(SALDO_INSUFICIENTE|CONTAGEM_FECHADA):\s*/, "");
}

export const MOVEMENT_LABELS: Record<string, string> = {
  ENTRADA_NOTA: "Entrada (nota)",
  ESTORNO_NOTA: "Estorno de nota",
  SAIDA_VENDA: "Saída (venda)",
  ESTORNO_VENDA: "Estorno de venda",
  AJUSTE_INVENTARIO: "Ajuste de inventário",
  AJUSTE_MANUAL: "Ajuste manual",
  MESCLAGEM: "Mesclagem",
};

export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  EM_CONFERENCIA: "Em conferência",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

/** Exporta linhas para CSV (separador ;, compatível com Excel pt-BR) ou XLSX. */
export function exportRows(rows: Record<string, unknown>[], fileBase: string, format: "csv" | "xlsx") {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}
