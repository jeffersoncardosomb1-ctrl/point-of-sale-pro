import { ReactNode } from "react";
import { Helmet } from "react-helmet";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Boxes, ClipboardList, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const STORE_NAME = "Fiorenzza Beauty";
const STORE_LOGO_SRC = "/fiorenzza.png";

interface StockLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Esconde o cabeçalho completo (tela de contagem no celular). */
  compact?: boolean;
  backTo?: string;
}

export function StockLayout({ title, subtitle, children, compact, backTo = "/" }: StockLayoutProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canManageStock } = useAuth();

  const links = [
    ...(canManageStock ? [{ to: "/estoque", label: "Estoque", icon: Boxes, end: true }] : []),
    { to: "/estoque/inventario", label: "Inventário", icon: ClipboardList, end: false },
    ...(canManageStock ? [{ to: "/estoque/a-identificar", label: "Produtos a identificar", icon: CircleHelp, end: true }] : []),
  ];

  return (
    <>
      <Helmet>
        <title>
          {title} | {STORE_NAME}
        </title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className={cn("container max-w-6xl space-y-4", compact ? "px-3 py-3 sm:py-6" : "py-6")}>
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button variant="ghost" size="icon" onClick={() => navigate(backTo)} aria-label="Voltar">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {!compact && (
                <img
                  src={STORE_LOGO_SRC}
                  alt={`${STORE_NAME} Logo`}
                  className="hidden sm:block h-12 w-12 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
              </div>
            </div>
            <UserMenu />
          </header>

          {!compact && (
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {links.map((l) => {
                const isActive = l.end ? pathname === l.to : pathname.startsWith(l.to);
                return (
                  <Button
                    key={l.to}
                    variant={isActive ? "default" : "outline"}
                    className="gap-2 whitespace-nowrap"
                    onClick={() => navigate(l.to)}
                  >
                    <l.icon className="h-4 w-4" />
                    {l.label}
                  </Button>
                );
              })}
            </nav>
          )}

          {children}
        </div>
      </div>
    </>
  );
}
