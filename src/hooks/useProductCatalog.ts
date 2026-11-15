import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogProduct {
  id: string;
  barcode: string;
  product_name: string;
  category: string;
  price: number;
  stock: number;
  cost_avg: number;
  pendente_identificacao: boolean;
}

const CACHE_KEY = "fiorenza_catalog_cache_v1";
const PAGE = 1000;

/** Busca todas as linhas de uma tabela, paginando (o PostgREST limita a 1000 por requisição). */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

interface CatalogData {
  products: CatalogProduct[];
  alternates: { barcode: string; product_id: string }[];
}

function readCache(): CatalogData | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CatalogData) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchCatalog(): Promise<CatalogData> {
  const [products, alternates] = await Promise.all([
    fetchAllRows<CatalogProduct>((from, to) =>
      supabase
        .from("products")
        .select("id, barcode, product_name, category, price, stock, cost_avg, pendente_identificacao")
        .order("product_name")
        .range(from, to)
    ),
    fetchAllRows<{ barcode: string; product_id: string }>((from, to) =>
      supabase.from("product_barcodes").select("barcode, product_id").range(from, to)
    ),
  ]);
  const data = { products, alternates };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // cache é opcional
  }
  return data;
}

/**
 * Catálogo completo em memória (com cópia local para funcionar offline),
 * com busca instantânea por código principal ou alternativo.
 */
export function useProductCatalog() {
  const query = useQuery({
    queryKey: ["stock-products"],
    queryFn: fetchCatalog,
    initialData: readCache,
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
  });

  const { byId, byBarcode } = useMemo(() => {
    const byId = new Map<string, CatalogProduct>();
    const byBarcode = new Map<string, CatalogProduct>();
    query.data?.products.forEach((p) => {
      byId.set(p.id, p);
      byBarcode.set(p.barcode, p);
    });
    query.data?.alternates.forEach((a) => {
      const p = byId.get(a.product_id);
      if (p && !byBarcode.has(a.barcode)) byBarcode.set(a.barcode, p);
    });
    return { byId, byBarcode };
  }, [query.data]);

  const findByBarcode = useCallback((code: string) => byBarcode.get(code.trim()), [byBarcode]);

  return {
    products: query.data?.products ?? [],
    alternates: query.data?.alternates ?? [],
    byId,
    findByBarcode,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
