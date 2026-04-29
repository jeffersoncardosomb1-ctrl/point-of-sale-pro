import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Tag } from "lucide-react";

interface ProductInfo {
  id: string;
  barcode: string;
  product_name: string;
  price: number;
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export function UpdatePriceView() {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  async function handleSearch(code?: string) {
    const q = (code ?? barcode).trim();
    if (!q) return;
    setSearching(true);
    setProduct(null);
    setNewPrice("");
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, barcode, product_name, price")
        .eq("barcode", q)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Produto não encontrado para o código informado.");
        return;
      }
      setProduct(data as ProductInfo);
      setNewPrice(String(Number(data.price ?? 0).toFixed(2)).replace(".", ","));
      setTimeout(() => priceRef.current?.focus(), 50);
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar produto.");
    } finally {
      setSearching(false);
    }
  }

  async function handleUpdate() {
    if (!product) return;
    const parsed = Number(newPrice.replace(",", "."));
    if (!isFinite(parsed) || parsed <= 0) {
      toast.error("Informe um valor de venda válido.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ price: parsed })
        .eq("id", product.id);
      if (error) throw error;
      toast.success(`Valor atualizado para ${formatBRL(parsed)}.`);
      setProduct(null);
      setBarcode("");
      setNewPrice("");
      setTimeout(() => barcodeRef.current?.focus(), 50);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar produto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Atualizar valor de venda do produto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="barcode">Código de barras</Label>
          <div className="flex gap-2">
            <Input
              id="barcode"
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Bipe ou digite o código de barras"
              autoComplete="off"
            />
            <Button onClick={() => handleSearch()} disabled={searching || !barcode.trim()} className="gap-2">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>
        </div>

        {product && (
          <div className="rounded-md border p-4 space-y-4 bg-muted/30">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Produto</p>
                <p className="font-medium">{product.product_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="font-mono">{product.barcode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor atual</p>
                <p className="font-semibold">{formatBRL(Number(product.price) || 0)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPrice">Valor corrigido</Label>
              <Input
                id="newPrice"
                ref={priceRef}
                inputMode="decimal"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUpdate();
                  }
                }}
                placeholder="0,00"
              />
            </div>

            <Button onClick={handleUpdate} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
              Atualizar cadastro produto
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}