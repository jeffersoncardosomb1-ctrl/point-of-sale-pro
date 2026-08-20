import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sale, PaymentMethod, SaleStatus } from "@/types/sales";
import { toast } from "@/hooks/use-toast";

// Convert database row to Sale type
function dbRowToSale(row: any): Sale {
  return {
    id: row.id,
    createdAt: row.created_at,
    vendedor: row.vendedor,
    barcode: row.barcode || "",
    productName: row.product_name || "",
    quantidade: Number(row.quantidade),
    valorUnitario: Number(row.valor_unitario),
    totalBruto: Number(row.total_bruto),
    desconto: Number(row.desconto),
    totalLiquido: Number(row.total_liquido),
    valorPago: Number(row.valor_pago),
    troco: Number(row.troco),
    formaPagamento: row.forma_pagamento as PaymentMethod,
    pgtoPix: Number(row.pgto_pix || 0),
    pgtoCartao: Number(row.pgto_cartao || 0),
    pgtoDinheiro: Number(row.pgto_dinheiro || 0),
    pgtoBoleto: Number(row.pgto_boleto || 0),
    pgtoOutros: Number(row.pgto_outros || 0),
    observacoes: row.observacoes || "",
    status: row.status as SaleStatus,
    clientId: row.client_id ?? null,
    clientNome: row.client_nome || "",
    cancelMotivo: row.cancel_motivo || "",
    canceledAt: row.canceled_at || "",
  };
}

// Convert Sale to database insert format
function saleToDbRow(sale: Omit<Sale, "id">) {
  return {
    created_at: sale.createdAt,
    vendedor: sale.vendedor,
    barcode: sale.barcode,
    product_name: sale.productName,
    quantidade: sale.quantidade,
    valor_unitario: sale.valorUnitario,
    total_bruto: sale.totalBruto,
    desconto: sale.desconto,
    total_liquido: sale.totalLiquido,
    valor_pago: sale.valorPago,
    troco: sale.troco,
    forma_pagamento: sale.formaPagamento,
    pgto_pix: sale.pgtoPix || 0,
    pgto_cartao: sale.pgtoCartao || 0,
    pgto_dinheiro: sale.pgtoDinheiro || 0,
    pgto_boleto: sale.pgtoBoleto || 0,
    pgto_outros: sale.pgtoOutros || 0,
    observacoes: sale.observacoes || "",
    status: sale.status,
    cancel_motivo: sale.cancelMotivo,
    canceled_at: sale.canceledAt || null,
  };
}

export function useSalesSupabase() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all sales from Supabase
  const fetchSales = useCallback(async () => {
    try {
      // Supabase PostgREST limits to 1000 rows per request, so we paginate
      const PAGE_SIZE = 1000;
      const MAX_ROWS = 10000;
      let allData: typeof data = [];
      let page = 0;
      let data: any[] | null = [];

      while (page * PAGE_SIZE < MAX_ROWS) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data: pageData, error } = await supabase
          .from("sales")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (!pageData || pageData.length === 0) break;
        allData = [...allData, ...pageData];
        if (pageData.length < PAGE_SIZE) break; // last page
        page++;
      }

      const mappedSales = allData.map(dbRowToSale);
      setSales(mappedSales);
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
      toast({
        title: "Erro ao carregar vendas",
        description: "Não foi possível conectar ao banco de dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new sale
  const createSale = useCallback(async (saleData: Omit<Sale, "id">): Promise<Sale | null> => {
    try {
      const dbRow = saleToDbRow(saleData);
      
      const { data, error } = await supabase
        .from("sales")
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;

      const newSale = dbRowToSale(data);
      setSales((prev) => [newSale, ...prev]);
      
      toast({
        title: "Venda registrada",
        description: "A venda foi salva com sucesso no banco de dados.",
      });
      
      return newSale;
    } catch (error) {
      console.error("Erro ao criar venda:", error);
      toast({
        title: "Erro ao salvar venda",
        description: "Não foi possível salvar a venda no banco de dados.",
        variant: "destructive",
      });
      return null;
    }
  }, []);

  // Cancel a sale
  const cancelSale = useCallback(async (id: string, motivo: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("sales")
        .update({
          status: "CANCELADA",
          cancel_motivo: motivo,
          canceled_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setSales((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: "CANCELADA" as SaleStatus, cancelMotivo: motivo, canceledAt: new Date().toISOString() }
            : s
        )
      );

      toast({
        title: "Venda cancelada",
        description: "A venda foi marcada como cancelada.",
      });
      
      return true;
    } catch (error) {
      console.error("Erro ao cancelar venda:", error);
      toast({
        title: "Erro ao cancelar venda",
        description: "Não foi possível cancelar a venda.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  // Delete a cancelled sale (admin only)
  const deleteSale = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("sales")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSales((prev) => prev.filter((s) => s.id !== id));

      toast({
        title: "Venda excluída",
        description: "A venda cancelada foi removida permanentemente.",
      });
      
      return true;
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      toast({
        title: "Erro ao excluir venda",
        description: "Não foi possível excluir a venda. Verifique se você tem permissão de administrador.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  // Update sale date (admin only)
  const updateSaleDate = useCallback(async (id: string, newDate: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("sales")
        .update({ created_at: newDate })
        .eq("id", id);

      if (error) throw error;

      setSales((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, createdAt: newDate } : s
        )
      );

      toast({
        title: "Data atualizada",
        description: "A data da venda foi alterada com sucesso.",
      });
      
      return true;
    } catch (error) {
      console.error("Erro ao atualizar data:", error);
      toast({
        title: "Erro ao atualizar data",
        description: "Não foi possível alterar a data da venda.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  // Load sales on mount
  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("sales-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        () => {
          // Refetch on any change from other clients
          fetchSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSales]);

  return {
    sales,
    loading,
    createSale,
    cancelSale,
    deleteSale,
    updateSaleDate,
    refetch: fetchSales,
  };
}
