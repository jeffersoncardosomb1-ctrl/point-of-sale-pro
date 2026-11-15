import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Order, OrderItem } from "@/types/order";
import { PaymentMethod, SaleStatus } from "@/types/sales";
import { toast } from "@/hooks/use-toast";
import { dbErrorMessage } from "@/lib/stock-utils";

function dbRowToOrder(row: any, items: OrderItem[]): Order {
  return {
    id: row.id,
    createdAt: row.created_at,
    vendedor: row.vendedor,
    formaPagamento: row.forma_pagamento as PaymentMethod,
    status: row.status as SaleStatus,
    totalBruto: Number(row.total_bruto),
    totalDesconto: Number(row.total_desconto),
    totalLiquido: Number(row.total_liquido),
    valorPago: Number(row.valor_pago),
    troco: Number(row.troco),
    pgtoPix: Number(row.pgto_pix || 0),
    pgtoCartao: Number(row.pgto_cartao || 0),
    pgtoDinheiro: Number(row.pgto_dinheiro || 0),
    pgtoBoleto: Number(row.pgto_boleto || 0),
    pgtoOutros: Number(row.pgto_outros || 0),
    observacoes: row.observacoes || "",
    clientId: row.client_id ?? null,
    clientNome: row.client_nome || "",
    cancelMotivo: row.cancel_motivo || "",
    canceledAt: row.canceled_at || "",
    items,
  };
}

function dbRowToOrderItem(row: any): OrderItem {
  return {
    id: row.id,
    barcode: row.barcode || "",
    productName: row.product_name || "",
    quantidade: Number(row.quantidade),
    valorUnitario: Number(row.valor_unitario),
    descontoPercentual: Number(row.desconto_percentual || 0),
    totalBruto: Number(row.total_bruto),
    desconto: Number(row.desconto),
    totalLiquido: Number(row.total_liquido),
  };
}

export function useOrdersSupabase() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch all sales that belong to orders
      const orderIds = (ordersData || []).map((o) => o.id);
      
      if (orderIds.length === 0) {
        setOrders([]);
        return;
      }

      // Batch order IDs to avoid URL length limits (max ~50 per request)
      const BATCH_SIZE = 50;
      let allSalesData: any[] = [];
      for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);
        const { data: salesData, error: salesError } = await supabase
          .from("sales")
          .select("*")
          .in("order_id", batch);

        if (salesError) throw salesError;
        if (salesData) allSalesData = [...allSalesData, ...salesData];
      }

      // Group sales by order_id
      const salesByOrder: Record<string, OrderItem[]> = {};
      allSalesData.forEach((sale) => {
        if (sale.order_id) {
          if (!salesByOrder[sale.order_id]) {
            salesByOrder[sale.order_id] = [];
          }
          salesByOrder[sale.order_id].push(dbRowToOrderItem(sale));
        }
      });

      // Map orders with their items
      const mappedOrders = (ordersData || []).map((orderRow) =>
        dbRowToOrder(orderRow, salesByOrder[orderRow.id] || [])
      );

      setOrders(mappedOrders);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast({
        title: "Erro ao carregar pedidos",
        description: "Não foi possível conectar ao banco de dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrder = useCallback(
    async (
      orderData: {
        vendedor: string;
        formaPagamento: string;
        items: Omit<OrderItem, "id">[];
        descontoManual?: number;
        pgtoValues?: Record<string, number>;
        observacoes?: string;
        clientId?: string | null;
        clientNome?: string;
      }
    ): Promise<Order | null> => {
      try {
        const manualDiscount = orderData.descontoManual || 0;
        
        // Calculate totals before manual discount
        const totalBruto = orderData.items.reduce((sum, item) => sum + item.totalBruto, 0);
        const totalDescontoProdutos = orderData.items.reduce((sum, item) => sum + item.desconto, 0);
        const subtotalLiquido = orderData.items.reduce((sum, item) => sum + item.totalLiquido, 0);

        // Apply manual discount to overall order totals
        const orderTotalDesconto = totalDescontoProdutos + manualDiscount;
        const orderTotalLiquido = Math.max(0, subtotalLiquido - manualDiscount);

        const pgto = orderData.pgtoValues || {};

        // Prepare sales items, distributing manual discount proportionally
        const salesInserts = orderData.items.map((item) => {
          let itemDesconto = item.desconto;
          let itemTotalLiquido = item.totalLiquido;

          if (manualDiscount > 0 && subtotalLiquido > 0) {
            const proportion = item.totalLiquido / subtotalLiquido;
            const allocatedManualDiscount = manualDiscount * proportion;
            itemDesconto += allocatedManualDiscount;
            itemTotalLiquido -= allocatedManualDiscount;
          }

          return {
            barcode: item.barcode,
            product_name: item.productName,
            quantidade: item.quantidade,
            valor_unitario: item.valorUnitario,
            desconto_percentual: item.descontoPercentual,
            total_bruto: item.totalBruto,
            desconto: itemDesconto,
            total_liquido: itemTotalLiquido,
            valor_pago: itemTotalLiquido,
          };
        });

        // Pedido + itens + baixa de estoque numa única transação (RPC create_order).
        // A baixa (SAIDA_VENDA) e o custo da venda são gravados pelo trigger de vendas.
        const { data, error: rpcError } = await supabase.rpc("create_order", {
          _order: {
            vendedor: orderData.vendedor,
            forma_pagamento: orderData.formaPagamento,
            total_bruto: totalBruto,
            total_desconto: orderTotalDesconto,
            total_liquido: orderTotalLiquido,
            valor_pago: orderTotalLiquido,
            troco: 0,
            pgto_pix: pgto["PIX"] || 0,
            pgto_cartao: pgto["CARTAO"] || 0,
            pgto_dinheiro: pgto["DINHEIRO"] || 0,
            pgto_boleto: pgto["BOLETO"] || 0,
            pgto_outros: pgto["OUTROS"] || 0,
            observacoes: orderData.observacoes || "",
            client_id: orderData.clientId || null,
            client_nome: orderData.clientNome || "",
          },
          _items: salesInserts,
        });

        if (rpcError) throw rpcError;

        const result = data as unknown as { order: Tables<"orders">; items: Tables<"sales">[] };
        const orderRow = result.order;
        const salesData = result.items;

        const newOrder = dbRowToOrder(
          orderRow,
          (salesData || []).map(dbRowToOrderItem)
        );

        setOrders((prev) => [newOrder, ...prev]);

        toast({
          title: "Pedido registrado",
          description: `Pedido com ${orderData.items.length} produto(s) salvo com sucesso.`,
        });

        return newOrder;
      } catch (error) {
        console.error("Erro ao criar pedido:", error);
        const message = (error as { message?: string })?.message || "";
        toast({
          title: message.startsWith("SALDO_INSUFICIENTE") ? "Saldo insuficiente" : "Erro ao salvar pedido",
          description: message.startsWith("SALDO_INSUFICIENTE")
            ? dbErrorMessage(error)
            : "Não foi possível salvar o pedido no banco de dados.",
          variant: "destructive",
        });
        return null;
      }
    },
    []
  );

  const cancelOrder = useCallback(async (id: string, motivo: string): Promise<boolean> => {
    try {
      // Cancela o pedido e os itens; o trigger de vendas estorna o estoque (ESTORNO_VENDA)
      const { error: cancelError } = await supabase.rpc("cancel_order", { _order_id: id, _motivo: motivo });
      if (cancelError) throw cancelError;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === id
            ? {
                ...o,
                status: "CANCELADA" as SaleStatus,
                cancelMotivo: motivo,
                canceledAt: new Date().toISOString(),
              }
            : o
        )
      );

      toast({
        title: "Pedido cancelado",
        description: "O pedido e todos os itens foram cancelados.",
      });

      return true;
    } catch (error) {
      console.error("Erro ao cancelar pedido:", error);
      toast({
        title: "Erro ao cancelar pedido",
        description: "Não foi possível cancelar o pedido.",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  return {
    orders,
    loading,
    createOrder,
    cancelOrder,
    refetch: fetchOrders,
  };
}