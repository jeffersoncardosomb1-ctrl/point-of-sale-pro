import { useState, useMemo } from "react";
import { Camera, Trash2, Save, Calculator, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScannerModal } from "./ScannerModal";
import { Sale, PaymentMethod } from "@/types/sales";
import { formatBRL, safeNumber, nowISO, uuid } from "@/lib/sales-utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface NewSaleFormProps {
  onSaleCreated: (sale: Sale) => void;
}

export function NewSaleForm({ onSaleCreated }: NewSaleFormProps) {
  const { firstName, lastName } = useAuth();
  
  const [barcode, setBarcode] = useState("");
  const [productName, setProductName] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>("PIX");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Nome do vendedor baseado no usuário logado
  const vendedor = [firstName, lastName].filter(Boolean).join(" ") || "Vendedor";

  // Desconto calculado automaticamente: Total Bruto - Valor Pago
  const calc = useMemo(() => {
    const qt = safeNumber(quantidade);
    const vu = safeNumber(valorUnitario);
    const vp = safeNumber(valorPago);
    const totalBruto = qt * vu;
    const desconto = vp > 0 ? Math.max(0, totalBruto - vp) : 0;
    const totalLiquido = vp > 0 ? Math.min(vp, totalBruto) : totalBruto;
    return { totalBruto, totalLiquido, desconto };
  }, [quantidade, valorUnitario, valorPago]);

  function resetForm() {
    setBarcode("");
    setProductName("");
    setQuantidade("1");
    setValorUnitario("");
    setValorPago("");
    setFormaPagamento("PIX");
  }

  function handleSubmit() {
    const v = vendedor.trim();
    const b = barcode.trim();
    const pn = productName.trim();
    const qt = safeNumber(quantidade);
    const vu = safeNumber(valorUnitario);
    const vp = safeNumber(valorPago);

    const totalBruto = qt * vu;
    const desconto = vp > 0 ? Math.max(0, totalBruto - vp) : 0;
    const totalLiquido = vp > 0 ? Math.min(vp, totalBruto) : totalBruto;

    if (!b) {
      toast({ title: "Erro", description: "Informe ou escaneie o código de barras.", variant: "destructive" });
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
      toast({ title: "Erro", description: "Valor do produto deve ser maior que zero.", variant: "destructive" });
      return;
    }
    if (vp <= 0) {
      toast({ title: "Erro", description: "Valor pago deve ser maior que zero.", variant: "destructive" });
      return;
    }

    const sale: Sale = {
      id: uuid(),
      createdAt: nowISO(),
      vendedor: v,
      barcode: b,
      productName: pn,
      quantidade: qt,
      valorUnitario: vu,
      totalBruto,
      desconto,
      totalLiquido,
      valorPago: totalLiquido,
      troco: 0,
      formaPagamento,
      status: "ATIVA",
      cancelMotivo: "",
      canceledAt: "",
    };

    onSaleCreated(sale);
    resetForm();
    toast({ title: "Sucesso!", description: "Venda registrada com sucesso." });
  }

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg">Nova Venda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vendedor">Vendedor</Label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{vendedor}</span>
          </div>
        </div>

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
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setScannerOpen(true)}
            >
              <Camera className="h-4 w-4" />
            </Button>
            {barcode && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setBarcode("")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productName">Nome do Produto</Label>
          <Input
            id="productName"
            placeholder="Ex: Camiseta Básica P"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Label htmlFor="valorPago">Valor Pago (R$)</Label>
            <Input
              id="valorPago"
              placeholder="Ex: 45,00"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="formaPagamento">Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as PaymentMethod)}>
              <SelectTrigger id="formaPagamento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="CARTAO">Cartão</SelectItem>
                <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                <SelectItem value="BOLETO">Boleto</SelectItem>
                <SelectItem value="OUTROS">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Calculator className="h-4 w-4" />
            Resumo
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total bruto</span>
            <span className="font-medium">{formatBRL(calc.totalBruto)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Desconto</span>
            <span className="font-medium text-destructive">-{formatBRL(calc.desconto)}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="font-medium">Total líquido</span>
            <span className="font-bold text-primary">{formatBRL(calc.totalLiquido)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={resetForm}>
            Limpar
          </Button>
          <Button type="button" onClick={handleSubmit}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Venda
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Vendas ficam salvas neste dispositivo (localStorage)
        </p>

        <ScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => setBarcode(code)}
        />
      </CardContent>
    </Card>
  );
}