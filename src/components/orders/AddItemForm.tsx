import { useState, useMemo, useEffect } from "react";
import { Plus, Camera, Trash2, Loader2, AlertTriangle, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScannerModal } from "@/components/sales/ScannerModal";
import { OrderItem } from "@/types/order";
import { safeNumber, uuid } from "@/lib/sales-utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client"; // Importar supabase

interface AddItemFormProps {
  onAddItem: (item: OrderItem) => void;
  /** Itens já no pedido, para descontar do saldo disponível. */
  cartItems?: OrderItem[];
}

interface StockInfo {
  barcode: string;
  stock: number;
  pendente: boolean;
}

export function AddItemForm({ onAddItem, cartItems = [] }: AddItemFormProps) {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const { data: settings } = useQuery({
    queryKey: ["stock-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
  const bloquearSemSaldo = settings?.bloquear_venda_sem_saldo === true;
  const [barcode, setBarcode] = useState("");
  const [productName, setProductName] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [productFoundBySearch, setProductFoundBySearch] = useState(false); // Novo estado para rastrear se o produto foi encontrado pela busca

  const calc = useMemo(() => {
    const qt = safeNumber(quantidade);
    const vu = safeNumber(valorUnitario);
    const descPct = safeNumber(descontoPercentual);
    const totalBruto = qt * vu;
    const desconto = totalBruto * (descPct / 100);
    const totalLiquido = totalBruto - desconto;
    return { totalBruto, desconto, totalLiquido };
  }, [quantidade, valorUnitario, descontoPercentual]);

  // Efeito para buscar o produto no catálogo do Supabase quando o código de barras muda
  useEffect(() => {
    const searchProductInCatalog = async () => {
      const trimmedBarcode = barcode.trim();
      if (trimmedBarcode) {
        setIsSearchingProduct(true);
        setProductName(""); // Limpa o nome anterior enquanto busca
        setProductFoundBySearch(false); // Reseta o estado de busca
        setStockInfo(null);
        try {
          // Aceita código principal ou alternativo
          const { data: productId, error: resolveError } = await supabase.rpc("resolve_product", {
            _barcode: trimmedBarcode,
          });
          if (resolveError) throw resolveError;

          const { data, error } = productId
            ? await supabase
                .from("products")
                .select("barcode, product_name, price, stock, pendente_identificacao")
                .eq("id", productId)
                .maybeSingle()
            : { data: null, error: null };

          if (error) {
            throw error;
          }

          if (data) {
            setProductName(data.product_name);
            setStockInfo({
              barcode: data.barcode,
              stock: Number(data.stock),
              pendente: data.pendente_identificacao,
            });
            if (data.price > 0) {
              setValorUnitario(data.price.toString().replace(".", ","));
            }
            setProductFoundBySearch(true);
            toast({ title: "Produto encontrado!", description: data.product_name });
          } else {
            setStockInfo({ barcode: trimmedBarcode, stock: 0, pendente: false });
            toast({ title: "Produto não encontrado", description: "Por favor, digite o nome e valor manualmente." });
          }
        } catch (error) {
          console.error("Erro geral ao buscar produto no catálogo:", error);
          toast({ title: "Erro na busca", description: "Não foi possível buscar o produto no catálogo.", variant: "destructive" });
        } finally {
          setIsSearchingProduct(false);
        }
      } else {
        setProductName(""); // Limpa o nome se o código de barras estiver vazio
        setProductFoundBySearch(false);
        setStockInfo(null);
      }
    };

    const handler = setTimeout(() => {
      searchProductInCatalog();
    }, 300); // Pequeno delay para evitar múltiplas consultas enquanto o usuário digita

    return () => {
      clearTimeout(handler);
      setIsSearchingProduct(false);
    };
  }, [barcode]);

  const qtyInCart = stockInfo
    ? cartItems
        .filter((i) => i.barcode === stockInfo.barcode || i.barcode === barcode.trim())
        .reduce((sum, i) => sum + i.quantidade, 0)
    : 0;
  const disponivel = stockInfo ? stockInfo.stock - qtyInCart : 0;
  const excedeSaldo = !!stockInfo && safeNumber(quantidade) > disponivel;

  function resetForm() {
    setBarcode("");
    setProductName("");
    setQuantidade("1");
    setValorUnitario("");
    setDescontoPercentual("");
    setProductFoundBySearch(false);
    setStockInfo(null);
  }

  async function handleAddItem() {
    const b = barcode.trim();
    const pn = productName.trim();
    const qt = safeNumber(quantidade);
    const vu = safeNumber(valorUnitario);
    const descPct = safeNumber(descontoPercentual);

    if (!b) {
      toast({ title: "Erro", description: "Informe o código de barras.", variant: "destructive" });
      return;
    }
    if (!pn) {
      toast({ title: "Erro", description: "Informe o nome do produto.", variant: "destructive" });
      return;
    }
    if (qt <= 0) {
      toast({ title: "Erro", description: "Quantidade deve ser maior que zero.", variant: "destructive" });
      return;
    }
    if (vu <= 0) {
      toast({ title: "Erro", description: "Valor unitário deve ser maior que zero.", variant: "destructive" });
      return;
    }
    if (excedeSaldo) {
      if (bloquearSemSaldo) {
        toast({
          title: "Saldo insuficiente",
          description: `Disponível: ${disponivel}. A venda acima do saldo está bloqueada.`,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Atenção: venda acima do saldo",
        description: `Disponível: ${disponivel}. O saldo do produto ficará negativo.`,
      });
    }

    const item: OrderItem = {
      id: uuid(),
      barcode: b,
      productName: pn,
      quantidade: qt,
      valorUnitario: vu,
      descontoPercentual: descPct,
      totalBruto: calc.totalBruto,
      desconto: calc.desconto,
      totalLiquido: calc.totalLiquido,
    };

    // Se o produto não foi encontrado pela busca automática, salve-o no catálogo
    if (!productFoundBySearch) {
      try {
        const { error } = await supabase
          .from("products")
          .upsert({ barcode: b, product_name: pn, price: vu }, { onConflict: 'barcode' });

        if (error) {
          console.error("Erro ao salvar novo produto no catálogo:", error);
          toast({ title: "Erro ao salvar produto", description: "Não foi possível salvar o novo produto no catálogo.", variant: "destructive" });
        } else {
          toast({ title: "Produto salvo!", description: `"${pn}" adicionado/atualizado no catálogo.` });
        }
      } catch (e) {
        console.error("Erro inesperado ao salvar produto:", e);
      }
    }

    onAddItem(item);
    resetForm();
    toast({ title: "Item adicionado", description: `${pn} foi adicionado ao pedido.` });
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="font-medium text-sm">Adicionar Produto</h3>

      <div className="space-y-2">
        <Label htmlFor="barcode">Código de barras</Label>
        <div className="flex gap-2">
          <Input
            id="barcode"
            placeholder="Ex: 7891234567890"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            inputMode="numeric"
            className="flex-1"
          />
          <Button type="button" variant="outline" size="icon" onClick={() => setScannerOpen(true)}>
            <Camera className="h-4 w-4" />
          </Button>
          {barcode && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setBarcode("")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="productName">Nome do Produto</Label>
        <div className="relative">
          <Input
            id="productName"
            placeholder="Ex: Camiseta Básica P"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            disabled={isSearchingProduct}
          />
          {isSearchingProduct && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {stockInfo && (
        <div className="space-y-2">
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              excedeSaldo ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
            }`}
          >
            <Package className="h-4 w-4 flex-shrink-0" />
            <span>
              Saldo disponível: <strong>{disponivel}</strong>
              {qtyInCart > 0 && ` (já no pedido: ${qtyInCart})`}
              {excedeSaldo && (bloquearSemSaldo ? " — venda bloqueada acima do saldo" : " — quantidade acima do saldo")}
            </span>
          </div>
          {stockInfo.pendente && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Produto pendente de identificação: confira o nome e o preço antes de vender.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade</Label>
          <Input
            id="quantidade"
            type="number"
            min={1}
            step={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="valorUnitario">Valor unitário (R$)</Label>
          <Input
            id="valorUnitario"
            placeholder="Ex: 49,90"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descontoPercentual">Desconto (%)</Label>
          <Input
            id="descontoPercentual"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="Ex: 10"
            value={descontoPercentual}
            onChange={(e) => setDescontoPercentual(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button type="button" onClick={handleAddItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setBarcode(code);
          setScannerOpen(false);
        }}
      />
    </div>
  );
}