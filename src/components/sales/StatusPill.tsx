import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaleStatus } from "@/types/sales";

interface StatusPillProps {
  status: SaleStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const isCancel = status === "CANCELADA";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border",
        isCancel
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : "bg-accent text-accent-foreground border-primary/20"
      )}
    >
      {isCancel ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
      {status}
    </span>
  );
}
