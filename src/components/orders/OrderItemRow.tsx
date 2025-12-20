import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/sales-utils";
import { OrderItem } from "@/types/order";

interface OrderItemRowProps {
  item: OrderItem;
  index: number;
  onRemove: (index: number) => void;
}

export function OrderItemRow({ item, index, onRemove }: OrderItemRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.productName}</p>
        <p className="text-xs text-muted-foreground">Cód: {item.barcode}</p>
      </div>
      <div className="text-right text-sm">
        <p className="text-muted-foreground">
          {item.quantidade} x {formatBRL(item.valorUnitario)}
        </p>
        {item.descontoPercentual > 0 && (
          <p className="text-xs text-destructive">-{item.descontoPercentual}%</p>
        )}
      </div>
      <div className="text-right min-w-[80px]">
        <p className="font-medium text-sm">{formatBRL(item.totalLiquido)}</p>
        {item.desconto > 0 && (
          <p className="text-xs text-muted-foreground line-through">{formatBRL(item.totalBruto)}</p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
