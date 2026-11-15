import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StockLayout } from "@/components/stock/StockLayout";
import { InventoryStatusBadge } from "@/components/stock/InventoryStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { dbErrorMessage, formatDateTime } from "@/lib/stock-utils";
import { formatBRL } from "@/lib/sales-utils";

export default function InventoryListPage() {
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [obs, setObs] = useState("");

  const { data: counts = [], isLoading } = useQuery({
    queryKey: ["inventory-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_counts_summary")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_inventory_count", { _observacoes: obs.trim() });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      setNewOpen(false);
      setObs("");
      navigate(`/estoque/inventario/${id}`);
    },
    onError: (err) => toast({ title: "Erro ao abrir contagem", description: dbErrorMessage(err), variant: "destructive" }),
  });

  function open(c: (typeof counts)[number]) {
    const closed = c.status === "FINALIZADA" || c.status === "CANCELADA";
    navigate(`/estoque/inventario/${c.id}${closed ? "/conferencia" : ""}`);
  }

  return (
    <StockLayout title="Inventário" subtitle="Contagens de estoque">
      <Card className="animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Contagens
          </CardTitle>
          <Button onClick={() => setNewOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova contagem
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : counts.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhuma contagem ainda.</p>
          ) : (
            <>
              {/* Celular: cartões */}
              <div className="space-y-2 sm:hidden">
                {counts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => open(c)}
                    className="w-full text-left rounded-lg border p-3 active:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Nº {c.numero}</span>
                      <InventoryStatusBadge status={c.status} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(c.created_at)} · {c.created_by_nome || "-"}
                    </div>
                    <div className="text-sm mt-1">
                      {c.status === "FINALIZADA" ? c.total_itens : c.itens_contados} itens
                      {c.status === "FINALIZADA" && (
                        <>
                          {" "}· {c.total_divergencias} divergências · {formatBRL(Number(c.valor_divergencia))}
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Computador: tabela */}
              <div className="hidden sm:block rounded-lg border overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr className="text-left">
                      <th className="px-3 py-2">Nº</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Responsável</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2 text-right">Itens</th>
                      <th className="px-3 py-2 text-right">Divergências</th>
                      <th className="px-3 py-2 text-right">Valor divergência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counts.map((c) => (
                      <tr key={c.id} className="border-t cursor-pointer hover:bg-muted/50" onClick={() => open(c)}>
                        <td className="px-3 py-2 font-semibold">{c.numero}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(c.created_at)}</td>
                        <td className="px-3 py-2">{c.created_by_nome || "-"}</td>
                        <td className="px-3 py-2">
                          <InventoryStatusBadge status={c.status} />
                        </td>
                        <td className="px-3 py-2">{c.tipo ? <Badge variant="outline">{c.tipo}</Badge> : "-"}</td>
                        <td className="px-3 py-2 text-right">
                          {c.status === "FINALIZADA" ? c.total_itens : c.itens_contados}
                        </td>
                        <td className="px-3 py-2 text-right">{c.total_divergencias ?? "-"}</td>
                        <td className="px-3 py-2 text-right">
                          {c.valor_divergencia != null ? formatBRL(Number(c.valor_divergencia)) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova contagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="inv-obs">
              Observação (opcional)
            </label>
            <Input
              id="inv-obs"
              placeholder="Ex.: Inventário geral de novembro"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Vários aparelhos podem contar ao mesmo tempo nesta contagem. O ideal é contar com a loja fechada, pois
              vendas durante a contagem alteram o saldo do sistema.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Abrir contagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StockLayout>
  );
}
