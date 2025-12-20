import { useState, useMemo } from "react";
import { ShoppingCart, User, Save, Trash2, Calculator, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddItemForm } from "./AddItemForm";
import { OrderItemRow } from "./OrderItemRow";
import { Order, OrderItem } from "@/types/order";
import { PaymentMethod } from "@/types/sales";
import { formatBRL, nowISO, uuid } from "@/lib/sales-utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface NewOrderFormProps {
  onOrderCreated: (order: {
    vendedor: string;
    formaPagamento: PaymentMethod;
    items: Omit<OrderItem, "id">[];
    descontoManual?: number;
  }) => Promise<Order | null>;
}

export function NewOrderForm({ onOrderCreated }: NewOrderFormProps) {
  const { firstName, lastName } = useAuth();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>("PIX");
  const [descontoManual, setDescontoManual] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vendedor = [firstName, lastName].filter(Boolean).join(" ") || "Vendedor";

  const descontoManualValue = parseFloat(descontoManual.replace(",", ".")) || 0;

  const totals = useMemo(() => {
    const totalBruto = items.reduce((sum, item) => sum + item.totalBruto, 0);
    const totalDescontoProdutos = items.reduce((sum, item) => sum + item.desconto, 0);
    const subtotal = items.reduce((sum, item) => sum + item.totalLiquido, 0);
    const totalDesconto = totalDescontoProdutos + descontoManualValue;
    const totalLiquido = Math.max(0, subtotal - descontoManualValue);
    return { totalBruto, totalDescontoProdutos, totalDesconto, totalLiquido, subtotal };
  }, [items, descontoManualValue]);

  function handleAddItem(item: OrderItem) {
    setItems((prev) => [...prev, item]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleClearAll() {
    setItems([]);
    setFormaPagamento("PIX");
    setDescontoManual("");
  }

  async function handleSubmit() {
    if (items.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um produto ao pedido.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onOrderCreated({
        vendedor,
        formaPagamento,
        items: items.map(({ id, ...rest }) => rest),
        descontoManual: formaPagamento === "DINHEIRO" ? descontoManualValue : 0,
      });

      if (result) {
        handleClearAll();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Novo Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>Vendedor</Label>
              <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{vendedor}</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <Label htmlFor="formaPagamento">Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={(v) => {
                setFormaPagamento(v as PaymentMethod);
                if (v !== "DINHEIRO") setDescontoManual("");
              }}>
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

            {formaPagamento === "DINHEIRO" && (
              <div className="flex-1 space-y-2">
                <Label htmlFor="descontoManual" className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Desconto manual (troco)
                </Label>
                <Input
                  id="descontoManual"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={descontoManual}
                  onChange={(e) => setDescontoManual(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}
          </div>

          <AddItemForm onAddItem={handleAddItem} />

          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Itens do Pedido ({items.length})</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleClearAll}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar tudo
                </Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {items.map((item, index) => (
                  <OrderItemRow key={item.id} item={item} index={index} onRemove={handleRemoveItem} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Calculator className="h-4 w-4" />
              Resumo do Pedido
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens</span>
              <span className="font-medium">{items.length} produto(s)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total bruto</span>
              <span className="font-medium">{formatBRL(totals.totalBruto)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Desconto produtos</span>
              <span className="font-medium text-destructive">-{formatBRL(totals.totalDescontoProdutos)}</span>
            </div>
            {formaPagamento === "DINHEIRO" && descontoManualValue > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Desconto manual</span>
                <span className="font-medium text-destructive">-{formatBRL(descontoManualValue)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="font-medium">Total líquido</span>
              <span className="font-bold text-primary">{formatBRL(totals.totalLiquido)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClearAll} disabled={items.length === 0}>
              Limpar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={items.length === 0 || isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Salvando..." : "Finalizar Pedido"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
