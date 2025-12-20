import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Clock } from "lucide-react";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading, role, isApproved, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // User not approved yet
  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-elevated animate-scale-in">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div>
              <CardTitle className="text-xl">Aguardando Aprovação</CardTitle>
              <CardDescription className="mt-2">
                Seu cadastro foi recebido e está aguardando aprovação do administrador.
                Você receberá acesso assim que for aprovado.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => signOut()}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check role requirement
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
