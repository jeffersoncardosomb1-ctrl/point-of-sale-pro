import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ReceiptText, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/sales-utils";
import { dbErrorMessage, formatDateTime, formatQty } from "@/lib/stock-utils";

type Entry = Tables<"purchase_entries">;

/** Últimas notas de entrada, com estorno (reverte saldo e custo médio). */
export function PurchaseEntriesList({ refreshKey = "" }: { refreshKey?: string }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Entry | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["purchase-entries", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const reverse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reverse_purchase_entry", { _entry_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Nota estornada", description: "Saldo e custo médio foram revertidos." });
      queryClient.invalidateQueries({ queryKey: ["purchase-entries"] });
      queryClient.invalidateQueries({ queryKey: ["stock-products"] });
    },
    onError: (err) => toast({ title: "Erro ao estornar", description: dbErrorMessage(err), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ReceiptText className="h-5 w-5 text-primary" />
          Notas lançadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma nota lançada.</p>
        ) : (
          <div className="rounded-lg border overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Arquivo</th>
                  <th className="px-3 py-2 text-right">Itens</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-right">Custo total</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                    <td className="px-3 py-2">{e.file_name || `#${e.id.slice(0, 8)}`}</td>
                    <td className="px-3 py-2 text-right">{e.total_items}</td>
                    <td className="px-3 py-2 text-right">{formatQty(e.total_quantity)}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(e.total_cost)}</td>
                    <td className="px-3 py-2">
                      {e.status === "ESTORNADA" ? (
                        <Badge variant="outline" className="text-destructive border-destructive/30">
                          Estornada {e.estornada_at ? `em ${formatDateTime(e.estornada_at)}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-success border-success/30">Ativa</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {e.status !== "ESTORNADA" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive"
                          onClick={() => setTarget(e)}
                          disabled={reverse.isPending}
                        >
                          <Undo2 className="h-4 w-4" />
                          Estornar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar nota?</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.file_name || "A nota"} ({target?.total_items} itens, {formatBRL(target?.total_cost ?? 0)}) será
              estornada: as quantidades saem do estoque e o custo médio é recalculado sem esta entrada. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => target && reverse.mutate(target.id)}
            >
              Estornar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
