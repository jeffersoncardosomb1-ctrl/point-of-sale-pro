import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusFilter, PeriodFilter } from "@/types/sales";

interface SalesFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  periodFilter: PeriodFilter;
  onPeriodChange: (value: PeriodFilter) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
}

export function SalesFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  periodFilter,
  onPeriodChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: SalesFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar vendedor, código, pagamento..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            <SelectItem value="ATIVAS">Somente ativas</SelectItem>
            <SelectItem value="CANCELADAS">Somente canceladas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={periodFilter} onValueChange={onPeriodChange}>
          <SelectTrigger>
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HOJE">Hoje</SelectItem>
            <SelectItem value="7D">Últimos 7 dias</SelectItem>
            <SelectItem value="30D">Últimos 30 dias</SelectItem>
            <SelectItem value="TUDO">Tudo</SelectItem>
            <SelectItem value="CUSTOM">Período personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {periodFilter === "CUSTOM" && (
        <div className="grid gap-3 sm:grid-cols-2 animate-slide-up">
          <div className="space-y-1.5">
            <Label htmlFor="dateFrom" className="text-xs">De</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateTo" className="text-xs">Até</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
