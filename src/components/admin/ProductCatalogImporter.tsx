import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProductCatalogImporterProps {
  onImportComplete: () => void;
}

export function ProductCatalogImporter({ onImportComplete }: ProductCatalogImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setImportResult(null);
    } else {
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: "Erro", description: "Por favor, selecione um arquivo Excel ou CSV.", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) { // Assumindo linha de cabeçalho + pelo menos uma linha de dados
          toast({ title: "Erro", description: "O arquivo está vazio ou não tem dados suficientes.", variant: "destructive" });
          setIsImporting(false);
          return;
        }

        // Assumindo que a primeira linha é o cabeçalho, e os dados começam da segunda linha
        // Assumindo que a primeira coluna é o código de barras e a segunda é o nome do produto
        const productsToInsert = (json.slice(1) as string[][])
          .filter(row => row[0] && row[1]) // Filtrar linhas com código de barras ou nome de produto vazios
          .map(row => ({
            barcode: String(row[0]).trim(),
            product_name: String(row[1]).trim(),
          }));

        if (productsToInsert.length === 0) {
          toast({ title: "Erro", description: "Nenhum produto válido encontrado no arquivo para importação.", variant: "destructive" });
          setIsImporting(false);
          return;
        }

        let successCount = 0;
        let failCount = 0;

        // Usando upsert para lidar com códigos de barras existentes (atualiza se existir, insere se for novo)
        const { error } = await supabase
          .from("products")
          .upsert(productsToInsert, { onConflict: 'barcode' }); // Conflito no código de barras para atualizar existentes

        if (error) {
          console.error("Erro ao importar produtos:", error);
          toast({ title: "Erro na importação", description: `Falha ao importar produtos: ${error.message}`, variant: "destructive" });
          failCount = productsToInsert.length;
        } else {
          successCount = productsToInsert.length;
          toast({ title: "Importação concluída", description: `${successCount} produtos importados/atualizados com sucesso.`, variant: "success" });
          onImportComplete(); // Notificar o componente pai
        }
        
        setImportResult({ success: successCount, failed: failCount });
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast({ title: "Erro", description: "Erro ao ler o arquivo.", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Importar Catálogo de Produtos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Faça upload de um arquivo Excel (.xlsx) ou CSV com códigos de barras e nomes de produtos.
          A primeira coluna deve ser o código de barras e a segunda o nome do produto.
        </p>
        <div className="space-y-2">
          <Label htmlFor="product-file">Arquivo Excel/CSV</Label>
          <Input
            id="product-file"
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            disabled={isImporting}
          />
          {file && <p className="text-sm text-muted-foreground">Arquivo selecionado: {file.name}</p>}
        </div>
        <Button
          onClick={handleImport}
          disabled={!file || isImporting}
          className="w-full"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Iniciar Importação
            </>
          )}
        </Button>

        {importResult && (
          <div className="mt-4 space-y-2">
            <p className="font-medium">Resultado da Importação:</p>
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span>Sucesso: {importResult.success} produtos</span>
            </div>
            {importResult.failed > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                <span>Falha: {importResult.failed} produtos</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}