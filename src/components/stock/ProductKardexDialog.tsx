import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CatalogProduct } from "@/hooks/useProductCatalog";
import { formatBRL } from "@/lib/sales-utils";
import { MOVEMENT_LABELS, formatCost, formatDateTime, formatQty } from "@/lib/stock-utils";
import { cn } from "@/lib/utils";

const DOC_LABELS: Record<string, string> = {
  sale: "Venda",
  purchase_entry: "Nota",
  inventory_count: "Inventário",
  product_merge: "Mesclagem",
  initial_avg_cost: "Custo inicial",
  identify_product: "Identificação",
};

interface ProductKardexDialogProps {
  product: CatalogProduct | null;
  onClose: () => void;
}

/** Kardex de um produto: cada movimento com saldo e custo médio resultantes. */
export function ProductKardexDialog({ product, onClose }: ProductKardexDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-kardex", product?.id],
    enabled: !!product,
    queryFn: async () => {
      const [movs, alts] = await Promise.all([
        supabase
          .from("stock_movements")
          .select("*")
          .eq("product_id", product!.id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("product_barcodes").select("barcode").eq("product_id", product!.id),
      ]);
      if (movs.error) throw movs.error;
      if (alts.error) throw alts.error;
      return { movements: movs.data || [], alternates: (alts.data || []).map((a) => a.barcode) };
    },
  });

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Kardex — {product?.product_name}
          </DialogTitle>
        </DialogHeader>

        {product && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Info label="Código" value={<span className="font-mono">{product.barcode}</span>} />
            <Info label="Saldo atual" value={formatQty(product.stock)} />
            <Info label="Custo médio" value={formatCost(product.cost_avg)} />
            <Info label="Valor em estoque" value={formatBRL(Math.max(product.stock, 0) * product.cost_avg)} />
            {data && data.alternates.length > 0 && (
              <div className="col-span-2 sm:col-span-4 text-xs text-muted-foreground">
                Códigos alternativos: <span className="font-mono">{data.alternates.join(", ")}</span>
              </div>
            )}
          </div>
        )}

        <div className="overflow-auto rounded-lg border flex-1 min-h-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-right">Custo unit.</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-right">Custo médio</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Usuário</th>
                </tr>
              </thead>
              <tbody>
                {data?.movements.map((m) => {
                  const q = Number(m.quantidade);
                  return (
                    <tr key={m.id} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTime(m.created_at)}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "whitespace-nowrap",
                            q > 0 && "text-success border-success/30",
                            q < 0 && "text-destructive border-destructive/30"
                          )}
                        >
                          {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                        </Badge>
                      </td>
                      <td className={cn("px-3 py-2 text-right font-medium", q < 0 && "text-destructive", q > 0 && "text-success")}>
                        {q > 0 ? "+" : ""}
                        {formatQty(q)}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCost(m.custo_unitario)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="text-muted-foreground">{formatQty(m.saldo_anterior)} → </span>
                        <span className={cn("font-semibold", Number(m.estoque_apos) < 0 && "text-destructive")}>
                          {formatQty(m.estoque_apos)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{formatCost(m.custo_medio_apos)}</td>
                      <td className="px-3 py-2 text-xs">
                        {DOC_LABELS[m.reference_type] || m.reference_type || "-"}
                        {m.observacoes && <div className="text-muted-foreground">{m.observacoes}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {m.usuario_nome || "-"}
                        {m.device_info && <div className="text-muted-foreground">{m.device_info}</div>}
                      </td>
                    </tr>
                  );
                })}
                {data?.movements.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Sem movimentações.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
