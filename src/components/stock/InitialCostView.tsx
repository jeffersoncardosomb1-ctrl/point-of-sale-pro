import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { dbErrorMessage, formatCost, formatQty } from "@/lib/stock-utils";

/**
 * Prévia do custo médio inicial calculado a partir do histórico de notas de entrada.
 * Nada é gravado até o administrador selecionar os produtos e confirmar.
 */
export function InitialCostView() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["initial-avg-cost"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("preview_initial_avg_cost");
      if (error) throw error;
      return data || [];
    },
    enabled: false,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!onlyDiff || Math.abs(Number(r.diferenca)) >= 0.0001) &&
        (!q || r.product_name.toLowerCase().includes(q) || r.barcode.includes(q))
    );
  }, [rows, onlyDiff, search]);

  const apply = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.rpc("apply_initial_avg_cost", { _product_ids: ids });
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => {
      toast({ title: "Custo médio gravado", description: `${n} produto(s) atualizados.` });
      setSelected(new Set());
      refetch();
      queryClient.invalidateQueries({ queryKey: ["stock-products"] });
    },
    onError: (err) => toast({ title: "Erro ao gravar", description: dbErrorMessage(err), variant: "destructive" }),
  });

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.product_id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((r) => next.delete(r.product_id));
      else filtered.forEach((r) => next.add(r.product_id));
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Custo médio inicial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Reprocessa as notas de entrada já lançadas (exceto estornadas) e as vendas ativas, em ordem cronológica,
          aplicando o custo médio ponderado. Confira a prévia, selecione os produtos e só então grave.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
            Calcular prévia
          </Button>
          <Input
            className="w-full sm:w-64"
            placeholder="Filtrar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyDiff} onCheckedChange={(v) => setOnlyDiff(v === true)} />
            Só com diferença
          </label>
          <Button
            className="sm:ml-auto"
            variant="default"
            disabled={selected.size === 0 || apply.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {apply.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Gravar selecionados ({selected.size})
          </Button>
        </div>

        {!isLoading && rows.length === 0 && !isFetching && (
          <p className="text-sm text-muted-foreground">Clique em "Calcular prévia" para ver o resultado.</p>
        )}

        {rows.length > 0 && (
          <div className="rounded-lg border overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-right">Entradas</th>
                  <th className="px-3 py-2 text-right">Custo atual</th>
                  <th className="px-3 py-2 text-right">Custo calculado</th>
                  <th className="px-3 py-2 text-right">Média simples</th>
                  <th className="px-3 py-2 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.product_id} className="border-t">
                    <td className="px-3 py-2">
                      <Checkbox checked={selected.has(r.product_id)} onCheckedChange={() => toggle(r.product_id)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.product_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.barcode}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{formatQty(r.saldo_atual)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.qtd_entradas} ({formatQty(r.qtd_comprada)} un)
                    </td>
                    <td className="px-3 py-2 text-right">{formatCost(r.custo_atual)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCost(r.custo_calculado)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{formatCost(r.media_simples)}</td>
                    <td
                      className={`px-3 py-2 text-right ${Number(r.diferenca) > 0 ? "text-success" : Number(r.diferenca) < 0 ? "text-destructive" : ""}`}
                    >
                      {formatCost(r.diferenca)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum produto com diferença.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gravar custo médio?</AlertDialogTitle>
            <AlertDialogDescription>
              O custo médio de {selected.size} produto(s) será substituído pelo valor calculado. Cada alteração fica
              registrada no Kardex como ajuste manual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => apply.mutate(Array.from(selected))}>Gravar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
