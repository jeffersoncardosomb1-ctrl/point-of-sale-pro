import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Camera, Download, Loader2, RefreshCw, ScanBarcode, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StockLayout } from "@/components/stock/StockLayout";
import { CameraScanner } from "@/components/stock/CameraScanner";
import { ProductKardexDialog } from "@/components/stock/ProductKardexDialog";
import { CatalogProduct, useProductCatalog } from "@/hooks/useProductCatalog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/sales-utils";
import { dbErrorMessage, exportRows, formatCost, formatQty } from "@/lib/stock-utils";
import { cn } from "@/lib/utils";

type SaldoFilter = "todos" | "positivo" | "zerado" | "negativo" | "a_identificar";
const PAGE = 200;

export default function StockPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const catalog = useProductCatalog();
  const [search, setSearch] = useState("");
  const [saldo, setSaldo] = useState<SaldoFilter>("todos");
  const [category, setCategory] = useState("__all");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const alternatesByProduct = useMemo(() => {
    const m = new Map<string, string[]>();
    catalog.alternates.forEach((a) => m.set(a.product_id, [...(m.get(a.product_id) || []), a.barcode]));
    return m;
  }, [catalog.alternates]);

  const categories = useMemo(
    () => Array.from(new Set(catalog.products.map((p) => p.category).filter(Boolean))).sort(),
    [catalog.products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.products.filter((p) => {
      const stock = Number(p.stock);
      if (saldo === "positivo" && !(stock > 0)) return false;
      if (saldo === "zerado" && stock !== 0) return false;
      if (saldo === "negativo" && !(stock < 0)) return false;
      if (saldo === "a_identificar" && !p.pendente_identificacao) return false;
      if (category !== "__all" && p.category !== category) return false;
      if (
        q &&
        !p.product_name.toLowerCase().includes(q) &&
        !p.barcode.includes(q) &&
        !(alternatesByProduct.get(p.id) || []).some((b) => b.includes(q))
      )
        return false;
      return true;
    });
  }, [catalog.products, search, saldo, category, alternatesByProduct]);

  const totals = useMemo(() => {
    const sum = (list: CatalogProduct[]) =>
      list.reduce(
        (acc, p) => {
          const s = Number(p.stock);
          acc.valor += Math.max(s, 0) * Number(p.cost_avg);
          acc.unidades += Math.max(s, 0);
          if (s < 0) acc.negativos += 1;
          if (s === 0) acc.zerados += 1;
          if (p.pendente_identificacao) acc.pendentes += 1;
          return acc;
        },
        { valor: 0, unidades: 0, negativos: 0, zerados: 0, pendentes: 0 }
      );
    return { geral: sum(catalog.products), filtro: sum(filtered) };
  }, [catalog.products, filtered]);

  const settingsQuery = useQuery({
    queryKey: ["stock-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (bloquear: boolean) => {
      const { error } = await supabase
        .from("stock_settings")
        .update({ bloquear_venda_sem_saldo: bloquear, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: (_, bloquear) => {
      toast({
        title: "Configuração salva",
        description: bloquear ? "Vendas acima do saldo serão bloqueadas." : "Vendas acima do saldo apenas geram aviso.",
      });
      queryClient.invalidateQueries({ queryKey: ["stock-settings"] });
    },
    onError: (err) => toast({ title: "Erro", description: dbErrorMessage(err), variant: "destructive" }),
  });

  function handleScan(e: FormEvent) {
    e.preventDefault();
    const p = catalog.findByBarcode(search);
    if (p) setSelected(p);
  }

  function handleExport(format: "csv" | "xlsx") {
    exportRows(
      filtered.map((p) => ({
        Código: p.barcode,
        Produto: p.product_name,
        Categoria: p.category,
        Saldo: Number(p.stock),
        "Custo médio": Number(p.cost_avg),
        "Valor total": Math.round(Math.max(Number(p.stock), 0) * Number(p.cost_avg) * 100) / 100,
        "Preço de venda": Number(p.price),
        "A identificar": p.pendente_identificacao ? "Sim" : "",
      })),
      `estoque-${new Date().toISOString().slice(0, 10)}`,
      format
    );
  }

  return (
    <StockLayout title="Estoque" subtitle="Saldo, custo médio e valor em estoque">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Valor total em estoque" value={formatBRL(totals.geral.valor)} strong />
        <Tile label="Unidades em estoque" value={formatQty(totals.geral.unidades)} hint={`${catalog.products.length} produtos`} />
        <Tile label="Saldo negativo" value={String(totals.geral.negativos)} tone={totals.geral.negativos ? "neg" : undefined} />
        <Tile label="A identificar" value={String(totals.geral.pendentes)} tone={totals.geral.pendentes ? "warn" : undefined} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Boxes className="h-5 w-5 text-primary" />
            Produtos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="Buscar por nome ou código (aceita leitor)"
                className="pl-9 h-11"
                autoFocus
              />
            </div>
            <Button type="button" variant="outline" className="h-11 w-11 p-0" onClick={() => setCameraOpen(true)} aria-label="Escanear com câmera">
              <Camera className="h-5 w-5" />
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={saldo} onValueChange={(v) => { setSaldo(v as SaldoFilter); setLimit(PAGE); }}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os saldos</SelectItem>
                <SelectItem value="positivo">Com saldo</SelectItem>
                <SelectItem value="zerado">Zerados</SelectItem>
                <SelectItem value="negativo">Negativos</SelectItem>
                <SelectItem value="a_identificar">A identificar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={(v) => { setCategory(v); setLimit(PAGE); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" size="sm" onClick={() => catalog.refetch()} disabled={catalog.isFetching} className="gap-1">
                <RefreshCw className={cn("h-4 w-4", catalog.isFetching && "animate-spin")} /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-1">
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")} className="gap-1">
                <Download className="h-4 w-4" /> Excel
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {filtered.length} produto(s) no filtro · valor {formatBRL(totals.filtro.valor)}
          </div>

          {catalog.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Celular */}
              <ul className="sm:hidden divide-y rounded-lg border">
                {filtered.slice(0, limit).map((p) => (
                  <li key={p.id}>
                    <button className="w-full text-left p-3 active:bg-muted" onClick={() => setSelected(p)}>
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium leading-tight break-words">{p.product_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{p.barcode}</div>
                        </div>
                        <div className={cn("text-xl font-bold tabular-nums", Number(p.stock) < 0 && "text-destructive")}>
                          {formatQty(p.stock)}
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Custo {formatCost(p.cost_avg)}</span>
                        <span>Valor {formatBRL(Math.max(Number(p.stock), 0) * Number(p.cost_avg))}</span>
                      </div>
                      {p.pendente_identificacao && (
                        <Badge variant="outline" className="mt-1 border-amber-400 text-amber-700">A identificar</Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Computador */}
              <div className="hidden sm:block rounded-lg border overflow-auto max-h-[65vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2">Categoria</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                      <th className="px-3 py-2 text-right">Custo médio</th>
                      <th className="px-3 py-2 text-right">Valor total</th>
                      <th className="px-3 py-2 text-right">Preço venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, limit).map((p) => (
                      <tr key={p.id} className="border-t cursor-pointer hover:bg-muted/50" onClick={() => setSelected(p)}>
                        <td className="px-3 py-2 font-mono text-xs">{p.barcode}</td>
                        <td className="px-3 py-2">
                          {p.product_name}
                          {p.pendente_identificacao && (
                            <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700">A identificar</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{p.category || "-"}</td>
                        <td className={cn("px-3 py-2 text-right font-semibold", Number(p.stock) < 0 && "text-destructive")}>
                          {formatQty(p.stock)}
                        </td>
                        <td className="px-3 py-2 text-right">{formatCost(p.cost_avg)}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(Math.max(Number(p.stock), 0) * Number(p.cost_avg))}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatBRL(p.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/60 font-semibold sticky bottom-0">
                    <tr>
                      <td className="px-3 py-2" colSpan={3}>
                        Total do filtro
                      </td>
                      <td className="px-3 py-2 text-right">{formatQty(totals.filtro.unidades)}</td>
                      <td />
                      <td className="px-3 py-2 text-right">{formatBRL(totals.filtro.valor)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {filtered.length > limit && (
                <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
                  Mostrar mais ({filtered.length - limit} restantes)
                </Button>
              )}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum produto encontrado.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Settings2 className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Bloquear venda acima do saldo</div>
                <div className="text-sm text-muted-foreground">
                  Desligado: a venda é permitida com aviso e o saldo pode ficar negativo. Ligado: o sistema recusa a venda.
                </div>
              </div>
            </div>
            <Switch
              checked={settingsQuery.data?.bloquear_venda_sem_saldo ?? false}
              disabled={settingsQuery.isLoading || updateSettings.isPending}
              onCheckedChange={(v) => updateSettings.mutate(v)}
            />
          </CardContent>
        </Card>
      )}

      <ProductKardexDialog product={selected} onClose={() => setSelected(null)} />
      <CameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetected={(code) => {
          setSearch(code);
          const p = catalog.findByBarcode(code);
          if (p) setSelected(p);
          else toast({ title: "Código não cadastrado", description: code });
        }}
      />
    </StockLayout>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neg" | "warn";
  strong?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-3", strong && "border-primary/40")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-lg sm:text-xl font-bold",
          tone === "neg" && "text-destructive",
          tone === "warn" && "text-amber-600"
        )}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
