import { useState, useMemo } from "react";
import { ShoppingCart, User, Save, Trash2, Calculator, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AddItemForm } from "./AddItemForm";
import { OrderItemRow } from "./OrderItemRow";
import { Order, OrderItem } from "@/types/order";
import { PaymentMethod } from "@/types/sales";
import { formatBRL, nowISO, uuid } from "@/lib/sales-utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClientsSupabase } from "@/hooks/useClientsSupabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NewOrderFormProps {
  onOrderCreated: (order: {
    vendedor: string;
    formaPagamento: string;
    items: Omit<OrderItem, "id">[];
    descontoManual?: number;
    pgtoValues?: Record<string, number>;
    observacoes?: string;
    clientId?: string | null;
    clientNome?: string;
  }) => Promise<Order | null>;
}

export function NewOrderForm({ onOrderCreated }: NewOrderFormProps) {
  const { firstName, lastName } = useAuth();
  const { clients } = useClientsSupabase();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<PaymentMethod[]>(["PIX"]);
  const [pgtoInputs, setPgtoInputs] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [descontoManualInput, setDescontoManualInput] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vendedor = [firstName, lastName].filter(Boolean).join(" ") || "Vendedor";

  const descontoManualValue = parseFloat(descontoManualInput.replace(",", ".")) || 0;

  const totals = useMemo(() => {
    const totalBruto = items.reduce((sum, item) => sum + item.totalBruto, 0);
    const totalDescontoProdutos = items.reduce((sum, item) => sum + item.desconto, 0);
    const subtotalLiquido = items.reduce((sum, item) => sum + item.totalLiquido, 0);
    const effectiveDescontoManual = descontoManualValue;
    const totalDesconto = totalDescontoProdutos + effectiveDescontoManual;
    const totalLiquido = Math.max(0, subtotalLiquido - effectiveDescontoManual);
    return { totalBruto, totalDescontoProdutos, totalDesconto, totalLiquido, subtotalLiquido };
  }, [items, descontoManualValue]);

  function handleAddItem(item: OrderItem) {
    setItems((prev) => [...prev, item]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
    { value: "PIX", label: "PIX" },
    { value: "CARTAO", label: "Cartão" },
    { value: "DINHEIRO", label: "Dinheiro" },
    { value: "BOLETO", label: "Boleto" },
    { value: "OUTROS", label: "Outros" },
  ];

  function togglePaymentMethod(method: PaymentMethod) {
    setFormasPagamento((prev) => {
      if (prev.includes(method)) {
        if (prev.length === 1) return prev;
        // Clear the input value when unchecking
        setPgtoInputs((p) => { const n = { ...p }; delete n[method]; return n; });
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  }

  function handlePgtoInputChange(method: string, value: string) {
    setPgtoInputs((prev) => ({ ...prev, [method]: value }));
  }

  function handleClearAll() {
    setItems([]);
    setFormasPagamento(["PIX"]);
    setPgtoInputs({});
    setObservacoes("");
    setDescontoManualInput("");
    setClientId("");
  }

  async function handleSubmit() {
    if (items.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um produto ao pedido.", variant: "destructive" });
      return;
    }

    // Build pgtoValues from inputs
    const pgtoValues: Record<string, number> = {};
    for (const method of formasPagamento) {
      pgtoValues[method] = parseFloat((pgtoInputs[method] || "0").replace(",", ".")) || 0;
    }

    setIsSubmitting(true);
    try {
      const result = await onOrderCreated({
        vendedor,
        formaPagamento: formasPagamento.join(","),
        items: items.map(({ id, ...rest }) => rest),
        descontoManual: descontoManualValue,
        pgtoValues,
        observacoes,
        clientId: clientId || null,
        clientNome: clients.find((c) => c.id === clientId)?.nome || "",
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

              <div className="space-y-2 pt-2">
                <Label>Cliente (opcional)</Label>
                <div className="flex gap-2">
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Sem identificação" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                          {c.telefone ? ` — ${c.telefone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clientId && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setClientId("")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <Label>Forma de pagamento</Label>
              <div className="space-y-2 pt-1">
                {PAYMENT_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none min-w-[100px]">
                      <Checkbox
                        checked={formasPagamento.includes(opt.value)}
                        onCheckedChange={() => togglePaymentMethod(opt.value)}
                      />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                    {formasPagamento.includes(opt.value) && (
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={pgtoInputs[opt.value] || ""}
                        onChange={(e) => handlePgtoInputChange(opt.value, e.target.value)}
                        className="font-mono w-28 h-8 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
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
            {totals.totalDesconto - totals.totalDescontoProdutos > 0.001 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Desconto manual</span>
                <span className="font-medium text-destructive">-{formatBRL(totals.totalDesconto - totals.totalDescontoProdutos)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="font-medium">Total líquido</span>
              <span className="font-bold text-primary">{formatBRL(totals.totalLiquido)}</span>
            </div>
          </div>

          {/* Desconto manual */}
          <div className="space-y-2">
            <Label htmlFor="descontoManual" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Desconto manual (R$)
            </Label>
            <Input
              id="descontoManual"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={descontoManualInput}
              onChange={(e) => setDescontoManualInput(e.target.value)}
              className="font-mono"
            />
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações do pedido..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[60px]"
            />
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
