import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminPage from "./pages/AdminPage";
import AuthPage from "./pages/AuthPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import InventoryListPage from "./pages/InventoryListPage";
import InventoryCountPage from "./pages/InventoryCountPage";
import InventoryConferencePage from "./pages/InventoryConferencePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estoque/inventario"
            element={
              <ProtectedRoute>
                <InventoryListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estoque/inventario/:id"
            element={
              <ProtectedRoute>
                <InventoryCountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estoque/inventario/:id/conferencia"
            element={
              <ProtectedRoute>
                <InventoryConferencePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;