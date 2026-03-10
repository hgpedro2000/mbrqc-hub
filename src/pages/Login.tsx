import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("auth-login-by-number", {
        body: { employee_number: employeeNumber.trim(), password },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro na autenticação");
      }

      // Set session from the edge function response
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      // Check if user must change password
      if (data.profile?.must_change_password) {
        toast.info("Você precisa alterar sua senha no primeiro acesso.");
        navigate("/alterar-senha");
        return;
      }

      toast.success(`Bem-vindo, ${data.profile?.full_name || ""}!`);
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Erro na autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="Hyundai Mobis" className="h-32 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-heading font-bold text-foreground">Quality Control-Hub</h1>
          <p className="text-muted-foreground mt-1">Entre com seu número de usuário</p>
        </div>

        <form onSubmit={handleSubmit} className="form-section space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employeeNumber">Número do Usuário</Label>
            <Input
              id="employeeNumber"
              type="text"
              required
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="Ex: 3501165"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold h-12"
          >
            {loading ? "Aguarde..." : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Entrar
              </>
            )}
          </Button>
          <Link
            to="/esqueci-senha"
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Esqueci minha senha
          </Link>
        </form>
      </div>
    </div>
  );
};

export default Login;
