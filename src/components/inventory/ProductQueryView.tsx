import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search, PackageSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/sales-utils";
import { toast } from "@/hooks/use-toast";

interface ProductRow {
  id: string;
  barcode: string;
  product_name: string;
  price: number;
  cost_avg: number;
  stock: number;
  ultima_venda: string | null;
  ultima_compra: string | null;
}

function formatDateBR(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ProductQueryView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    const q = query.trim();
    if (!q) {
      toast({ title: "Digite um nome ou código de barras para buscar." });
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, barcode, product_name, price, cost_avg, stock")
        .or(`product_name.ilike.%${q}%,barcode.ilike.%${q}%`)
        .order("product_name", { ascending: true })
        .limit(50);
      if (error) throw error;

      const barcodes = (products || []).map((p) => p.barcode);
      let lastSaleByBarcode = new Map<string, string>();
      let lastPurchaseByBarcode = new Map<string, string>();

      if (barcodes.length > 0) {
        const [salesRes, purchasesRes] = await Promise.all([
          supabase
            .from("sales")
            .select("barcode, created_at")
            .in("barcode", barcodes)
            .eq("status", "ATIVA")
            .order("created_at", { ascending: false })
            .limit(2000),
          supabase
            .from("purchase_items")
            .select("barcode, created_at")
            .in("barcode", barcodes)
            .order("created_at", { ascending: false })
            .limit(2000),
        ]);

        (salesRes.data || []).forEach((s) => {
          if (!lastSaleByBarcode.has(s.barcode)) lastSaleByBarcode.set(s.barcode, s.created_at);
        });
        (purchasesRes.data || []).forEach((p) => {
          if (!lastPurchaseByBarcode.has(p.barcode)) lastPurchaseByBarcode.set(p.barcode, p.created_at);
        });
      }

      const result: ProductRow[] = (products || []).map((p) => ({
        id: p.id,
        barcode: p.barcode,
        product_name: p.product_name,
        price: Number(p.price) || 0,
        cost_avg: Number(p.cost_avg) || 0,
        stock: Number(p.stock) || 0,
        ultima_venda: lastSaleByBarcode.get(p.barcode) || null,
        ultima_compra: lastPurchaseByBarcode.get(p.barcode) || null,
      }));

      setRows(result);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro na busca", description: err?.message || "Falha ao consultar produtos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-primary" />
          Consulta de Produtos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-48 space-y-1">
            <Label className="text-xs">Nome do produto ou código de barras</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Digite parte do nome ou o código de barras"
              autoComplete="off"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </div>

        <div className="overflow-auto max-h-[600px] rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Última venda</th>
                <th className="px-3 py-2">Última compra</th>
                <th className="px-3 py-2 text-right">Custo médio</th>
                <th className="px-3 py-2 text-right">Valor de venda</th>
                <th className="px-3 py-2 text-right">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{r.barcode}</td>
                  <td className="px-3 py-2">{r.product_name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(r.ultima_venda)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(r.ultima_compra)}</td>
                  <td className="px-3 py-2 text-right">{formatBRL(r.cost_avg)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatBRL(r.price)}</td>
                  <td className={`px-3 py-2 text-right ${r.stock < 0 ? "text-destructive" : ""}`}>{r.stock}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    {searched ? "Nenhum produto encontrado." : "Informe um nome ou código de barras e clique em Buscar."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
