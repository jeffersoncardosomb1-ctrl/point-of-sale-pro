import { Badge } from "@/components/ui/badge";
import { INVENTORY_STATUS_LABELS } from "@/lib/stock-utils";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  ABERTA: "bg-primary/10 text-primary border-primary/30",
  EM_CONFERENCIA: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200",
  FINALIZADA: "bg-success/10 text-success border-success/30",
  CANCELADA: "bg-muted text-muted-foreground",
};

export function InventoryStatusBadge({ status }: { status: string | null }) {
  const s = status || "";
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", STYLES[s])}>
      {INVENTORY_STATUS_LABELS[s] || s}
    </Badge>
  );
}
