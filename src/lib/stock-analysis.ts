import { supabase } from "@/integrations/supabase/client";

/**
 * Motor de análise de Giro e Estoque.
 *
 * Princípio central: o saldo cadastrado em `products.stock` não é confiável,
 * então todo cálculo de consumo/giro/cobertura é derivado do histórico de
 * `stock_movements` (Kardex), nunca do saldo atual do cadastro.
 *
 * Uma saída (`SAIDA`) só é considerada "saída real" quando está vinculada a
 * uma venda (`reference_type = 'sale'`) que ainda está com `status = 'ATIVA'`.
 * Vendas canceladas ou excluídas deixam o registro de saída no Kardex sem
 * reverter o estoque — por isso essas saídas "fantasma" são identificadas e
 * excluídas do cálculo de consumo/giro.
 */

export type MovementKind = "ENTRADA" | "SAIDA_REAL" | "SAIDA_INVALIDA" | "AJUSTE" | "OUTRO";

export interface RawMovement {
  id: string;
  created_at: string;
  movement_type: string;
  barcode: string;
  product_name: string;
  quantidade: number;
  custo_unitario: number;
  custo_medio_apos: number;
  reference_id: string | null;
  reference_type: string;
}

export interface ProductRow {
  barcode: string;
  product_name: string;
  price: number;
  cost_avg: number;
  stock: number;
}

export interface StockAnalysisRaw {
  movements: RawMovement[];
  saleStatusById: Map<string, string>;
  products: ProductRow[];
}

export type Classification =
  | "Alto giro"
  | "Giro normal"
  | "Baixo giro"
  | "Parado"
  | "Sem saída"
  | "Sem estoque";

export interface ProductMetrics {
  barcode: string;
  productName: string;
  systemStock: number;
  systemValue: number;
  calculatedStock: number;
  calculatedValue: number;
  currentCost: number;
  divergence: number;
  divergenceRelevant: boolean;
  totalEntradas: number;
  totalSaidasReais: number;
  totalAjustes: number;
  hasMovementsInRange: boolean;
  lastSaidaDate: string | null;
  daysSinceLastSaida: number | null;
  saidas30: number;
  saidas60: number;
  saidas90: number;
  saidas180: number;
  saidas365: number;
  saidasPeriodo: number;
  cmvPeriodo: number;
  giroQtd: number | null;
  giroFinanceiro: number | null;
  coberturaDias: number | null;
  saidaMediaDiaria: number;
  classification: Classification;
}

export interface StockAnalysisOptions {
  cutoffDate: Date;
  referenceDays: number;
  paradoThresholdDays: number;
  rupturaThresholdDays: number;
}

export interface StockAnalysisSummary {
  totalSystemValue: number;
  totalCalculatedValue: number;
  totalEntradasQtd: number;
  totalSaidasQtd: number;
  produtosDivergentes: number;
  produtosSemSaida: number;
  produtosParados: number;
  produtosAltoGiro: number;
  produtosRisco: number;
  totalProdutos: number;
}

export interface StockAnalysisResult {
  products: ProductMetrics[];
  summary: StockAnalysisSummary;
  earliestMovementDate: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchStockAnalysisRaw(): Promise<StockAnalysisRaw> {
  const [movementsRes, salesRes, productsRes] = await Promise.all([
    supabase
      .from("stock_movements")
      .select(
        "id,created_at,movement_type,barcode,product_name,quantidade,custo_unitario,custo_medio_apos,reference_id,reference_type"
      )
      .order("created_at", { ascending: true })
      .limit(50000),
    supabase.from("sales").select("id,status").limit(50000),
    supabase.from("products").select("barcode,product_name,price,cost_avg,stock").limit(20000),
  ]);

  if (movementsRes.error) throw movementsRes.error;
  if (salesRes.error) throw salesRes.error;
  if (productsRes.error) throw productsRes.error;

  return {
    movements: (movementsRes.data || []) as RawMovement[],
    saleStatusById: new Map((salesRes.data || []).map((s: any) => [s.id, s.status as string])),
    products: (productsRes.data || []) as ProductRow[],
  };
}

function classifyMovement(m: RawMovement, saleStatusById: Map<string, string>): MovementKind {
  if (m.movement_type === "ENTRADA") return "ENTRADA";
  if (m.movement_type === "SAIDA") {
    if (m.reference_type === "sale") {
      const status = m.reference_id ? saleStatusById.get(m.reference_id) : undefined;
      return status === "ATIVA" ? "SAIDA_REAL" : "SAIDA_INVALIDA";
    }
    return "SAIDA_REAL";
  }
  if (m.movement_type === "AJUSTE") return "AJUSTE";
  return "OUTRO";
}

interface TimelineEntry {
  date: number;
  kind: MovementKind;
  quantidade: number;
  custoUnitario: number;
  custoMedioApos: number;
  balanceAfter: number;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function computeStockAnalysis(
  raw: StockAnalysisRaw,
  options: StockAnalysisOptions
): StockAnalysisResult {
  const now = new Date();
  const cutoffMs = options.cutoffDate.getTime();

  // Earliest movement overall (for defaulting the cutoff date picker in the UI).
  const earliestMovementDate = raw.movements.length > 0 ? new Date(raw.movements[0].created_at) : null;

  const byBarcode = new Map<string, RawMovement[]>();
  raw.movements.forEach((m) => {
    if (new Date(m.created_at).getTime() < cutoffMs) return;
    const arr = byBarcode.get(m.barcode) || [];
    arr.push(m);
    byBarcode.set(m.barcode, arr);
  });

  const productByBarcode = new Map(raw.products.map((p) => [p.barcode, p]));
  const allBarcodes = new Set<string>([...byBarcode.keys(), ...raw.products.map((p) => p.barcode)]);

  const results: ProductMetrics[] = [];

  const windows = { d30: 30, d60: 60, d90: 90, d180: 180, d365: 365 };
  const periodStart = new Date(now.getTime() - options.referenceDays * DAY_MS);

  allBarcodes.forEach((barcode) => {
    const product = productByBarcode.get(barcode);
    const rows = byBarcode.get(barcode) || [];

    let balance = 0;
    const timeline: TimelineEntry[] = rows.map((m) => {
      const kind = classifyMovement(m, raw.saleStatusById);
      let delta = 0;
      if (kind === "ENTRADA") delta = Number(m.quantidade) || 0;
      else if (kind === "SAIDA_REAL") delta = -(Number(m.quantidade) || 0);
      else if (kind === "AJUSTE") delta = Number(m.quantidade) || 0;
      balance += delta;
      return {
        date: new Date(m.created_at).getTime(),
        kind,
        quantidade: Number(m.quantidade) || 0,
        custoUnitario: Number(m.custo_unitario) || 0,
        custoMedioApos: Number(m.custo_medio_apos) || 0,
        balanceAfter: balance,
      };
    });

    const hasMovementsInRange = timeline.length > 0;
    const calculatedStock = hasMovementsInRange ? timeline[timeline.length - 1].balanceAfter : 0;
    const currentCost = hasMovementsInRange
      ? timeline[timeline.length - 1].custoMedioApos
      : Number(product?.cost_avg) || 0;
    const calculatedValue = calculatedStock * currentCost;

    const totalEntradas = timeline
      .filter((t) => t.kind === "ENTRADA")
      .reduce((s, t) => s + t.quantidade, 0);
    const totalSaidasReais = timeline
      .filter((t) => t.kind === "SAIDA_REAL")
      .reduce((s, t) => s + t.quantidade, 0);
    const totalAjustes = timeline.filter((t) => t.kind === "AJUSTE").reduce((s, t) => s + t.quantidade, 0);

    const saidasReais = timeline.filter((t) => t.kind === "SAIDA_REAL");
    const lastSaida = saidasReais.length > 0 ? saidasReais[saidasReais.length - 1] : null;
    const lastSaidaDate = lastSaida ? new Date(lastSaida.date).toISOString() : null;
    const daysSinceLastSaida = lastSaida ? daysBetween(new Date(lastSaida.date), now) : null;

    function saidasSince(days: number): number {
      const from = now.getTime() - days * DAY_MS;
      return saidasReais.filter((t) => t.date >= from).reduce((s, t) => s + t.quantidade, 0);
    }

    const saidas30 = saidasSince(windows.d30);
    const saidas60 = saidasSince(windows.d60);
    const saidas90 = saidasSince(windows.d90);
    const saidas180 = saidasSince(windows.d180);
    const saidas365 = saidasSince(windows.d365);

    // Giro / cobertura no período de referência selecionado
    const periodStartMs = periodStart.getTime();
    const saidasPeriodo = saidasReais
      .filter((t) => t.date >= periodStartMs)
      .reduce((s, t) => s + t.quantidade, 0);
    const cmvPeriodo = saidasReais
      .filter((t) => t.date >= periodStartMs)
      .reduce((s, t) => s + t.quantidade * t.custoUnitario, 0);

    const beforePeriod = [...timeline].reverse().find((t) => t.date < periodStartMs);
    const estoqueInicio = beforePeriod ? beforePeriod.balanceAfter : 0;
    const custoInicio = beforePeriod ? beforePeriod.custoMedioApos : currentCost;
    const estoqueFim = calculatedStock;
    const valorInicio = estoqueInicio * custoInicio;
    const valorFim = calculatedValue;

    const estoqueMedio = (estoqueInicio + estoqueFim) / 2;
    const valorMedio = (valorInicio + valorFim) / 2;

    const giroQtd = estoqueMedio > 0 ? saidasPeriodo / estoqueMedio : null;
    const giroFinanceiro = valorMedio > 0 ? cmvPeriodo / valorMedio : null;
    const saidaMediaDiaria = saidasPeriodo / options.referenceDays;
    const coberturaDias =
      saidaMediaDiaria > 0 ? calculatedStock / saidaMediaDiaria : calculatedStock > 0 ? null : 0;

    const systemStock = Number(product?.stock) || 0;
    const systemValue = systemStock * currentCost;
    const divergence = systemStock - calculatedStock;
    const divergenceRelevant =
      Math.abs(divergence) >= 1 &&
      (Math.abs(divergence) >= 3 || Math.abs(divergence) / Math.max(Math.abs(systemStock), 1) >= 0.05);

    let classification: Classification;
    if (calculatedStock <= 0) {
      classification = "Sem estoque";
    } else if (!lastSaidaDate) {
      classification = "Sem saída";
    } else if (daysSinceLastSaida !== null && daysSinceLastSaida >= options.paradoThresholdDays) {
      classification = "Parado";
    } else if (giroQtd !== null && giroQtd >= 3) {
      classification = "Alto giro";
    } else if (giroQtd !== null && giroQtd >= 1) {
      classification = "Giro normal";
    } else {
      classification = "Baixo giro";
    }

    results.push({
      barcode,
      productName: product?.product_name || rows[rows.length - 1]?.product_name || "",
      systemStock,
      systemValue,
      calculatedStock,
      calculatedValue,
      currentCost,
      divergence,
      divergenceRelevant,
      totalEntradas,
      totalSaidasReais,
      totalAjustes,
      hasMovementsInRange,
      lastSaidaDate,
      daysSinceLastSaida,
      saidas30,
      saidas60,
      saidas90,
      saidas180,
      saidas365,
      saidasPeriodo,
      cmvPeriodo,
      giroQtd,
      giroFinanceiro,
      coberturaDias,
      saidaMediaDiaria,
      classification,
    });
  });

  results.sort((a, b) => a.productName.localeCompare(b.productName));

  const summary: StockAnalysisSummary = {
    totalSystemValue: results.reduce((s, r) => s + r.systemValue, 0),
    totalCalculatedValue: results.reduce((s, r) => s + r.calculatedValue, 0),
    totalEntradasQtd: results.reduce((s, r) => s + r.totalEntradas, 0),
    totalSaidasQtd: results.reduce((s, r) => s + r.totalSaidasReais, 0),
    produtosDivergentes: results.filter((r) => r.divergenceRelevant).length,
    produtosSemSaida: results.filter((r) => r.classification === "Sem saída").length,
    produtosParados: results.filter((r) => r.classification === "Parado").length,
    produtosAltoGiro: results.filter((r) => r.classification === "Alto giro").length,
    produtosRisco: results.filter(
      (r) =>
        r.calculatedStock > 0 &&
        r.saidasPeriodo > 0 &&
        r.coberturaDias !== null &&
        r.coberturaDias < options.rupturaThresholdDays
    ).length,
    totalProdutos: results.length,
  };

  return { products: results, summary, earliestMovementDate };
}
