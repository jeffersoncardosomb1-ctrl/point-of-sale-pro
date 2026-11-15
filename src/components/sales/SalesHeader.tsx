import { ShoppingCart, List, BarChart3, PackagePlus, TrendingUp, History, Tag, Users, PackageSearch, Repeat, Boxes, ChevronDown, ClipboardList, CircleHelp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Tab = "nova" | "lista" | "relatorios" | "compras" | "custos" | "kardex" | "preco" | "consulta" | "clientes" | "giro";

interface SalesHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  storeName: string; // Adicionado prop para o nome da loja
  storeLogoSrc: string; // Adicionado prop para a URL da logo
  isAdmin?: boolean;
  canViewGiroEstoque?: boolean;
  canManageStock?: boolean;
}

export function SalesHeader({ activeTab, onTabChange, storeName, storeLogoSrc, isAdmin, canViewGiroEstoque, canManageStock }: SalesHeaderProps) {
  const navigate = useNavigate();
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
        <Button
          variant={activeTab === "preco" ? "default" : "outline"}
          onClick={() => onTabChange("preco")}
          className="gap-2"
        >
          <Tag className="h-4 w-4" />
          Atualizar Preço
        </Button>
        <Button
          variant={activeTab === "clientes" ? "default" : "outline"}
          onClick={() => onTabChange("clientes")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Clientes
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Boxes className="h-4 w-4" />
              Estoque
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {canManageStock && (
              <DropdownMenuItem onClick={() => navigate("/estoque")}>
                <Boxes className="mr-2 h-4 w-4" />
                Estoque
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate("/estoque/inventario")}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Inventário
            </DropdownMenuItem>
            {canManageStock && (
              <DropdownMenuItem onClick={() => navigate("/estoque/a-identificar")}>
                <CircleHelp className="mr-2 h-4 w-4" />
                Produtos a identificar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
            {canViewGiroEstoque && (
              <Button
                variant={activeTab === "giro" ? "default" : "outline"}
                onClick={() => onTabChange("giro")}
                className="gap-2"
              >
                <Repeat className="h-4 w-4" />
                Giro & Estoque
              </Button>
            )}
            <Button
              variant={activeTab === "consulta" ? "default" : "outline"}
              onClick={() => onTabChange("consulta")}
              className="gap-2"
            >
              <PackageSearch className="h-4 w-4" />
              Consulta Produtos
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}