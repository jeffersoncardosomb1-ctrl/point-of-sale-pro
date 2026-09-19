import { useMemo, useRef, useState } from "react";
import { Users, Save, Trash2, Pencil, Search, X, Cake, Phone, MessageCircle, PartyPopper, Copy, Upload, Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientsSupabase } from "@/hooks/useClientsSupabase";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Client } from "@/types/client";

function formatDateBR(value: string | null) {
  if (!value) return "-";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function buildWhatsAppLink(telefone: string, nome: string): string | null {
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.length >= 12 ? digits : `55${digits}`;
  const firstName = nome.trim().split(/\s+/)[0] || nome;
  const message = `Olá ${firstName}! 🎂 A equipe da Fiorenzza Beauty deseja um feliz aniversário! Preparamos uma condição especial pra você comemorar com a gente. 💛`;
  return `whatsapp://send?phone=${withCountry}&text=${encodeURIComponent(message)}`;
}

async function copyPhoneToClipboard(telefone: string) {
  try {
    await navigator.clipboard.writeText(telefone);
    toast({ title: "Telefone copiado", description: telefone });
  } catch {
    toast({ title: "Não foi possível copiar", description: "Copie manualmente: " + telefone, variant: "destructive" });
  }
}

interface BirthdayRow {
  id: string;
  nome: string;
  telefone: string;
  day: number;
  status: "hoje" | "futuro" | "passado";
  statusLabel: string;
  whatsappLink: string | null;
}

function BirthdaysThisMonthCard({ clients, loading }: { clients: Client[]; loading: boolean }) {
  const now = new Date();

  const monthLabel = useMemo(() => {
    const label = format(now, "MMMM", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo<BirthdayRow[]>(() => {
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const todayDay = now.getDate();

    return clients
      .filter((c) => c.aniversario && c.aniversario.slice(5, 7) === currentMonth)
      .map((c) => {
        const day = Number(c.aniversario!.slice(8, 10));
        let status: BirthdayRow["status"];
        let statusLabel: string;
        if (day === todayDay) {
          status = "hoje";
          statusLabel = "Hoje";
        } else if (day > todayDay) {
          const dias = day - todayDay;
          status = "futuro";
          statusLabel = `Em ${dias} dia${dias > 1 ? "s" : ""}`;
        } else {
          const dias = todayDay - day;
          status = "passado";
          statusLabel = `Há ${dias} dia${dias > 1 ? "s" : ""}`;
        }
        return {
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          day,
          status,
          statusLabel,
          whatsappLink: buildWhatsAppLink(c.telefone, c.nome),
        };
      })
      .sort((a, b) => a.day - b.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Cake className="h-5 w-5 text-primary" />
          Aniversariantes de {monthLabel} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Dia</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Carregando clientes...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nenhum aniversariante em {monthLabel}.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{String(r.day).padStart(2, "0")}</TableCell>
                    <TableCell className="font-semibold">{r.nome}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {r.telefone || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.status === "hoje"
                            ? "text-success border-success/30"
                            : r.status === "passado"
                            ? "text-muted-foreground border-border"
                            : "text-foreground border-border"
                        }
                      >
                        {r.status === "hoje" && <PartyPopper className="h-3 w-3 mr-1" />}
                        {r.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.whatsappLink && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={r.whatsappLink}
                              title="Enviar mensagem no WhatsApp"
                              className="text-success hover:text-success"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {r.telefone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copiar telefone (caso o WhatsApp não abra)"
                            onClick={() => copyPhoneToClipboard(r.telefone)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {!r.whatsappLink && !r.telefone && (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientsView() {
  const { clients, loading, createClient, updateClient, deleteClient } = useClientsSupabase();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.telefone.toLowerCase().includes(q)
    );
  }, [clients, search]);

  function resetForm() {
    setNome("");
    setTelefone("");
    setAniversario("");
    setEditingId(null);
  }

  async function handleSave() {
    if (!nome.trim()) {
      toast({ title: "Erro", description: "Informe o nome do cliente.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      telefone: telefone.trim(),
      aniversario: aniversario || null,
    };
    const ok = editingId ? await updateClient(editingId, payload) : await createClient(payload);
    setSaving(false);
    if (ok) resetForm();
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <BirthdaysThisMonthCard clients={clients} loading={loading} />

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            {editingId ? "Editar Cliente" : "Cadastro de Clientes"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cliente-nome">Nome</Label>
              <Input
                id="cliente-nome"
                placeholder="Nome do cliente"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-telefone">Telefone</Label>
              <Input
                id="cliente-telefone"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-aniversario">Aniversário</Label>
              <Input
                id="cliente-aniversario"
                type="date"
                value={aniversario}
                onChange={(e) => setAniversario(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
            <Button type="button" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {editingId ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">Clientes ({clients.length})</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Aniversário</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Carregando clientes...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Nenhum cliente cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-semibold">{c.nome}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {c.telefone || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Cake className="h-3 w-3 text-muted-foreground" />
                          {formatDateBR(c.aniversario)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(c.id);
                            setNome(c.nome);
                            setTelefone(c.telefone);
                            setAniversario(c.aniversario || "");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Excluir o cliente ${c.nome}?`)) deleteClient(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}