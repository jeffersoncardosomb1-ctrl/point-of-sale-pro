import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Client } from "@/types/client";
import { toast } from "@/hooks/use-toast";

function rowToClient(row: any): Client {
  return {
    id: row.id,
    nome: row.nome || "",
    telefone: row.telefone || "",
    aniversario: row.aniversario ?? null,
    createdAt: row.created_at,
  };
}

export function useClientsSupabase() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      setClients((data || []).map(rowToClient));
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast({
        title: "Erro ao carregar clientes",
        description: "Não foi possível buscar a lista de clientes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const createClient = useCallback(
    async (input: { nome: string; telefone: string; aniversario: string | null }) => {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          nome: input.nome,
          telefone: input.telefone,
          aniversario: input.aniversario,
        })
        .select()
        .single();

      if (error) {
        console.error("Erro ao cadastrar cliente:", error);
        toast({ title: "Erro", description: "Não foi possível cadastrar o cliente.", variant: "destructive" });
        return null;
      }

      const client = rowToClient(data);
      setClients((prev) => [...prev, client].sort((a, b) => a.nome.localeCompare(b.nome)));
      toast({ title: "Cliente cadastrado", description: `${client.nome} foi adicionado.` });
      return client;
    },
    []
  );

  const updateClient = useCallback(
    async (id: string, input: { nome: string; telefone: string; aniversario: string | null }) => {
      const { error } = await supabase
        .from("clients")
        .update({
          nome: input.nome,
          telefone: input.telefone,
          aniversario: input.aniversario,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("Erro ao atualizar cliente:", error);
        toast({ title: "Erro", description: "Não foi possível atualizar o cliente.", variant: "destructive" });
        return false;
      }

      setClients((prev) =>
        prev
          .map((c) => (c.id === id ? { ...c, ...input } : c))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      toast({ title: "Cliente atualizado" });
      return true;
    },
    []
  );

  const deleteClient = useCallback(async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir cliente:", error);
      toast({ title: "Erro", description: "Não foi possível excluir o cliente.", variant: "destructive" });
      return false;
    }
    setClients((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Cliente excluído" });
    return true;
  }, []);

  const createClientsBulk = useCallback(
    async (rows: { nome: string; telefone: string; aniversario: string | null }[]) => {
      if (rows.length === 0) return 0;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { data, error } = await supabase.from("clients").insert(chunk).select();
        if (error) {
          console.error("Erro ao importar clientes:", error);
          toast({
            title: "Erro na importação",
            description: "Alguns clientes não puderam ser importados.",
            variant: "destructive",
          });
          break;
        }
        inserted += data?.length || 0;
      }
      await fetchClients();
      return inserted;
    },
    [fetchClients]
  );

  return { clients, loading, createClient, createClientsBulk, updateClient, deleteClient, refetch: fetchClients };
}