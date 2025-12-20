import { useState, useEffect } from "react";
import { UserPlus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { addSeller, loadSellers, saveSellers } from "@/lib/sales-utils";
import { Seller } from "@/types/sales";

export function SellerRegistrationForm() {
  const [newSellerName, setNewSellerName] = useState("");
  const [sellers, setSellers] = useState<Seller[]>([]);

  useEffect(() => {
    setSellers(loadSellers());
  }, []);

  const handleAddSeller = () => {
    const name = newSellerName.trim();
    if (!name) {
      toast({ title: "Erro", description: "O nome do vendedor não pode ser vazio.", variant: "destructive" });
      return;
    }
    if (sellers.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Erro", description: "Já existe um vendedor com este nome.", variant: "destructive" });
      return;
    }

    const addedSeller = addSeller(name);
    setSellers((prev) => [...prev, addedSeller]);
    setNewSellerName("");
    toast({ title: "Sucesso!", description: `Vendedor "${name}" cadastrado.` });
  };

  const handleDeleteSeller = (id: string) => {
    if (!confirm("Tem certeza que deseja remover este vendedor?")) return;
    const updatedSellers = sellers.filter(s => s.id !== id);
    saveSellers(updatedSellers);
    setSellers(updatedSellers);
    toast({ title: "Vendedor removido", description: "O vendedor foi removido com sucesso." });
  };

  return (
    <Card className="shadow-card animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg">Cadastrar Vendedor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newSellerName">Nome do Vendedor</Label>
          <div className="flex gap-2">
            <Input
              id="newSellerName"
              placeholder="Ex: Maria Silva"
              value={newSellerName}
              onChange={(e) => setNewSellerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSeller()}
            />
            <Button onClick={handleAddSeller} disabled={!newSellerName.trim()}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-md font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Vendedores Cadastrados
          </h3>
          {sellers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum vendedor cadastrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {sellers.map((seller) => (
                <li key={seller.id} className="flex items-center justify-between rounded-md bg-muted/50 p-3">
                  <span className="font-medium">{seller.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteSeller(seller.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}