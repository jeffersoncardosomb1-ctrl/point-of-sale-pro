import { cn } from "@/lib/utils";

interface StatsBadgeProps {
  label: string;
  value: string | number;
  variant?: "default" | "success" | "warning" | "muted";
}

export function StatsBadge({ label, value, variant = "default" }: StatsBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        {
          "bg-secondary text-secondary-foreground border-border": variant === "default",
          "bg-accent text-accent-foreground border-primary/20": variant === "success",
          "bg-warning/10 text-warning border-warning/20": variant === "warning",
          "bg-muted text-muted-foreground border-border": variant === "muted",
        }
      )}
    >
      <span className="opacity-70">{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
