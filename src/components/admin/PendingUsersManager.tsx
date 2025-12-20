import { useState, useEffect } from "react";
import { UserCheck, UserX, Shield, User, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppRole } from "@/hooks/useAuth";

interface PendingUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
  email?: string;
}

interface ActiveUser extends PendingUser {
  role: AppRole;
}

export function PendingUsersManager() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch pending users (is_active = false and no role)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, is_active")
        .eq("is_active", false);

      if (profilesError) throw profilesError;

      // Fetch active users with roles
      const { data: activeProfiles, error: activeError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, is_active")
        .eq("is_active", true);

      if (activeError) throw activeError;

      // Fetch roles for active users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role as AppRole]) || []);

      const activeWithRoles: ActiveUser[] = (activeProfiles || []).map(p => ({
        ...p,
        role: rolesMap.get(p.id) || "seller"
      }));

      setPendingUsers(profiles || []);
      setActiveUsers(activeWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Erro", description: "Erro ao carregar usuários", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const approveUser = async (userId: string, role: AppRole) => {
    setProcessingId(userId);
    try {
      // Update profile to active
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_active: true, is_admin: role === "admin" })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Insert role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (roleError) throw roleError;

      toast({ title: "Sucesso!", description: `Usuário aprovado como ${role === "admin" ? "administrador" : "vendedor"}` });
      fetchUsers();
    } catch (error) {
      console.error("Error approving user:", error);
      toast({ title: "Erro", description: "Erro ao aprovar usuário", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const rejectUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja rejeitar este usuário? Ele será removido permanentemente.")) return;
    
    setProcessingId(userId);
    try {
      // Delete profile (cascade will handle auth.users via trigger if configured)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      toast({ title: "Usuário rejeitado", description: "O usuário foi removido" });
      fetchUsers();
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast({ title: "Erro", description: "Erro ao rejeitar usuário", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const deactivateUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja desativar este usuário?")) return;
    
    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", userId);

      if (error) throw error;

      // Remove role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      toast({ title: "Usuário desativado" });
      fetchUsers();
    } catch (error) {
      console.error("Error deactivating user:", error);
      toast({ title: "Erro", description: "Erro ao desativar usuário", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Users */}
      <Card className="shadow-card animate-fade-in">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Usuários Pendentes
            {pendingUsers.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingUsers.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum usuário pendente de aprovação.</p>
          ) : (
            <ul className="space-y-3">
              {pendingUsers.map((user) => (
                <PendingUserCard
                  key={user.id}
                  user={user}
                  isProcessing={processingId === user.id}
                  onApprove={(role) => approveUser(user.id, role)}
                  onReject={() => rejectUser(user.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Active Users */}
      <Card className="shadow-card animate-fade-in">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Usuários Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum usuário ativo.</p>
          ) : (
            <ul className="space-y-2">
              {activeUsers.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      {user.role === "admin" ? (
                        <Shield className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <span className="font-medium">
                        {user.first_name} {user.last_name}
                      </span>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="ml-2">
                        {user.role === "admin" ? "Admin" : "Vendedor"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deactivateUser(user.id)}
                    disabled={processingId === user.id}
                  >
                    {processingId === user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserX className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingUserCard({
  user,
  isProcessing,
  onApprove,
  onReject,
}: {
  user: PendingUser;
  isProcessing: boolean;
  onApprove: (role: AppRole) => void;
  onReject: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState<AppRole>("seller");

  return (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
          <User className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <span className="font-medium">
            {user.first_name} {user.last_name}
          </span>
          <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="seller">Vendedor</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        <Button
          size="sm"
          onClick={() => onApprove(selectedRole)}
          disabled={isProcessing}
          className="gap-1"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          Aprovar
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={isProcessing}
          className="text-destructive hover:text-destructive gap-1"
        >
          <UserX className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
