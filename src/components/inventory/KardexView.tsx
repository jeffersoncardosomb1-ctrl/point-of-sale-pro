import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Loader2, ArrowDown, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/sales-utils";
import { MOVEMENT_LABELS } from "@/lib/stock-utils";

interface MovementRow {
  id: string;
  created_at: string;
  movement_type: string;
  barcode: string;
  product_name: string;
  quantidade: number;
  custo_unitario: number;
  custo_medio_apos: number;
  estoque_apos: number;
  saldo_anterior: number;
  usuario_nome: string;
  reference_type: string;
}

export function KardexView() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("stock_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (filter.trim()) {
        const f = filter.trim().replace(/[,()]/g, " ");
        q = q.or(`barcode.ilike.%${f}%,product_name.ilike.%${f}%`);
      }
      const { data, error } = await q;
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

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Histórico de Movimentações (Kardex)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-48 space-y-1">
            <Label className="text-xs">Filtrar por código ou nome</Label>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Digite o código..." />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Buscar
          </Button>
        </div>

        <div className="overflow-auto max-h-[600px] rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">Custo unit.</th>
                <th className="px-3 py-2 text-right">Custo médio após</th>
                <th className="px-3 py-2 text-right">Saldo anterior</th>
                <th className="px-3 py-2 text-right">Estoque após</th>
                <th className="px-3 py-2">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">
                    {Number(r.quantidade) >= 0 ? (
                      <Badge variant="outline" className="gap-1 text-success border-success/30 whitespace-nowrap">
                        <ArrowDown className="h-3 w-3" /> {MOVEMENT_LABELS[r.movement_type] || r.movement_type}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-destructive border-destructive/30 whitespace-nowrap">
                        <ArrowUp className="h-3 w-3" /> {MOVEMENT_LABELS[r.movement_type] || r.movement_type}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.barcode}</td>
                  <td className="px-3 py-2">{r.product_name}</td>
                  <td className="px-3 py-2 text-right">{Number(r.quantidade) > 0 ? "+" : ""}{Number(r.quantidade)}</td>
                  <td className="px-3 py-2 text-right">{formatBRL(Number(r.custo_unitario))}</td>
                  <td className="px-3 py-2 text-right">{formatBRL(Number(r.custo_medio_apos))}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{Number(r.saldo_anterior)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${Number(r.estoque_apos) < 0 ? "text-destructive" : ""}`}>
                    {Number(r.estoque_apos)}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.usuario_nome || "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Sem movimentações.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}