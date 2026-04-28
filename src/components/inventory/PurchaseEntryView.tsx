import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/sales-utils";

interface ParsedItem {
  product_name: string;
  barcode: string;
  quantidade: number;
  valor_custo: number;
  valor_venda: number;
  _error?: string;
}

function parseNumber(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

export function PurchaseEntryView() {
  const { firstName, lastName } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<{ entryId: string; count: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const vendedor = [firstName, lastName].filter(Boolean).join(" ") || "Admin";

  function reset() {
    setFile(null);
    setItems([]);
    setDone(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setDone(null);

    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      const parsed: ParsedItem[] = rows.map((row) => {
        const norm: Record<string, any> = {};
        Object.entries(row).forEach(([k, v]) => {
          norm[String(k).trim().toLowerCase()] = v;
        });
        const barcode = String(
          norm["código barras"] ?? norm["codigo barras"] ?? norm["código de barras"] ??
          norm["codigo de barras"] ?? norm["barcode"] ?? norm["codigo"] ?? norm["código"] ?? ""
        ).trim();
        const product_name = String(
          norm["descrição"] ?? norm["descricao"] ?? norm["nome produto"] ?? norm["produto"] ?? norm["nome"] ?? ""
        ).trim();
        const quantidade = parseNumber(norm["quantidade"] ?? norm["qtd"] ?? norm["qtde"]);
        const valor_custo = parseNumber(norm["valor custo"] ?? norm["custo"] ?? norm["valor de custo"]);
        const valor_venda = parseNumber(norm["valor de venda"] ?? norm["valor venda"] ?? norm["preço"] ?? norm["preco"] ?? norm["venda"]);

        let _error: string | undefined;
        if (!barcode) _error = "Código de barras vazio";
        else if (quantidade <= 0) _error = "Quantidade inválida";
        else if (valor_custo < 0) _error = "Custo inválido";

        return { product_name, barcode, quantidade, valor_custo, valor_venda, _error };
      });

      setItems(parsed);
      const validCount = parsed.filter((p) => !p._error).length;
      toast({
        title: "Arquivo lido",
        description: `${parsed.length} linhas, ${validCount} válidas para importar.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao ler arquivo", description: String(err), variant: "destructive" });
    }
  }

  async function handleImport() {
    const valid = items.filter((p) => !p._error);
    if (!valid.length) {
      toast({ title: "Nada a importar", description: "Nenhuma linha válida.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("apply_purchase_entry", {
        _file_name: file?.name || "",
        _vendedor: vendedor,
        _items: valid.map(({ _error, ...rest }) => rest),
      });
      if (error) throw error;
      setDone({ entryId: String(data), count: valid.length });
      toast({
        title: "Entrada registrada",
        description: `${valid.length} produtos processados com sucesso.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao importar",
        description: err?.message || "Falha ao processar entrada.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  const totalQty = items.reduce((s, i) => s + (i._error ? 0 : i.quantidade), 0);
  const totalCost = items.reduce((s, i) => s + (i._error ? 0 : i.quantidade * i.valor_custo), 0);
  const errorCount = items.filter((i) => i._error).length;

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Entrada de Compras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Faça upload de uma planilha Excel/CSV com colunas:{" "}
            <strong>Descrição, Código barras, Quantidade, Valor Custo, Valor de venda</strong>.
            O sistema atualizará o estoque, recalculará o custo médio ponderado e criará produtos novos automaticamente.
          </p>
          <div className="space-y-2">
            <Label htmlFor="purchase-file">Planilha de compra</Label>
            <Input
              id="purchase-file"
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              disabled={processing}
            />
          </div>

          {items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Linhas</div>
                <div className="text-lg font-bold">{items.length}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Quantidade</div>
                <div className="text-lg font-bold">{totalQty}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Custo total</div>
                <div className="text-lg font-bold">{formatBRL(totalCost)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Com erro</div>
                <div className={`text-lg font-bold ${errorCount ? "text-destructive" : ""}`}>{errorCount}</div>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2 text-right">Qtd</th>
                      <th className="px-3 py-2 text-right">Custo</th>
                      <th className="px-3 py-2 text-right">Venda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 200).map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">
                          {it._error ? (
                            <span className="inline-flex items-center gap-1 text-destructive text-xs">
                              <AlertCircle className="h-3 w-3" /> {it._error}
                            </span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{it.barcode}</td>
                        <td className="px-3 py-2">{it.product_name}</td>
                        <td className="px-3 py-2 text-right">{it.quantidade}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(it.valor_custo)}</td>
                        <td className="px-3 py-2 text-right">{formatBRL(it.valor_venda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {items.length > 200 && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50">
                  Mostrando 200 de {items.length} linhas
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={reset} disabled={processing}>
              Limpar
            </Button>
            <Button onClick={handleImport} disabled={processing || !items.some((i) => !i._error)}>
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Importar entrada</>
              )}
            </Button>
          </div>

          {done && (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                Entrada #{done.entryId.slice(0, 8)} registrada — {done.count} produtos atualizados.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}