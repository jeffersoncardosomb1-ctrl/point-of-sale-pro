import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  CloudOff,
  Keyboard,
  KeyboardOff,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Save,
  RefreshCw,
  ScanBarcode,
  Search,
  Trash2,
  Wifi,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StockLayout } from "@/components/stock/StockLayout";
import { CameraScanner } from "@/components/stock/CameraScanner";
import { InventoryStatusBadge } from "@/components/stock/InventoryStatusBadge";
import { CountedItem, SaveResult, useInventoryCount } from "@/hooks/useInventoryCount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { beep } from "@/lib/device";
import { dbErrorMessage, formatDateTime, formatQty } from "@/lib/stock-utils";
import { safeNumber } from "@/lib/sales-utils";
import { cn } from "@/lib/utils";

const KEYBOARD_PREF = "fiorenza_inv_soft_keyboard";

interface LastRead {
  barcode: string;
  name: string;
  unknown: boolean;
  added: number;
  at: number;
}

export default function InventoryCountPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const inv = useInventoryCount(id);
  const { count, items, editable, catalog } = inv;

  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const qtyRef = useRef(qty);
  qtyRef.current = qty;
  const [last, setLast] = useState<LastRead | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editing, setEditing] = useState<CountedItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleting, setDeleting] = useState<CountedItem | null>(null);
  const [search, setSearch] = useState("");
  const [softKeyboard, setSoftKeyboard] = useState(() => {
    try {
      return localStorage.getItem(KEYBOARD_PREF) !== "off";
    } catch {
      return true;
    }
  });

  const dialogOpen = cameraOpen || !!editing || !!deleting;

  const focusInput = useCallback(() => {
    if (!dialogOpen) inputRef.current?.focus();
  }, [dialogOpen]);

  useEffect(() => {
    focusInput();
  }, [focusInput, count?.status, inv.isLoading]);

  // Contagem fechada: vai para a visualização somente leitura
  useEffect(() => {
    if (count && !editable) navigate(`/estoque/inventario/${id}/conferencia`, { replace: true });
  }, [count, editable, id, navigate]);

  const lastItem = useMemo(() => {
    if (!last) return null;
    const p = catalog.findByBarcode(last.barcode);
    return items.find((i) => (p ? i.productId === p.id : i.barcode === last.barcode)) ?? null;
  }, [last, items, catalog]);

  const registerRead = useCallback(
    (rawCode: string, quantity?: number) => {
      const c = rawCode.trim();
      if (!c) return;
      const q = quantity ?? safeNumber(qtyRef.current);
      if (!(q > 0)) {
        toast({ title: "Quantidade inválida", description: "Informe uma quantidade maior que zero.", variant: "destructive" });
        return;
      }
      const product = catalog.findByBarcode(c);
      inv.addEntry(c, q);
      beep(product ? "ok" : "warn");
      setLast({
        barcode: product?.barcode ?? c,
        name: product?.product_name ?? "PRODUTO A IDENTIFICAR",
        unknown: !product,
        added: q,
        at: Date.now(),
      });
      setQty("1");
    },
    [catalog, inv]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Lê direto do campo: leitores USB/Bluetooth digitam e mandam Enter mais rápido que a renderização
    registerRead(inputRef.current?.value ?? code);
    setCode("");
    inputRef.current?.focus();
  }

  function handleBlur() {
    // Mantém o foco no campo do leitor, exceto quando o usuário foi para outro campo/diálogo
    window.setTimeout(() => {
      const active = document.activeElement;
      if (!dialogOpen && (!active || active === document.body)) inputRef.current?.focus();
    }, 150);
  }

  function toggleKeyboard() {
    const next = !softKeyboard;
    setSoftKeyboard(next);
    try {
      localStorage.setItem(KEYBOARD_PREF, next ? "on" : "off");
    } catch {
      // opcional
    }
    inputRef.current?.blur();
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  const toConference = useMutation({
    mutationFn: async () => {
      if (count?.status === "ABERTA") {
        const { error } = await supabase.rpc("set_inventory_status", { _count_id: id, _status: "EM_CONFERENCIA" });
        if (error) throw error;
      }
    },
    onSuccess: () => navigate(`/estoque/inventario/${id}/conferencia`),
    onError: (err) => toast({ title: "Erro", description: dbErrorMessage(err), variant: "destructive" }),
  });

  const save = useMutation({
    mutationFn: (item: CountedItem) => inv.saveItem(item),
    onSuccess: (r: SaveResult) => {
      beep("ok");
      const durante =
        r.movimentos_durante !== 0
          ? ` (${formatQty(Math.abs(r.movimentos_durante))} ${
              Math.abs(r.movimentos_durante) === 1
                ? r.movimentos_durante < 0 ? "saiu" : "entrou"
                : r.movimentos_durante < 0 ? "saíram" : "entraram"
            } durante a contagem)`
          : "";
      toast({
        title: `Salvo: ${r.product_name}`,
        description: `Contado ${formatQty(r.contado)}${durante}. Saldo atualizado: ${formatQty(r.saldo_anterior)} → ${formatQty(r.saldo_novo)}.`,
      });
      window.setTimeout(() => inputRef.current?.focus(), 50);
    },
    onError: (err) => {
      beep("warn");
      toast({ title: "Não foi possível salvar", description: dbErrorMessage(err), variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.barcode.includes(q));
  }, [items, search]);

  const countingItems = filtered.filter((i) => i.counting);
  const savedItems = filtered.filter((i) => !i.counting && i.saved);
  const countingTotal = items.filter((i) => i.counting).length;
  const savedTotal = items.filter((i) => i.saved).length;
  const unknownCount = items.filter((i) => i.unknown && i.counting).length;
  const canSaveLast = !!lastItem?.counting && !save.isPending;

  if (inv.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!count) {
    return (
      <StockLayout title="Contagem" backTo="/estoque/inventario">
        <p className="text-muted-foreground">Contagem não encontrada.</p>
      </StockLayout>
    );
  }

  const lastReadCard = last && (
    <div
      key={last.at}
      className={cn(
        "rounded-xl border-2 p-3 animate-scale-in",
        last.unknown ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : "border-success/50 bg-success/5"
      )}
    >
      <div className="flex items-start gap-3">
        {last.unknown ? (
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-6 w-6 text-success flex-shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase text-muted-foreground">Último item lido · +{formatQty(last.added)}</div>
          <div className="font-semibold text-base leading-tight break-words">{last.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{last.barcode}</div>
          {last.unknown && (
            <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Código não cadastrado: será criado como "A IDENTIFICAR" ao salvar.
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{lastItem && !lastItem.counting ? "Salvo" : "Contando"}</div>
          <div className="text-3xl font-bold tabular-nums">
            {formatQty(lastItem ? (lastItem.counting ? lastItem.total : lastItem.saved?.quantidade) : last.added)}
          </div>
        </div>
      </div>
      {lastItem?.counting ? (
        <Button
          type="button"
          className="mt-3 w-full h-14 text-lg gap-2"
          onClick={() => lastItem && save.mutate(lastItem)}
          disabled={!canSaveLast}
        >
          {save.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Salvar contagem deste produto
        </Button>
      ) : lastItem?.saved ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Salvo — saldo já atualizado no estoque. Leia de novo para recontar.
        </div>
      ) : null}
    </div>
  );

  return (
    <StockLayout
      compact
      title={`Contagem nº ${count.numero}`}
      subtitle={count.observacoes || formatDateTime(count.created_at)}
      backTo="/estoque/inventario"
    >
      {/* Barra de status */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <InventoryStatusBadge status={count.status} />
        {inv.online ? (
          <Badge variant="outline" className="gap-1 text-success border-success/30">
            <Wifi className="h-3 w-3" /> Online
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
            <CloudOff className="h-3 w-3" /> Offline
          </Badge>
        )}
        {inv.pendingCount > 0 && (
          <Button variant="outline" size="sm" className="h-7 gap-1" onClick={() => inv.flush()}>
            <RefreshCw className="h-3 w-3" />
            {inv.pendingCount} a sincronizar
          </Button>
        )}
        <span className="ml-auto text-muted-foreground">
          {countingTotal} contando · {savedTotal} salvos
          {unknownCount > 0 && <span className="text-amber-600"> · {unknownCount} a identificar</span>}
        </span>
      </div>

      {/* Leitor */}
      <Card className="border-primary/40 shadow-sm">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
              <Input
                ref={inputRef}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onBlur={handleBlur}
                placeholder="Bipe ou digite o código"
                inputMode={softKeyboard ? "numeric" : "none"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="send"
                className="h-14 pl-12 pr-12 text-xl font-mono placeholder:font-sans placeholder:text-base"
                aria-label="Código de barras"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-12 w-12"
                onClick={toggleKeyboard}
                aria-label={softKeyboard ? "Esconder teclado virtual" : "Mostrar teclado virtual"}
                title={softKeyboard ? "Esconder teclado virtual (usar leitor)" : "Mostrar teclado virtual"}
              >
                {softKeyboard ? <Keyboard className="h-5 w-5" /> : <KeyboardOff className="h-5 w-5" />}
              </Button>
            </div>

            <div className="flex items-stretch gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-14 w-14 p-0"
                onClick={() => setQty(String(Math.max(1, safeNumber(qty) - 1)))}
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-6 w-6" />
              </Button>
              <Input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onFocus={(e) => e.target.select()}
                inputMode="decimal"
                className="h-14 w-20 text-center text-xl font-semibold"
                aria-label="Quantidade"
              />
              <Button
                type="button"
                variant="outline"
                className="h-14 w-14 p-0"
                onClick={() => setQty(String(safeNumber(qty) + 1))}
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-6 w-6" />
              </Button>
              <Button type="submit" className="h-14 flex-1 text-lg">
                Lançar
              </Button>
            </div>
          </form>

          <Button
            type="button"
            variant="secondary"
            className="w-full h-16 text-lg gap-3 hidden sm:flex"
            onClick={() => setCameraOpen(true)}
          >
            <Camera className="h-6 w-6" />
            Escanear com câmera
          </Button>

          {lastReadCard}
        </CardContent>
      </Card>

      {/* Itens contados */}
      <div className="space-y-2 pb-28 sm:pb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nos itens contados..."
            className="pl-9 h-11"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            {items.length === 0 ? "Nenhum item contado ainda. Comece lendo um código." : "Nenhum item encontrado."}
          </p>
        ) : (
          <>
            {countingItems.length > 0 && (
              <section className="space-y-1">
                <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300 px-1">
                  Contando — não salvos ({countingItems.length})
                </h2>
                <ul className="divide-y rounded-lg border border-amber-300/60 bg-card">
                  {countingItems.map((i) => (
                    <li key={i.key} className="flex items-center gap-1.5 p-3">
                      <div className="min-w-0 flex-1">
                        <div className={cn("font-medium leading-tight break-words", i.unknown && "text-amber-700 dark:text-amber-300")}>
                          {i.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono">{i.barcode}</span> · {i.leituras} lanç. · {i.lastUser}
                          {i.saved && <span> · recontagem (antes {formatQty(i.saved.quantidade)})</span>}
                          {i.pending > 0 && <span className="text-amber-600"> · aguardando envio</span>}
                        </div>
                      </div>
                      <div className="text-2xl font-bold tabular-nums w-12 text-right">{formatQty(i.total)}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-10"
                        onClick={() => {
                          setEditing(i);
                          setEditValue(String(i.total));
                        }}
                        aria-label={`Editar ${i.name}`}
                      >
                        <Pencil className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-10 text-destructive"
                        onClick={() => setDeleting(i)}
                        aria-label={`Excluir ${i.name}`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                      <Button
                        className="h-11 px-3 gap-1"
                        onClick={() => save.mutate(i)}
                        disabled={save.isPending}
                        aria-label={`Salvar ${i.name}`}
                      >
                        <Save className="h-4 w-4" />
                        <span className="hidden sm:inline">Salvar</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {savedItems.length > 0 && (
              <section className="space-y-1">
                <h2 className="text-sm font-semibold text-success px-1">Salvos — saldo já atualizado ({savedItems.length})</h2>
                <ul className="divide-y rounded-lg border bg-card">
                  {savedItems.map((i) => (
                    <li key={i.key} className="flex items-center gap-2 p-3">
                      <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-tight break-words">{i.name}</div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono">{i.barcode}</span> · por {i.saved?.by || "-"} às{" "}
                          {i.saved ? formatDateTime(i.saved.at) : "-"}
                        </div>
                      </div>
                      <div className="text-2xl font-bold tabular-nums w-14 text-right">
                        {formatQty(i.saved?.quantidade)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <div className="hidden sm:flex justify-end pt-2">
          <Button onClick={() => toConference.mutate()} disabled={toConference.isPending} className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Ir para conferência
          </Button>
        </div>
      </div>

      {/* Barra inferior (celular, uso com uma mão) */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
        <Button
          variant="outline"
          className="h-16 w-24 flex-col gap-1 text-xs"
          onClick={() => toConference.mutate()}
          disabled={toConference.isPending}
        >
          <ClipboardCheck className="h-6 w-6" />
          Conferência
        </Button>
        <Button
          variant="secondary"
          className="h-16 w-24 flex-col gap-1 text-xs"
          onClick={() => setCameraOpen(true)}
        >
          <Camera className="h-6 w-6" />
          Câmera
        </Button>
        <Button
          className="h-16 flex-1 text-base gap-2"
          onClick={() => lastItem && save.mutate(lastItem)}
          disabled={!canSaveLast}
        >
          {save.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
          Salvar produto
        </Button>
      </div>

      <CameraScanner
        open={cameraOpen}
        continuous
        onClose={() => {
          setCameraOpen(false);
          window.setTimeout(() => inputRef.current?.focus(), 100);
        }}
        onDetected={(c) => registerRead(c)}
        footer={lastReadCard}
        title="Contar com a câmera"
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar quantidade (não salva)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="font-medium">{editing?.name}</div>
            <div className="font-mono text-xs text-muted-foreground">{editing?.barcode}</div>
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onFocus={(e) => e.target.select()}
              inputMode="decimal"
              className="h-14 text-2xl text-center"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const v = safeNumber(editValue);
                if (v < 0) {
                  toast({ title: "Quantidade inválida", variant: "destructive" });
                  return;
                }
                if (editing) inv.setItemTotal(editing, v);
                setEditing(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item da contagem?</AlertDialogTitle>
            <AlertDialogDescription>
              As leituras não salvas de {deleting?.name} ({formatQty(deleting?.total)} un) serão descartadas. Uma
              contagem já salva deste produto não é alterada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleting) inv.removeItem(deleting);
                setDeleting(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StockLayout>
  );
}
