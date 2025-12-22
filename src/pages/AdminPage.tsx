import { useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BarChart3, ArrowLeft, Package } from "lucide-react"; // Added Package icon
import { PendingUsersManager } from "@/components/admin/PendingUsersManager";
import { AdminSalesDashboard } from "@/components/admin/AdminSalesDashboard";
import { ProductCatalogImporter } from "@/components/admin/ProductCatalogImporter"; // Import new component
import { useSalesSupabase } from "@/hooks/useSalesSupabase";
import { UserMenu } from "@/components/layout/UserMenu";
import { Button } from "@/components/ui/button";

type AdminTab = "users" | "dashboard" | "products"; // Added 'products' tab

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const { sales, deleteSale } = useSalesSupabase();

  const STORE_NAME = "Fiorenzza Beauty";
  const STORE_LOGO_SRC = "/fiorenzza.png";

  // Função para lidar com a conclusão da importação (opcionalmente, recarregar lista de produtos se exibida)
  const handleProductImportComplete = () => {
    // Por enquanto, um toast é suficiente, pois o AddItemForm consultará diretamente.
  };

  return (
    <>
      <Helmet>
        <title>Administração | {STORE_NAME}</title>
        <meta
          name="description"
          content="Página de administração para gerenciar usuários e visualizar o dashboard de vendas."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl py-6 space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {STORE_LOGO_SRC && (
                <img src={STORE_LOGO_SRC} alt={`${STORE_NAME} Logo`} className="h-12 w-12 rounded-xl object-cover" />
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{STORE_NAME}</h1>
                <p className="text-sm text-muted-foreground">
                  Administração e Relatórios
                </p>
              </div>
            </div>
            <UserMenu />
          </header>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdminTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-3"> {/* Changed to grid-cols-3 */}
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuários
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center gap-2"> {/* New tab */}
                <Package className="h-4 w-4" />
                Produtos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="users" className="mt-4">
              <PendingUsersManager />
            </TabsContent>
            <TabsContent value="dashboard" className="mt-4">
              <AdminSalesDashboard sales={sales} onDeleteCancelledSale={deleteSale} />
            </TabsContent>
            <TabsContent value="products" className="mt-4"> {/* New tab content */}
              <ProductCatalogImporter onImportComplete={handleProductImportComplete} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default AdminPage;