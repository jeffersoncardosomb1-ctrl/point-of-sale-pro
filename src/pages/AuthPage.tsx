import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { z } from "zod";
import { Eye, EyeOff, LogIn, UserPlus, Loader2, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const emailSchema = z.string().trim().email({ message: "Email inválido" });
const passwordSchema = z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" });

const STORE_NAME = "Fiorenzza Beauty";
const STORE_LOGO_SRC = "/fiorenzza.png";

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, isLoading, signIn, signUp } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast({ title: "Erro", description: emailResult.error.errors[0].message, variant: "destructive" });
      return;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast({ title: "Erro", description: passwordResult.error.errors[0].message, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      let message = "Erro ao fazer login";
      if (error.message.includes("Invalid login credentials")) {
        message = "Email ou senha incorretos";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Por favor, confirme seu email antes de fazer login";
      }
      toast({ title: "Erro", description: message, variant: "destructive" });
      return;
    }

    toast({ title: "Bem-vindo!", description: "Login realizado com sucesso" });
    navigate("/", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast({ title: "Erro", description: emailResult.error.errors[0].message, variant: "destructive" });
      return;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast({ title: "Erro", description: passwordResult.error.errors[0].message, variant: "destructive" });
      return;
    }

    if (!firstName.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signUp(email, password, firstName.trim(), lastName.trim());
    setIsSubmitting(false);

    if (error) {
      let message = "Erro ao criar conta";
      if (error.message.includes("User already registered")) {
        message = "Este email já está cadastrado";
      }
      toast({ title: "Erro", description: message, variant: "destructive" });
      return;
    }

    setRegisteredEmail(email);
    setShowEmailConfirmation(true);
    setPassword("");
  };

  const handleBackToLogin = () => {
    setShowEmailConfirmation(false);
    setActiveTab("login");
    setEmail("");
    setFirstName("");
    setLastName("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Login | {STORE_NAME}</title>
        <meta name="description" content="Faça login para acessar o sistema de vendas." />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {showEmailConfirmation ? (
          <Card className="w-full max-w-md shadow-elevated animate-scale-in">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Verifique seu Email</CardTitle>
                <CardDescription className="mt-2">
                  Enviamos um link de confirmação para:
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="text-center space-y-6">
              <p className="font-semibold text-primary text-lg break-all">
                {registeredEmail}
              </p>

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-3 text-left">
                <p className="flex items-start gap-2">
                  <span>📧</span>
                  <span>Clique no link enviado para confirmar seu email.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span>⚠️</span>
                  <span>Verifique também a pasta de <strong>spam</strong> ou <strong>lixo eletrônico</strong>.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span>⏳</span>
                  <span>Após confirmar, aguarde a <strong>aprovação do administrador</strong> para acessar o sistema.</span>
                </p>
              </div>

              <Button 
                variant="outline" 
                onClick={handleBackToLogin}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Login
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-md shadow-elevated animate-scale-in">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <img 
                  src={STORE_LOGO_SRC} 
                  alt={`${STORE_NAME} Logo`} 
                  className="h-16 w-16 rounded-xl object-cover" 
                />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">{STORE_NAME}</CardTitle>
                <CardDescription>Sistema de Vendas</CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Cadastrar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        <>
                          <LogIn className="h-4 w-4 mr-2" />
                          Entrar
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-firstname">Nome</Label>
                        <Input
                          id="signup-firstname"
                          type="text"
                          placeholder="João"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          autoComplete="given-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-lastname">Sobrenome</Label>
                        <Input
                          id="signup-lastname"
                          type="text"
                          placeholder="Silva"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          autoComplete="family-name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Criando conta...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Criar Conta
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
