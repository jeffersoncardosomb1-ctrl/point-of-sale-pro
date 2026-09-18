import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  Repeat,
  PackageX,
  ClipboardCheck,
  Gauge,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Boxes,
} from "lucide-react";
import { formatBRL } from "@/lib/sales-utils";
import { toast } from "@/hooks/use-toast";
import {
  computeStockAnalysis,
  fetchStockAnalysisRaw,
  StockAnalysisRaw,
  StockAnalysisResult,
  ProductMetrics,
} from "@/lib/stock-analysis";

function formatQty(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatDateBR(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatCobertura(dias: number | null, estoque: number): string {
  if (estoque <= 0) return "—";
  if (dias === null) return "∞";
  return `${dias.toFixed(0)} dias`;
}

function classificationBadge(c: ProductMetrics["classification"]) {
  const map: Record<ProductMetrics["classification"], string> = {
    "Alto giro": "text-success border-success/30",
    "Giro normal": "text-foreground border-border",
    "Baixo giro": "text-warning border-warning/30",
    Parado: "text-destructive border-destructive/30",
    "Sem saída": "text-destructive border-destructive/30",
    "Sem estoque": "text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={map[c]}>
      {c}
    </Badge>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const RUPTURA_THRESHOLD_DIAS = 7;

export function StockTurnoverView() {
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<StockAnalysisRaw | null>(null);
  const [cutoffDate, setCutoffDate] = useState<string>(todayISO());
  const [cutoffTouched, setCutoffTouched] = useState(false);
  const [referenceDays, setReferenceDays] = useState(90);
  const [paradoThresholdDays, setParadoThresholdDays] = useState(90);
  const [subTab, setSubTab] = useState("visao");
  const [searchGiro, setSearchGiro] = useState("");
  const [searchConf, setSearchConf] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchStockAnalysisRaw();
      setRaw(data);
      if (!cutoffTouched) {
        const earliest = data.movements[0]?.created_at;
        if (earliest) setCutoffDate(new Date(earliest).toISOString().slice(0, 10));
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao carregar movimentações",
        description: err?.message || "Falha ao consultar o histórico de estoque.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analysis: StockAnalysisResult | null = useMemo(() => {
    if (!raw) return null;
    return computeStockAnalysis(raw, {
      cutoffDate: new Date(cutoffDate + "T00:00:00"),
      referenceDays,
      paradoThresholdDays,
      rupturaThresholdDays: RUPTURA_THRESHOLD_DIAS,
    });
  }, [raw, cutoffDate, referenceDays, paradoThresholdDays]);

  const giroFiltered = useMemo(() => {
    if (!analysis) return [];
    const q = searchGiro.trim().toLowerCase();
    if (!q) return analysis.products;
    return analysis.products.filter(
      (p) => p.productName.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    );
  }, [analysis, searchGiro]);

  const paradosFiltered = useMemo(() => {
    if (!analysis) return [];
    return analysis.products
      .filter(
        (p) =>
          p.calculatedStock > 0 &&
          (p.lastSaidaDate === null || (p.daysSinceLastSaida ?? 0) >= paradoThresholdDays)
      )
      .sort((a, b) => (b.daysSinceLastSaida ?? 99999) - (a.daysSinceLastSaida ?? 99999));
  }, [analysis, paradoThresholdDays]);

  const confFiltered = useMemo(() => {
    if (!analysis) return [];
    const q = searchConf.trim().toLowerCase();
    let rows = analysis.products;
    if (q) {
      rows = rows.filter(
        (p) => p.productName.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence));
  }, [analysis, searchConf]);

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            Giro e Análise de Estoque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Esta análise usa o histórico de <strong>entradas e saídas</strong> registradas no Kardex como
            fonte principal — o saldo cadastrado no produto é mostrado apenas para comparação, nunca como
            base de cálculo. Saídas vinculadas a vendas canceladas ou excluídas são automaticamente
            desconsideradas do consumo.
          </p>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Data inicial da análise</Label>
              <Input
                type="date"
                value={cutoffDate}
                onChange={(e) => {
                  setCutoffTouched(true);
                  setCutoffDate(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Período de referência (giro/cobertura)</Label>
              <Select value={String(referenceDays)} onValueChange={(v) => setReferenceDays(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="180">180 dias</SelectItem>
                  <SelectItem value="365">12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Considerar "parado" sem saída há</Label>
              <Select
                value={String(paradoThresholdDays)}
                onValueChange={(v) => setParadoThresholdDays(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="180">180 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={load} disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </Button>
            </div>
          </div>

          {analysis?.earliestMovementDate && (
            <p className="text-xs text-muted-foreground">
              Histórico de movimentações disponível desde{" "}
              <strong>{formatDateBR(analysis.earliestMovementDate.toISOString())}</strong>. Movimentações
              anteriores à data inicial escolhida não entram no cálculo.
            </p>
          )}
        </CardContent>
      </Card>

      {loading && !analysis ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando movimentações...</span>
        </div>
      ) : analysis ? (
        <Tabs value={subTab} onValueChange={setSubTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="visao" className="gap-2">
              <Gauge className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="giro" className="gap-2">
              <Repeat className="h-4 w-4" />
              Giro por Produto
            </TabsTrigger>
            <TabsTrigger value="parados" className="gap-2">
              <PackageX className="h-4 w-4" />
              Produtos Parados
            </TabsTrigger>
            <TabsTrigger value="conferencia" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Conferência de Estoque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao" className="space-y-4">
            <VisaoGeral analysis={analysis} />
          </TabsContent>

          <TabsContent value="giro" className="space-y-3">
            <Input
              value={searchGiro}
              onChange={(e) => setSearchGiro(e.target.value)}
              placeholder="Filtrar por nome ou código de barras"
              className="max-w-sm"
            />
            <div className="overflow-auto max-h-[600px] rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2 text-right">Estoque calc.</th>
                    <th className="px-3 py-2 text-right">Estoque sistema</th>
                    <th className="px-3 py-2 text-right">Valor calc.</th>
                    <th className="px-3 py-2 text-right">Saídas 30d</th>
                    <th className="px-3 py-2 text-right">Saídas 60d</th>
                    <th className="px-3 py-2 text-right">Saídas 90d</th>
                    <th className="px-3 py-2 text-right">Saídas 180d</th>
                    <th className="px-3 py-2 text-right">Saídas 12m</th>
                    <th className="px-3 py-2 text-right">Giro (qtd)</th>
                    <th className="px-3 py-2 text-right">Giro (R$)</th>
                    <th className="px-3 py-2 text-right">Cobertura</th>
                    <th className="px-3 py-2">Classificação</th>
                  </tr>
                </thead>
                <tbody>
                  {giroFiltered.map((p) => (
                    <tr key={p.barcode} className="border-t">
                      <td className="px-3 py-2">{p.productName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.barcode}</td>
                      <td className={`px-3 py-2 text-right ${p.calculatedStock < 0 ? "text-destructive" : ""}`}>
                        {formatQty(p.calculatedStock)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{formatQty(p.systemStock)}</td>
                      <td className="px-3 py-2 text-right">{formatBRL(p.calculatedValue)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.saidas30)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.saidas60)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.saidas90)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.saidas180)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.saidas365)}</td>
                      <td className="px-3 py-2 text-right">{p.giroQtd === null ? "—" : p.giroQtd.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        {p.giroFinanceiro === null ? "—" : p.giroFinanceiro.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatCobertura(p.coberturaDias, p.calculatedStock)}
                      </td>
                      <td className="px-3 py-2">{classificationBadge(p.classification)}</td>
                    </tr>
                  ))}
                  {giroFiltered.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="parados" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Produtos com estoque calculado positivo e sem saída há pelo menos {paradoThresholdDays} dias
              (ou que nunca tiveram saída registrada).
            </p>
            <div className="overflow-auto max-h-[600px] rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Última saída</th>
                    <th className="px-3 py-2 text-right">Dias sem saída</th>
                    <th className="px-3 py-2 text-right">Saídas 30d</th>
                    <th className="px-3 py-2 text-right">Saídas 90d</th>
                    <th className="px-3 py-2 text-right">Saídas 180d</th>
                    <th className="px-3 py-2 text-right">Total entradas</th>
                    <th className="px-3 py-2 text-right">Total saídas</th>
                    <th className="px-3 py-2 text-right">Estoque calc.</th>
                    <th className="px-3 py-2 text-right">Valor calc.</th>
                    <th className="px-3 py-2 text-right">Cobertura</th>
                    <th className="px-3 py-2">Classificação</th>
                  </tr>
                </thead>
                <tbody>
                  {paradosFiltered.map((p) => (
                    <tr key={p.barcode} className="border-t">
                      <td className="px-3 py-2">{p.productName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.barcode}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(p.lastSaidaDate)}</td>
                      <td className="px-3 py-2 text-right">
                        {p.daysSinceLastSaida === null ? "—" : p.daysSinceLastSaida}
                      </td>
                      <td className="px-3 py-2 text-right">{formatQty(p.saidas30)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.saidas90)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.saidas180)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.totalEntradas)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.totalSaidasReais)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.calculatedStock)}</td>
                      <td className="px-3 py-2 text-right">{formatBRL(p.calculatedValue)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatCobertura(p.coberturaDias, p.calculatedStock)}
                      </td>
                      <td className="px-3 py-2">{classificationBadge(p.classification)}</td>
                    </tr>
                  ))}
                  {paradosFiltered.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum produto parado nesse critério.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="conferencia" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Compara o saldo cadastrado no produto com o saldo calculado pelas movimentações. Nenhum
              ajuste é feito automaticamente — use esta tela apenas para decidir quais correções realizar.
            </p>
            <Input
              value={searchConf}
              onChange={(e) => setSearchConf(e.target.value)}
              placeholder="Filtrar por nome ou código de barras"
              className="max-w-sm"
            />
            <div className="overflow-auto max-h-[600px] rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2 text-right">Saldo sistema</th>
                    <th className="px-3 py-2 text-right">Entradas</th>
                    <th className="px-3 py-2 text-right">Saídas</th>
                    <th className="px-3 py-2 text-right">Saldo calculado</th>
                    <th className="px-3 py-2 text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {confFiltered.map((p) => (
                    <tr
                      key={p.barcode}
                      className={`border-t ${p.divergenceRelevant ? "bg-destructive/5" : ""}`}
                    >
                      <td className="px-3 py-2">{p.productName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.barcode}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.systemStock)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.totalEntradas)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.totalSaidasReais)}</td>
                      <td className="px-3 py-2 text-right">{formatQty(p.calculatedStock)}</td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          p.divergenceRelevant ? "text-destructive" : Math.abs(p.divergence) > 0 ? "text-warning" : ""
                        }`}
                      >
                        {p.divergence > 0 ? "+" : ""}
                        {formatQty(p.divergence)}
                      </td>
                    </tr>
                  ))}
                  {confFiltered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

function VisaoGeral({ analysis }: { analysis: StockAnalysisResult }) {
  const { summary } = analysis;
  const diffValor = summary.totalCalculatedValue - summary.totalSystemValue;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Boxes className="h-4 w-4" />}
          label="Estoque cadastrado (valor)"
          value={formatBRL(summary.totalSystemValue)}
        />
        <KpiCard
          icon={<Boxes className="h-4 w-4" />}
          label="Estoque calculado (valor)"
          value={formatBRL(summary.totalCalculatedValue)}
        />
        <KpiCard
          icon={diffValor >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="Diferença (calc. − sistema)"
          value={formatBRL(diffValor)}
          highlight={diffValor === 0 ? undefined : "warning"}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Produtos com divergência"
          value={String(summary.produtosDivergentes)}
          highlight={summary.produtosDivergentes > 0 ? "destructive" : undefined}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Total de entradas" value={formatQty(summary.totalEntradasQtd)} />
        <KpiCard icon={<TrendingDown className="h-4 w-4" />} label="Total de saídas" value={formatQty(summary.totalSaidasQtd)} />
        <KpiCard
          icon={<PackageX className="h-4 w-4" />}
          label="Produtos sem saída"
          value={String(summary.produtosSemSaida)}
        />
        <KpiCard
          icon={<PackageX className="h-4 w-4" />}
          label="Produtos parados"
          value={String(summary.produtosParados)}
          highlight={summary.produtosParados > 0 ? "warning" : undefined}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Repeat className="h-4 w-4" />}
          label="Produtos de alto giro"
          value={String(summary.produtosAltoGiro)}
          highlight="success"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label={`Risco de ruptura (< ${RUPTURA_THRESHOLD_DIAS}d cobertura)`}
          value={String(summary.produtosRisco)}
          highlight={summary.produtosRisco > 0 ? "destructive" : undefined}
        />
        <KpiCard icon={<Boxes className="h-4 w-4" />} label="Total de produtos analisados" value={String(summary.totalProdutos)} />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: "success" | "warning" | "destructive";
}) {
  const color =
    highlight === "success"
      ? "text-success"
      : highlight === "warning"
      ? "text-warning"
      : highlight === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
