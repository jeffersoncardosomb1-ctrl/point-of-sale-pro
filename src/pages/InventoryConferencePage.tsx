import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCheck,
  ClipboardList,
  Download,
  Loader2,
  Lock,
  ScanBarcode,
  Search,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StockLayout } from "@/components/stock/StockLayout";
import { InventoryStatusBadge } from "@/components/stock/InventoryStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { fetchAllRows } from "@/hooks/useProductCatalog";
import { dbErrorMessage, exportRows, formatCost, formatDateTime, formatQty } from "@/lib/stock-utils";
import { formatBRL } from "@/lib/sales-utils";
import { cn } from "@/lib/utils";

type Tipo = "TOTAL" | "PARCIAL";
type Filter = "todos" | "divergencias" | "nao_contados" | "a_identificar";

interface ConfRow {
  key: string;
  product_name: string;
  barcode: string;
  category: string;
  a_identificar: boolean;
  pendente: boolean;
  contado: boolean;
  ajusta: boolean;
  saldo_sistema: number;
  quantidade_contada: number;
  diferenca: number;
  custo_medio: number;
  valor_diferenca: number;
}

export default function InventoryConferencePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canManageStock } = useAuth();
  const [tipo, setTipo] = useState<Tipo>("PARCIAL");
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<"finalizar" | "cancelar" | null>(null);

  const countQuery = useQuery({
    queryKey: ["inventory-count", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_counts").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const count = countQuery.data;
  const closed = count?.status === "FINALIZADA" || count?.status === "CANCELADA";
  const finalized = count?.status === "FINALIZADA";

  // Conferência ao vivo (contagem aberta)
  const liveQuery = useQuery({
    queryKey: ["inventory-conference", id, tipo],
    enabled: !!count && !finalized,
    refetchInterval: closed ? false : 15_000,
    queryFn: async (): Promise<ConfRow[]> => {
      const rows = await fetchAllRows((from, to) =>
        supabase
          .rpc("get_inventory_conference", { _count_id: id, _tipo: tipo })
          .order("product_name")
          .order("barcode")
          .range(from, to)
      );
      return rows.map((r) => ({
        key: r.product_id ?? `code:${r.barcode}`,
        product_name: r.product_name,
        barcode: r.barcode,
        category: r.category,
        a_identificar: r.a_identificar,
        pendente: r.pendente_identificacao,
        contado: r.contado,
        ajusta: r.ajusta,
        saldo_sistema: Number(r.saldo_sistema),
        quantidade_contada: Number(r.quantidade_contada),
        diferenca: Number(r.diferenca),
        custo_medio: Number(r.custo_medio),
        valor_diferenca: Number(r.valor_diferenca),
      }));
    },
  });

  // Fotografia gravada no fechamento (contagem finalizada)
  const snapshotQuery = useQuery({
    queryKey: ["inventory-snapshot", id],
    enabled: finalized,
    queryFn: async (): Promise<ConfRow[]> => {
      const rows = await fetchAllRows((from, to) =>
        supabase
          .from("inventory_count_items")
          .select("*")
          .eq("count_id", id)
          .order("product_name")
          .range(from, to)
      );
      return rows.map((r) => ({
        key: r.id,
        product_name: r.product_name,
        barcode: r.barcode,
        category: "",
        a_identificar: r.a_identificar,
        pendente: r.a_identificar,
        contado: r.contado,
        ajusta: true,
        saldo_sistema: Number(r.saldo_sistema_no_fechamento),
        quantidade_contada: Number(r.quantidade_contada),
        diferenca: Number(r.diferenca),
        custo_medio: Number(r.custo_medio),
        valor_diferenca: Number(r.valor_diferenca),
      }));
    },
  });

  const rows = useMemo(
    () => (finalized ? snapshotQuery.data : liveQuery.data) ?? [],
    [finalized, snapshotQuery.data, liveQuery.data]
  );

  const totals = useMemo(() => {
    let antes = 0;
    let depois = 0;
    let divergencia = 0;
    let divergentes = 0;
    let naoContados = 0;
    let aIdentificar = 0;
    let contados = 0;
    for (const r of rows) {
      antes += Math.max(r.saldo_sistema, 0) * r.custo_medio;
      depois += Math.max(r.ajusta ? r.quantidade_contada : r.saldo_sistema, 0) * r.custo_medio;
      divergencia += r.valor_diferenca;
      if (r.ajusta && r.diferenca !== 0) divergentes += 1;
      if (!r.contado) naoContados += 1;
      else contados += 1;
      if (r.a_identificar) aIdentificar += 1;
    }
    return { antes, depois, divergencia, divergentes, naoContados, aIdentificar, contados };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "divergencias" && !(r.ajusta && r.diferenca !== 0)) return false;
      if (filter === "nao_contados" && r.contado) return false;
      if (filter === "a_identificar" && !r.a_identificar) return false;
      if (q && !r.product_name.toLowerCase().includes(q) && !r.barcode.includes(q)) return false;
      return true;
    });
  }, [rows, filter, search]);

  const finalize = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("finalize_inventory", { _count_id: id, _tipo: tipo });
      if (error) throw error;
      return data as { itens: number; divergencias: number; produtos_criados: number };
    },
    onSuccess: (r) => {
      toast({
        title: "Inventário finalizado",
        description: `${r.itens} itens contados, ${r.divergencias} ajustes${r.produtos_criados ? `, ${r.produtos_criados} produto(s) a identificar criados` : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory-count", id] });
      queryClient.invalidateQueries({ queryKey: ["inventory-counts"] });
      queryClient.invalidateQueries({ queryKey: ["stock-products"] });
    },
    onError: (err) => {
      toast({ title: "Não foi possível finalizar", description: dbErrorMessage(err), variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["inventory-count", id] });
    },
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancel_inventory", { _count_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contagem cancelada" });
      queryClient.invalidateQueries({ queryKey: ["inventory-count", id] });
      queryClient.invalidateQueries({ queryKey: ["inventory-counts"] });
    },
    onError: (err) => toast({ title: "Erro", description: dbErrorMessage(err), variant: "destructive" }),
  });

  const backToCount = useMutation({
    mutationFn: async () => {
      if (count?.status === "EM_CONFERENCIA") {
        const { error } = await supabase.rpc("set_inventory_status", { _count_id: id, _status: "ABERTA" });
        if (error) throw error;
      }
    },
    onSuccess: () => navigate(`/estoque/inventario/${id}`),
    onError: (err) => toast({ title: "Erro", description: dbErrorMessage(err), variant: "destructive" }),
  });

  function handleExport(format: "csv" | "xlsx") {
    exportRows(
      filtered.map((r) => ({
        Produto: r.product_name,
        Código: r.barcode,
        "Saldo sistema": r.saldo_sistema,
        Contado: r.contado ? r.quantidade_contada : "",
        Diferença: r.diferenca,
        "Custo médio": r.custo_medio,
        "Diferença R$": r.valor_diferenca,
        Situação: r.a_identificar ? "A identificar" : r.contado ? "Contado" : "Não contado",
      })),
      `inventario-${count?.numero ?? id}-conferencia`,
      format
    );
  }

  const loading = countQuery.isLoading || (finalized ? snapshotQuery.isLoading : liveQuery.isLoading);

  if (countQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!count) {
    return (
      <StockLayout title="Conferência" backTo="/estoque/inventario">
        <p className="text-muted-foreground">Contagem não encontrada.</p>
      </StockLayout>
    );
  }

  const valorAntes = finalized ? Number(count.valor_antes) : totals.antes;
  const valorDepois = finalized ? Number(count.valor_depois) : totals.depois;
  const valorDiv = finalized ? Number(count.valor_divergencia) : totals.divergencia;

  return (
    <StockLayout
      title={`Conferência · Contagem nº ${count.numero}`}
      subtitle={count.observacoes || formatDateTime(count.created_at)}
      backTo="/estoque/inventario"
    >
      <div className="flex flex-wrap items-center gap-2">
        <InventoryStatusBadge status={count.status} />
        {count.tipo && <Badge variant="outline">{count.tipo}</Badge>}
        {finalized && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Finalizada em {formatDateTime(count.finalized_at)} por {count.finalized_by_nome || "-"} · somente leitura
          </span>
        )}
        {!closed && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-2"
            onClick={() => backToCount.mutate()}
            disabled={backToCount.isPending}
          >
            <ScanBarcode className="h-4 w-4" />
            Voltar a contar
          </Button>
        )}
      </div>

      {!closed && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="font-medium">Tipo de contagem</div>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setTipo(v as Tipo)}
              className="grid gap-2 sm:grid-cols-2"
            >
              <Label
                htmlFor="tipo-parcial"
                className={cn("flex gap-3 rounded-lg border p-3 cursor-pointer", tipo === "PARCIAL" && "border-primary bg-primary/5")}
              >
                <RadioGroupItem value="PARCIAL" id="tipo-parcial" className="mt-1" />
                <span>
                  <span className="font-semibold block">Parcial</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Só os produtos contados são ajustados. Os demais mantêm o saldo.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="tipo-total"
                className={cn("flex gap-3 rounded-lg border p-3 cursor-pointer", tipo === "TOTAL" && "border-destructive bg-destructive/5")}
              >
                <RadioGroupItem value="TOTAL" id="tipo-total" className="mt-1" />
                <span>
                  <span className="font-semibold block">Total</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    Produtos não contados ficam com saldo <strong>zero</strong>.
                  </span>
                </span>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile label="Valor do estoque antes" value={formatBRL(valorAntes)} />
        <SummaryTile label="Valor do estoque depois" value={formatBRL(valorDepois)} />
        <SummaryTile
          label="Valor das divergências"
          value={formatBRL(valorDiv)}
          tone={valorDiv < 0 ? "neg" : valorDiv > 0 ? "pos" : undefined}
        />
        <SummaryTile
          label="Itens"
          value={`${totals.contados} contados`}
          hint={`${totals.divergentes} divergentes · ${totals.naoContados} não contados · ${totals.aIdentificar} a identificar`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Itens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => v && setFilter(v as Filter)}
              className="justify-start flex-wrap"
            >
              <ToggleGroupItem value="todos" size="sm">Todos</ToggleGroupItem>
              <ToggleGroupItem value="divergencias" size="sm">Só divergências</ToggleGroupItem>
              <ToggleGroupItem value="nao_contados" size="sm">Não contados</ToggleGroupItem>
              <ToggleGroupItem value="a_identificar" size="sm">A identificar</ToggleGroupItem>
            </ToggleGroup>
            <div className="relative lg:ml-auto lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-1">
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")} className="gap-1">
                <Download className="h-4 w-4" /> Excel
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Celular */}
              <ul className="sm:hidden divide-y rounded-lg border">
                {filtered.slice(0, 500).map((r) => (
                  <li key={r.key} className={cn("p-3", rowTone(r))}>
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium leading-tight break-words">{r.product_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.barcode}</div>
                      </div>
                      <RowFlag r={r} />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Sistema</div>
                        {formatQty(r.saldo_sistema)}
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Contado</div>
                        {r.contado ? formatQty(r.quantidade_contada) : "-"}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Diferença</div>
                        <DiffValue r={r} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Computador */}
              <div className="hidden sm:block rounded-lg border overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-3 py-2">Produto</th>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2 text-right">Saldo sistema</th>
                      <th className="px-3 py-2 text-right">Contado</th>
                      <th className="px-3 py-2 text-right">Diferença</th>
                      <th className="px-3 py-2 text-right">Custo médio</th>
                      <th className="px-3 py-2 text-right">Diferença R$</th>
                      <th className="px-3 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 2000).map((r) => (
                      <tr key={r.key} className={cn("border-t", rowTone(r))}>
                        <td className="px-3 py-2">{r.product_name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.barcode}</td>
                        <td className="px-3 py-2 text-right">{formatQty(r.saldo_sistema)}</td>
                        <td className="px-3 py-2 text-right">{r.contado ? formatQty(r.quantidade_contada) : "-"}</td>
                        <td className="px-3 py-2 text-right">
                          <DiffValue r={r} qtyOnly />
                        </td>
                        <td className="px-3 py-2 text-right">{formatCost(r.custo_medio)}</td>
                        <td className={cn("px-3 py-2 text-right", r.valor_diferenca < 0 && "text-destructive", r.valor_diferenca > 0 && "text-success")}>
                          {r.ajusta ? formatBRL(r.valor_diferenca) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <RowFlag r={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhum item neste filtro.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {!closed && canManageStock && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pb-6">
          <Button variant="outline" className="gap-2 text-destructive" onClick={() => setConfirm("cancelar")}>
            <XCircle className="h-4 w-4" />
            Cancelar contagem
          </Button>
          <Button
            className="gap-2 h-12 sm:h-10"
            onClick={() => setConfirm("finalizar")}
            disabled={finalize.isPending || liveQuery.isFetching}
          >
            {finalize.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Finalizar inventário ({tipo === "TOTAL" ? "total" : "parcial"})
          </Button>
        </div>
      )}
      {!closed && !canManageStock && (
        <p className="text-sm text-muted-foreground pb-6">
          Somente administradores ou gerentes podem finalizar o inventário.
        </p>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "finalizar" ? "Finalizar inventário?" : "Cancelar contagem?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {confirm === "finalizar" ? (
                <div className="space-y-2">
                  <p>
                    Contagem <strong>{tipo === "TOTAL" ? "TOTAL" : "PARCIAL"}</strong>: {totals.divergentes} produto(s)
                    terão o saldo ajustado, com divergência de <strong>{formatBRL(totals.divergencia)}</strong>.
                  </p>
                  {tipo === "TOTAL" && totals.naoContados > 0 && (
                    <p className="flex gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      {totals.naoContados} produto(s) não contados ficarão com saldo zero.
                    </p>
                  )}
                  {totals.aIdentificar > 0 && (
                    <p>{totals.aIdentificar} código(s) não cadastrados serão criados como "A IDENTIFICAR".</p>
                  )}
                  <p>Depois de finalizada, a contagem fica somente leitura.</p>
                </div>
              ) : (
                <p>A contagem será cancelada sem alterar o estoque. Os lançamentos ficam guardados para consulta.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className={confirm === "cancelar" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (confirm === "finalizar" && !finalize.isPending) finalize.mutate();
                if (confirm === "cancelar" && !cancel.isPending) cancel.mutate();
              }}
            >
              {confirm === "finalizar" ? "Finalizar" : "Cancelar contagem"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StockLayout>
  );
}

function rowTone(r: ConfRow) {
  if (r.a_identificar) return "bg-amber-50 dark:bg-amber-950/20";
  if (r.ajusta && r.diferenca < 0) return "bg-destructive/5";
  if (r.ajusta && r.diferenca > 0) return "bg-success/5";
  return "";
}

function DiffValue({ r, qtyOnly }: { r: ConfRow; qtyOnly?: boolean }) {
  if (!r.ajusta) return <span className="text-muted-foreground">-</span>;
  const cls = r.diferenca < 0 ? "text-destructive font-semibold" : r.diferenca > 0 ? "text-success font-semibold" : "";
  return (
    <span className={cls}>
      {r.diferenca > 0 ? "+" : ""}
      {formatQty(r.diferenca)}
      {!qtyOnly && <span className="block text-xs">{formatBRL(r.valor_diferenca)}</span>}
    </span>
  );
}

function RowFlag({ r }: { r: ConfRow }) {
  if (r.a_identificar)
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-700 whitespace-nowrap">
        A identificar
      </Badge>
    );
  if (!r.contado)
    return (
      <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">
        Não contado
      </Badge>
    );
  if (r.diferenca !== 0)
    return (
      <Badge variant="outline" className="gap-1 whitespace-nowrap">
        <ArrowLeftRight className="h-3 w-3" /> Divergente
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-success border-success/30 whitespace-nowrap">
      OK
    </Badge>
  );
}

function SummaryTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-bold", tone === "neg" && "text-destructive", tone === "pos" && "text-success")}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
