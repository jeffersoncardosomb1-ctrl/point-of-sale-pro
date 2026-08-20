import { useState } from "react";
import { Helmet } from "react-helmet";
import { SalesHeader } from "@/components/sales/SalesHeader";
import { NewOrderForm } from "@/components/orders/NewOrderForm";
import { SalesListView } from "@/components/sales/SalesListView";
import { ReportsView } from "@/components/sales/ReportsView";
import { useSalesSupabase } from "@/hooks/useSalesSupabase";
import { useOrdersSupabase } from "@/hooks/useOrdersSupabase";
import { UserMenu } from "@/components/layout/UserMenu";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { PurchaseEntryView } from "@/components/inventory/PurchaseEntryView";
import { CostMarginView } from "@/components/inventory/CostMarginView";
import { KardexView } from "@/components/inventory/KardexView";
import { UpdatePriceView } from "@/components/inventory/UpdatePriceView";
import { ClientsView } from "@/components/clients/ClientsView";

type Tab = "nova" | "lista" | "relatorios" | "compras" | "custos" | "kardex" | "preco" | "clientes";

const Index = () => {
  const [tab, setTab] = useState<Tab>("nova");
  const { sales, loading: salesLoading, cancelSale, updateSaleDate } = useSalesSupabase();
  const { createOrder, loading: ordersLoading } = useOrdersSupabase();
  const { isAdmin } = useAuth();

  const STORE_NAME = "Fiorenzza Beauty";
  const STORE_LOGO_SRC = "/fiorenzza.png";

  const loading = salesLoading || ordersLoading;

  async function handleOrderCreated(orderData: Parameters<typeof createOrder>[0]) {
    const created = await createOrder(orderData);
    if (created) {
      setTab("lista");
    }
    return created;
  }

  async function handleCancelSale(id: string, motivo: string) {
    await cancelSale(id, motivo);
  }

  function handleClearAll() {
    // Not implemented for Supabase - sales are permanent
  }

  async function handleUpdateSaleDate(id: string, newDate: string) {
    await updateSaleDate(id, newDate);
  }

  return (
    <>
      <Helmet>
        <title>{STORE_NAME} | Sistema de Vendas</title>
        <meta
          name="description"
          content="Sistema completo de vendas com scanner de código de barras, cálculo de troco, descontos, cancelamentos e relatórios por vendedor."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl py-6 space-y-6">
          <div className="flex justify-end mb-4">
            <UserMenu />
          </div>
          <SalesHeader activeTab={tab} onTabChange={setTab} storeName={STORE_NAME} storeLogoSrc={STORE_LOGO_SRC} isAdmin={isAdmin} />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando vendas...</span>
            </div>
          ) : (
            <>
              {tab === "nova" && <NewOrderForm onOrderCreated={handleOrderCreated} />}

              {tab === "lista" && (
                <SalesListView
                  sales={sales}
                  onCancelSale={handleCancelSale}
                  onClearAll={handleClearAll}
                  onNewSale={() => setTab("nova")}
                  onUpdateSaleDate={handleUpdateSaleDate}
                  isAdmin={isAdmin}
                />
              )}

              {tab === "relatorios" && (
                <ReportsView sales={sales} onViewList={() => setTab("lista")} />
              )}

              {tab === "compras" && isAdmin && <PurchaseEntryView />}
              {tab === "custos" && isAdmin && <CostMarginView />}
              {tab === "kardex" && isAdmin && <KardexView />}
              {tab === "preco" && <UpdatePriceView />}
              {tab === "clientes" && <ClientsView />}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Index;