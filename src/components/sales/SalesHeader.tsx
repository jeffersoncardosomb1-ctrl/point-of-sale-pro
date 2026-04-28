import { ShoppingCart, List, BarChart3, PackagePlus, TrendingUp, History } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tab = "nova" | "lista" | "relatorios" | "compras" | "custos" | "kardex";

interface SalesHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  storeName: string; // Adicionado prop para o nome da loja
  storeLogoSrc: string; // Adicionado prop para a URL da logo
  isAdmin?: boolean;
}

export function SalesHeader({ activeTab, onTabChange, storeName, storeLogoSrc, isAdmin }: SalesHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {storeLogoSrc && (
          <img src={storeLogoSrc} alt={`${storeName} Logo`} className="h-12 w-12 rounded-xl object-cover" />
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{storeName}</h1>
          <p className="text-sm text-muted-foreground">
            Sistema de Vendas - Gestão completa
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "nova" ? "default" : "outline"}
          onClick={() => onTabChange("nova")}
          className="gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          Nova Venda
        </Button>
        <Button
          variant={activeTab === "lista" ? "default" : "outline"}
          onClick={() => onTabChange("lista")}
          className="gap-2"
        >
          <List className="h-4 w-4" />
          Vendas
        </Button>
        <Button
          variant={activeTab === "relatorios" ? "default" : "outline"}
          onClick={() => onTabChange("relatorios")}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Relatórios
        </Button>
        {isAdmin && (
          <>
            <Button
              variant={activeTab === "compras" ? "default" : "outline"}
              onClick={() => onTabChange("compras")}
              className="gap-2"
            >
              <PackagePlus className="h-4 w-4" />
              Entrada Compras
            </Button>
            <Button
              variant={activeTab === "custos" ? "default" : "outline"}
              onClick={() => onTabChange("custos")}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Custos & Margens
            </Button>
            <Button
              variant={activeTab === "kardex" ? "default" : "outline"}
              onClick={() => onTabChange("kardex")}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Kardex
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}