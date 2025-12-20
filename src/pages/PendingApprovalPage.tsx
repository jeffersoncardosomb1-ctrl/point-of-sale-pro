import { Helmet } from "react-helmet";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const STORE_NAME = "Fiorenzza Beauty";
const STORE_LOGO_SRC = "/fiorenzza.png";

export default function PendingApprovalPage() {
  const { signOut } = useAuth();

  return (
    <>
      <Helmet>
        <title>Aguardando Aprovação | {STORE_NAME}</title>
        <meta name="description" content="Aguarde a aprovação do administrador para acessar o sistema." />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-elevated animate-scale-in">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src={STORE_LOGO_SRC} 
                alt={`${STORE_NAME} Logo`} 
                className="h-16 w-16 rounded-xl object-cover" 
              />
            </div>
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
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
    </>
  );
}
