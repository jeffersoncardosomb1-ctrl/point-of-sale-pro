import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Percent, AlertTriangle, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/sales-utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface SaleRow {
  id: string;
  created_at: string;
  barcode: string;
  product_name: string;
  quantidade: number;
  total_liquido: number;
  unit_cost: number;
  total_cost: number;
  status: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function CostMarginView() {
  const { isAdmin } = useAuth();
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [propagate, setPropagate] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const fromIso = new Date(from + "T00:00:00").toISOString();
      const toIso = new Date(to + "T23:59:59").toISOString();
      const { data, error } = await supabase
        .from("sales")
        .select("id,created_at,barcode,product_name,quantidade,total_liquido,unit_cost,total_cost,status")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .eq("status", "ATIVA")
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      setRows((data || []) as any);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only consider sales that have a recorded cost (post-module). Sales sem custo são ignoradas.
  const valid = useMemo(
    () => rows.filter((r) => Number(r.unit_cost) > 0 || Number(r.total_cost) > 0),
    [rows]
  );

  // Sales without cost — eligible for manual admin entry
  const semCusto = useMemo(
    () => rows.filter((r) => !(Number(r.unit_cost) > 0) && !(Number(r.total_cost) > 0)),
    [rows]
  );

  const semCustoFiltered = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return semCusto;
    return semCusto.filter(
      (r) => r.product_name.toLowerCase().includes(q) || r.barcode.toLowerCase().includes(q)
    );
  }, [semCusto, productFilter]);

  function parseCost(v: string): number {
    if (!v) return 0;
    const n = Number(String(v).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }

  async function handleSaveCost(row: SaleRow) {
    const raw = costInputs[row.id];
    const unit = parseCost(raw || "");
    if (unit <= 0) {
      toast({ title: "Custo inválido", description: "Informe um valor maior que zero.", variant: "destructive" });
      return;
    }
    setSavingId(row.id);
    try {
      const totalCost = unit * Number(row.quantidade || 0);
      const { error: saleErr } = await supabase
        .from("sales")
        .update({ unit_cost: unit, total_cost: totalCost })
        .eq("id", row.id);
      if (saleErr) throw saleErr;

      if (propagate && row.barcode) {
        const { data: prod } = await supabase
          .from("products")
          .select("id, cost_avg")
          .eq("barcode", row.barcode)
          .maybeSingle();
        if (prod && (!prod.cost_avg || Number(prod.cost_avg) <= 0)) {
          await supabase.from("products").update({ cost_avg: unit }).eq("id", prod.id);
        }
      }

      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, unit_cost: unit, total_cost: totalCost } : r))
      );
      setCostInputs((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      toast({ title: "Custo registrado", description: `${row.product_name || row.barcode}` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: err?.message || "Falha ao atualizar custo.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return valid;
    return valid.filter(
      (r) => r.product_name.toLowerCase().includes(q) || r.barcode.toLowerCase().includes(q)
    );
  }, [valid, productFilter]);

  const totals = useMemo(() => {
    const receita = filtered.reduce((s, r) => s + Number(r.total_liquido), 0);
    const cmv = filtered.reduce((s, r) => s + Number(r.total_cost), 0);
    const lucro = receita - cmv;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    return { receita, cmv, lucro, margem };
  }, [filtered]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { barcode: string; name: string; qty: number; receita: number; cmv: number }>();
    filtered.forEach((r) => {
      const key = r.barcode || r.product_name;
      const cur = map.get(key) || { barcode: r.barcode, name: r.product_name, qty: 0, receita: 0, cmv: 0 };
      cur.qty += Number(r.quantidade);
      cur.receita += Number(r.total_liquido);
      cur.cmv += Number(r.total_cost);
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((p) => {
        const lucro = p.receita - p.cmv;
        const margem = p.receita > 0 ? (lucro / p.receita) * 100 : 0;
        return { ...p, lucro, margem };
      })
      .sort((a, b) => b.lucro - a.lucro);
  }, [filtered]);

  const topLucrativos = byProduct.slice(0, 10);
  const menorMargem = [...byProduct].sort((a, b) => a.margem - b.margem).slice(0, 10);

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Gestão de Custos e Margens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Filtrar produto/código</Label>
              <Input value={productFilter} onChange={(e) => setProductFilter(e.target.value)} placeholder="Nome ou código de barras" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Atualizar
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Receita total" value={formatBRL(totals.receita)} />
            <KpiCard icon={<TrendingDown className="h-4 w-4" />} label="CMV" value={formatBRL(totals.cmv)} />
            <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Lucro bruto" value={formatBRL(totals.lucro)} highlight={totals.lucro >= 0 ? "success" : "destructive"} />
            <KpiCard icon={<Percent className="h-4 w-4" />} label="Margem" value={`${totals.margem.toFixed(1)}%`} highlight={totals.margem >= 0 ? "success" : "destructive"} />
          </div>

          <p className="text-xs text-muted-foreground">
            * Apenas vendas com custo registrado entram nos cálculos. Vendas anteriores ao módulo de custos são ignoradas.
          </p>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Vendas sem custo cadastrado ({semCustoFiltered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">
                Informe manualmente o custo unitário para incluir essas vendas nos cálculos de margem.
              </p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={propagate}
                  onChange={(e) => setPropagate(e.target.checked)}
                />
                Atualizar custo médio do produto (se ainda não tiver)
              </label>
            </div>
            <div className="overflow-auto max-h-96 rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">Receita</th>
                    <th className="px-3 py-2 text-right">Custo unit.</th>
                    <th className="px-3 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {semCustoFiltered.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.barcode}</td>
                      <td className="px-3 py-2">{r.product_name}</td>
                      <td className="px-3 py-2 text-right">{r.quantidade}</td>
                      <td className="px-3 py-2 text-right">{formatBRL(Number(r.total_liquido))}</td>
                      <td className="px-3 py-2 text-right w-32">
                        <Input
                          inputMode="decimal"
                          placeholder="0,00"
                          value={costInputs[r.id] ?? ""}
                          onChange={(e) =>
                            setCostInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveCost(r)}
                          disabled={savingId === r.id}
                        >
                          {savingId === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Save className="h-3 w-3 mr-1" />Salvar</>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {semCustoFiltered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma venda sem custo no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por produto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-96 rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-right">Receita</th>
                  <th className="px-3 py-2 text-right">CMV</th>
                  <th className="px-3 py-2 text-right">Lucro</th>
                  <th className="px-3 py-2 text-right">Margem</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((p) => (
                  <tr key={p.barcode + p.name} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{p.barcode}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-right">{p.qty}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(p.receita)}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(p.cmv)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${p.lucro >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(p.lucro)}</td>
                    <td className={`px-3 py-2 text-right ${p.margem >= 0 ? "" : "text-destructive"}`}>{p.margem.toFixed(1)}%</td>
                  </tr>
                ))}
                {byProduct.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Sem dados no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankingCard title="Top 10 mais lucrativos" rows={topLucrativos} />
        <RankingCard title="10 com menor margem" rows={menorMargem} showMargem />
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: "success" | "destructive" }) {
  const color = highlight === "success" ? "text-success" : highlight === "destructive" ? "text-destructive" : "text-foreground";
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

function RankingCard({ title, rows, showMargem }: { title: string; rows: { name: string; barcode: string; lucro: number; margem: number }[]; showMargem?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm">
          {rows.map((r, i) => (
            <li key={r.barcode + r.name + i} className="flex justify-between border-b pb-1">
              <span className="truncate pr-2"><span className="text-muted-foreground mr-2">{i + 1}.</span>{r.name || r.barcode}</span>
              <span className={showMargem ? (r.margem >= 0 ? "" : "text-destructive") : (r.lucro >= 0 ? "text-success" : "text-destructive")}>
                {showMargem ? `${r.margem.toFixed(1)}%` : formatBRL(r.lucro)}
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted-foreground text-center py-4">Sem dados</li>}
        </ol>
      </CardContent>
    </Card>
  );
}