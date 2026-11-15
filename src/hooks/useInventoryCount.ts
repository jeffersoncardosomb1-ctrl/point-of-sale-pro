import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { fetchAllRows, useProductCatalog } from "@/hooks/useProductCatalog";
import { getDeviceId, getDeviceLabel, newId } from "@/lib/device";
import { dbErrorMessage } from "@/lib/stock-utils";

export type CountEntry = Tables<"inventory_count_entries">;
export type InventoryCount = Tables<"inventory_counts">;
export type EntryTipo = "LEITURA" | "AJUSTE" | "EXCLUSAO";

interface PendingEntry {
  id: string;
  count_id: string;
  barcode: string;
  quantidade: number;
  tipo: EntryTipo;
  client_created_at: string;
}

export interface CountedItem {
  key: string;
  barcode: string;
  productId: string | null;
  name: string;
  unknown: boolean;
  pendenteIdentificacao: boolean;
  total: number;
  leituras: number;
  lastAt: string;
  lastUser: string;
  pending: number;
}

const queueKey = (countId: string) => `fiorenza_inv_queue_${countId}`;

function loadQueue(countId: string): PendingEntry[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(countId)) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(countId: string, q: PendingEntry[]) {
  try {
    localStorage.setItem(queueKey(countId), JSON.stringify(q));
  } catch {
    // sem storage: segue só em memória
  }
}

/** Erro de rede (sem código Postgres) => mantém na fila; erro de negócio => descarta. */
function isNetworkError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (!navigator.onLine) return true;
  return !err.code || /fetch|network|timeout/i.test(err.message || "");
}

/**
 * Estado de uma contagem de inventário:
 *  - lançamentos do servidor (com Realtime de outros aparelhos);
 *  - fila offline local (cada lançamento tem UUID próprio; o envio é idempotente);
 *  - itens agregados por produto/código.
 */
export function useInventoryCount(countId: string) {
  const queryClient = useQueryClient();
  const catalog = useProductCatalog();
  const { byId, findByBarcode } = catalog;
  const [queue, setQueue] = useState<PendingEntry[]>(() => loadQueue(countId));
  const [online, setOnline] = useState(() => navigator.onLine);
  const flushing = useRef(false);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const countQuery = useQuery({
    queryKey: ["inventory-count", countId],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_counts").select("*").eq("id", countId).single();
      if (error) throw error;
      return data;
    },
  });

  const entriesKey = useMemo(() => ["inventory-entries", countId], [countId]);
  const entriesQuery = useQuery({
    queryKey: entriesKey,
    queryFn: () =>
      fetchAllRows<CountEntry>((from, to) =>
        supabase
          .from("inventory_count_entries")
          .select("*")
          .eq("count_id", countId)
          .order("created_at")
          .range(from, to)
      ),
  });

  // Realtime: lançamentos de outros aparelhos e mudança de status
  useEffect(() => {
    const channel = supabase
      .channel(`inventory-${countId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_count_entries", filter: `count_id=eq.${countId}` },
        (payload) => {
          const row = payload.new as CountEntry;
          queryClient.setQueryData<CountEntry[]>(entriesKey, (prev) =>
            !prev ? [row] : prev.some((e) => e.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inventory_counts", filter: `id=eq.${countId}` },
        (payload) => queryClient.setQueryData(["inventory-count", countId], payload.new)
      )
      .subscribe((status) => {
        // Ao (re)conectar, recarrega para não perder nada que chegou enquanto estava fora
        if (status === "SUBSCRIBED") queryClient.invalidateQueries({ queryKey: entriesKey });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [countId, entriesKey, queryClient]);

  const updateQueue = useCallback(
    (fn: (q: PendingEntry[]) => PendingEntry[]) => {
      const next = fn(queueRef.current);
      queueRef.current = next;
      saveQueue(countId, next);
      setQueue(next);
    },
    [countId]
  );

  const flush = useCallback(async () => {
    if (flushing.current || queueRef.current.length === 0) return;
    flushing.current = true;
    const deviceId = getDeviceId();
    const deviceLabel = getDeviceLabel();
    try {
      while (queueRef.current.length > 0) {
        const e = queueRef.current[0];
        const { error } = await supabase.rpc("register_count_entry", {
          _id: e.id,
          _count_id: e.count_id,
          _barcode: e.barcode,
          _quantidade: e.quantidade,
          _tipo: e.tipo,
          _device_id: deviceId,
          _device_label: deviceLabel,
          _client_created_at: e.client_created_at,
        });
        if (error && isNetworkError(error)) break;
        if (error) {
          toast({ title: "Lançamento recusado", description: dbErrorMessage(error), variant: "destructive" });
          if (/CONTAGEM_FECHADA/.test(error.message)) {
            updateQueue(() => []);
            queryClient.invalidateQueries({ queryKey: ["inventory-count", countId] });
            break;
          }
        }
        updateQueue((q) => q.filter((x) => x.id !== e.id));
      }
    } finally {
      flushing.current = false;
    }
    queryClient.invalidateQueries({ queryKey: entriesKey });
  }, [countId, entriesKey, queryClient, updateQueue]);

  // Sincroniza quando a conexão volta e periodicamente
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const timer = window.setInterval(flush, 10_000);
    flush();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
    };
  }, [flush]);

  const addEntry = useCallback(
    (barcode: string, quantidade: number, tipo: EntryTipo = "LEITURA") => {
      const code = barcode.trim();
      if (!code || !quantidade) return;
      updateQueue((q) => [
        ...q,
        { id: newId(), count_id: countId, barcode: code, quantidade, tipo, client_created_at: new Date().toISOString() },
      ]);
      // envio imediato (se offline, fica na fila)
      setTimeout(flush, 0);
    },
    [countId, flush, updateQueue]
  );

  const items = useMemo<CountedItem[]>(() => {
    const serverIds = new Set((entriesQuery.data || []).map((e) => e.id));
    type Row = { id: string; barcode: string; product_id: string | null; quantidade: number; tipo: string; at: string; user: string; pending: boolean };
    const rows: Row[] = [
      ...(entriesQuery.data || []).map((e) => ({
        id: e.id,
        barcode: e.barcode,
        product_id: e.product_id,
        quantidade: Number(e.quantidade),
        tipo: e.tipo,
        at: e.created_at,
        user: e.user_nome,
        pending: false,
      })),
      ...queue
        .filter((q) => !serverIds.has(q.id))
        .map((q) => ({
          id: q.id,
          barcode: q.barcode,
          product_id: null,
          quantidade: q.quantidade,
          tipo: q.tipo,
          at: q.client_created_at,
          user: "Este aparelho",
          pending: true,
        })),
    ];

    const map = new Map<string, CountedItem & { lastTipo: string }>();
    for (const r of rows) {
      const product = (r.product_id && byId.get(r.product_id)) || findByBarcode(r.barcode);
      const key = product?.id ?? `code:${r.barcode}`;
      const cur =
        map.get(key) ||
        ({
          key,
          barcode: product?.barcode ?? r.barcode,
          productId: product?.id ?? null,
          name: product?.product_name ?? "PRODUTO A IDENTIFICAR",
          unknown: !product,
          pendenteIdentificacao: product?.pendente_identificacao ?? true,
          total: 0,
          leituras: 0,
          lastAt: r.at,
          lastUser: r.user,
          pending: 0,
          lastTipo: r.tipo,
        } as CountedItem & { lastTipo: string });
      cur.total += r.quantidade;
      cur.leituras += 1;
      if (r.pending) cur.pending += 1;
      if (r.at >= cur.lastAt) {
        cur.lastAt = r.at;
        cur.lastUser = r.user;
        cur.lastTipo = r.tipo;
      }
      map.set(key, cur);
    }
    return Array.from(map.values())
      .filter((i) => i.lastTipo !== "EXCLUSAO" || i.total !== 0)
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [entriesQuery.data, queue, byId, findByBarcode]);

  const setItemTotal = useCallback(
    (item: CountedItem, newTotal: number) => {
      const delta = newTotal - item.total;
      if (delta !== 0) addEntry(item.barcode, delta, "AJUSTE");
    },
    [addEntry]
  );

  const removeItem = useCallback(
    (item: CountedItem) => addEntry(item.barcode, -item.total, "EXCLUSAO"),
    [addEntry]
  );

  const count = countQuery.data;
  const editable = count?.status === "ABERTA" || count?.status === "EM_CONFERENCIA";

  return {
    count,
    editable,
    isLoading: countQuery.isLoading || entriesQuery.isLoading,
    error: countQuery.error,
    items,
    pendingCount: queue.length,
    online,
    addEntry,
    setItemTotal,
    removeItem,
    flush,
    catalog,
    refetchCount: countQuery.refetch,
  };
}
