import { useState, useMemo, useEffect } from "react";
import { Plus, Camera, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScannerModal } from "@/components/sales/ScannerModal";
import { OrderItem } from "@/types/order";
import { safeNumber, uuid } from "@/lib/sales-utils";
import { toast } from "@/hooks/use-toast";
import { buscarProdutoPorEAN } from "@/lib/product-search"; // Importar a nova função

interface AddItemFormProps {
  onAddItem: (item: OrderItem) => void;
}

export function AddItemForm({ onAddItem }: AddItemFormProps) {
  const [barcode, setBarcode] = useState("");
  const [productName, setProductName] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false); // Novo estado para loading

  const calc = useMemo(() => {
    const qt = safeNumber(quantidade);
    const vu = safeNumber(valorUnitario);
    const descPct = safeNumber(descontoPercentual);
    const totalBruto = qt * vu;
    const desconto = totalBruto * (descPct / 100);
    const totalLiquido = totalBruto - desconto;
    return { totalBruto, desconto, totalLiquido };
  }, [quantidade, valorUnitario, descontoPercentual]);

  // Efeito para buscar o produto quando o código de barras muda
  useEffect(() => {
    const searchProduct = async () => {
      const trimmedBarcode = barcode.trim();
      if (trimmedBarcode.length > 7) { // EANs geralmente têm 8, 12 ou 13 dígitos
        setIsSearchingProduct(true);
        setProductName(""); // Limpa o nome anterior enquanto busca
        const result = await buscarProdutoPorEAN(trimmedBarcode);
        if (result.encontrado && result.nome) {
          setProductName(result.nome);
          toast({ title: "Produto encontrado!", description: result.nome });
        } else {
          toast({ title: "Produto não encontrado", description: "Por favor, digite o nome do produto manualmente.", variant: "info" });
        }
        setIsSearchingProduct(false);
      } else if (trimmedBarcode.length === 0) {
        setProductName(""); // Limpa o nome se o código de barras for apagado
      }
    };

    const handler = setTimeout(() => {
      searchProduct();
    }, 500); // Pequeno delay para evitar múltiplas buscas enquanto o usuário digita

    return () => {
      clearTimeout(handler);
      setIsSearchingProduct(false); // Limpa o estado de loading ao desmontar ou antes de uma nova busca
    };
  }, [barcode]);

  function resetForm() {
    setBarcode("");
    setProductName("");
    setQuantidade("1");
    setValorUnitario("");
    setDescontoPercentual("");
  }

  function handleAddItem() {
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
            disabled={isSearchingProduct} // Desabilita enquanto busca
          />
          {isSearchingProduct && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

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
          setScannerOpen(false); // Fecha o scanner após detectar
        }}
      />
    </div>
  );
}