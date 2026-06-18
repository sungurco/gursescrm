import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login, formatApiError } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Giriş başarılı");
      nav("/dashboard");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  const quick = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-30"
             style={{ backgroundImage: "url(https://images.pexels.com/photos/19599329/pexels-photo-19599329.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-800/80" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-white text-slate-900 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-heading font-semibold tracking-tight text-lg">Margin CRM</div>
              <div className="text-sm text-slate-300">Sales Profit Margin Approval</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-heading text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
            Düşük kâr marjı onaylarını<br/>tek bir yerden yönetin.
          </h1>
          <p className="mt-4 text-slate-300 leading-relaxed">
            E-posta ve WhatsApp karmaşasına son. Arçelik, Bellona, Mondi mağazalarınız için merkezi, denetlenebilir ve hızlı onay süreci.
          </p>
        </div>
        <div className="relative z-10 text-xs text-slate-400">© 2026 Margin CRM</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC]">
        <div className="w-full max-w-sm">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Giriş Yap</h2>
          <p className="text-sm text-slate-500 mt-1 mb-8">Hesap bilgilerinizle oturum açın.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" data-testid="login-email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="ornek@crm.local" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password">Parola</Label>
              <Input id="password" data-testid="login-password" type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5" />
            </div>
            <Button data-testid="login-submit-btn" type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800">
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-white border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-700 mb-2">Demo Hesaplar (tıklayın)</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button data-testid="quick-admin" type="button" className="text-left px-2 py-1.5 rounded hover:bg-slate-100" onClick={()=>quick("admin@crm.local","Admin123!")}>IT Admin</button>
              <button data-testid="quick-manager" type="button" className="text-left px-2 py-1.5 rounded hover:bg-slate-100" onClick={()=>quick("manager@crm.local","Manager123!")}>Yönetici</button>
              <button data-testid="quick-approval" type="button" className="text-left px-2 py-1.5 rounded hover:bg-slate-100" onClick={()=>quick("approval@crm.local","Approval123!")}>Onay Personeli</button>
              <button data-testid="quick-store" type="button" className="text-left px-2 py-1.5 rounded hover:bg-slate-100" onClick={()=>quick("arcelik@crm.local","Store123!")}>Mağaza (Arçelik)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
