import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleHelp, Loader2, Merge, PencilLine, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StockLayout } from "@/components/stock/StockLayout";
import { CatalogProduct, useProductCatalog } from "@/hooks/useProductCatalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatBRL, safeNumber } from "@/lib/sales-utils";
import { dbErrorMessage, formatCost, formatQty } from "@/lib/stock-utils";
import { cn } from "@/lib/utils";

export default function UnidentifiedProductsPage() {
  const queryClient = useQueryClient();
  const catalog = useProductCatalog();
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [merging, setMerging] = useState<CatalogProduct | null>(null);

  const pending = useMemo(() => catalog.products.filter((p) => p.pendente_identificacao), [catalog.products]);
  const categories = useMemo(
    () => Array.from(new Set(catalog.products.map((p) => p.category).filter(Boolean))).sort(),
    [catalog.products]
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["stock-products"] });

  return (
    <StockLayout title="Produtos a identificar" subtitle="Códigos lidos no inventário que não tinham cadastro">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CircleHelp className="h-5 w-5 text-amber-600" />
            Pendentes ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {catalog.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : pending.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum produto pendente de identificação. 🎉</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {pending.map((p) => (
                <li key={p.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium break-words">{p.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Código <span className="font-mono">{p.barcode}</span> · saldo {formatQty(p.stock)} · custo{" "}
                      {formatCost(p.cost_avg)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="default" className="gap-2 flex-1 sm:flex-none" onClick={() => setEditing(p)}>
                      <PencilLine className="h-4 w-4" />
                      Completar cadastro
                    </Button>
                    <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => setMerging(p)}>
                      <Merge className="h-4 w-4" />
                      Mesclar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <IdentifyDialog product={editing} categories={categories} onClose={() => setEditing(null)} onDone={refresh} />
      <MergeDialog
        source={merging}
        candidates={catalog.products}
        onClose={() => setMerging(null)}
        onDone={refresh}
      />
    </StockLayout>
  );
}

function IdentifyDialog({
  product,
  categories,
  onClose,
  onDone,
}: {
  product: CatalogProduct | null;
  categories: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({ name: "", category: "", price: "", cost: "" });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (product && loadedFor !== product.id) {
    setLoadedFor(product.id);
    setForm({
      name: product.product_name.startsWith("A IDENTIFICAR") ? "" : product.product_name,
      category: product.category,
      price: product.price ? String(product.price).replace(".", ",") : "",
      cost: product.cost_avg ? String(product.cost_avg).replace(".", ",") : "",
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("identify_product", {
        _product_id: product!.id,
        _product_name: form.name.trim(),
        _category: form.category.trim(),
        _price: safeNumber(form.price),
        _cost: safeNumber(form.cost),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Produto identificado", description: form.name });
      onDone();
      onClose();
    },
    onError: (err) => toast({ title: "Erro", description: dbErrorMessage(err), variant: "destructive" }),
  });

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Completar cadastro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Código <span className="font-mono">{product?.barcode}</span> · saldo {formatQty(product?.stock)}
          </div>
          <div className="space-y-1">
            <Label htmlFor="id-name">Nome do produto *</Label>
            <Input id="id-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="id-cat">Categoria</Label>
            <Input
              id="id-cat"
              list="categorias"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <datalist id="categorias">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="id-price">Preço de venda (R$)</Label>
              <Input id="id-price" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="id-cost">Custo unitário (R$)</Label>
              <Input id="id-cost" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({
  source,
  candidates,
  onClose,
  onDone,
}: {
  source: CatalogProduct | null;
  candidates: CatalogProduct[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<CatalogProduct | null>(null);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return candidates
      .filter((p) => p.id !== source?.id && !p.pendente_identificacao)
      .filter((p) => p.product_name.toLowerCase().includes(q) || p.barcode.includes(q))
      .slice(0, 30);
  }, [search, candidates, source]);

  function close() {
    setSearch("");
    setTarget(null);
    onClose();
  }

  const merge = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("merge_products", { _source_id: source!.id, _target_id: target!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Produtos mesclados",
        description: `O código ${source?.barcode} agora é alternativo de ${target?.product_name}.`,
      });
      onDone();
      close();
    },
    onError: (err) => toast({ title: "Erro ao mesclar", description: dbErrorMessage(err), variant: "destructive" }),
  });

  return (
    <Dialog open={!!source} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mesclar com produto existente</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          O saldo ({formatQty(source?.stock)}) e as movimentações de <span className="font-mono">{source?.barcode}</span>{" "}
          serão transferidos para o produto escolhido, e o código passa a ser um código alternativo dele.
        </p>

        {!target ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar produto por nome ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <ul className="max-h-72 overflow-auto divide-y rounded-lg border">
              {results.map((p) => (
                <li key={p.id}>
                  <button className="w-full text-left p-2 hover:bg-muted" onClick={() => setTarget(p)}>
                    <div className="font-medium text-sm">{p.product_name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{p.barcode}</span> · saldo {formatQty(p.stock)} · {formatBRL(p.price)}
                    </div>
                  </button>
                </li>
              ))}
              {search.trim().length >= 2 && results.length === 0 && (
                <li className="p-3 text-sm text-muted-foreground text-center">Nenhum produto encontrado.</li>
              )}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border p-3 space-y-1 text-sm">
            <div className="text-xs text-muted-foreground">Produto de destino</div>
            <div className="font-semibold">{target.product_name}</div>
            <div className="font-mono text-xs">{target.barcode}</div>
            <div className={cn("pt-1")}>
              Saldo: {formatQty(target.stock)} + {formatQty(source?.stock)} ={" "}
              <strong>{formatQty(Number(target.stock) + Number(source?.stock ?? 0))}</strong>
            </div>
            <Button variant="link" className="px-0 h-auto" onClick={() => setTarget(null)}>
              Escolher outro
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={() => merge.mutate()} disabled={!target || merge.isPending}>
            {merge.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar mesclagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
