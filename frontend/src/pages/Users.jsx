import { useEffect, useState } from "react";
import { api, formatApiError, ROLE_LABELS } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, KeyRound } from "lucide-react";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [open, setOpen] = useState(false);
  const [pwdUser, setPwdUser] = useState(null);
  const [pwd, setPwd] = useState("");
  const [form, setForm] = useState({ email:"", password:"", name:"", role:"store_user", store_id:"" });

  const load = async () => {
    setUsers((await api.get("/users")).data);
    setStores((await api.get("/stores")).data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post("/users", { ...form, store_id: form.store_id || null });
      toast.success("Kullanıcı oluşturuldu");
      setOpen(false);
      setForm({ email:"", password:"", name:"", role:"store_user", store_id:"" });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const resetPwd = async () => {
    try {
      await api.put(`/users/${pwdUser.id}`, { password: pwd });
      toast.success("Parola sıfırlandı");
      setPwdUser(null); setPwd("");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Kullanıcılar</h1>
          <p className="text-slate-500 mt-1">Sistem kullanıcılarını yönetin.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-user-btn" className="bg-slate-900 hover:bg-slate-800"><Plus className="w-4 h-4 mr-1" strokeWidth={1.5}/> Yeni Kullanıcı</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading tracking-tight">Yeni Kullanıcı</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Ad Soyad</Label><Input data-testid="user-name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="mt-1.5" /></div>
              <div><Label>E-posta</Label><Input data-testid="user-email" type="email" value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Parola</Label><Input data-testid="user-password" type="password" value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})} className="mt-1.5" /></div>
              <div>
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v)=>setForm({...form, role: v})}>
                  <SelectTrigger data-testid="user-role" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.role === "store_user" && (
                <div>
                  <Label>Mağaza</Label>
                  <Select value={form.store_id} onValueChange={(v)=>setForm({...form, store_id: v})}>
                    <SelectTrigger data-testid="user-store" className="mt-1.5"><SelectValue placeholder="Mağaza seç" /></SelectTrigger>
                    <SelectContent>
                      {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button data-testid="user-create-submit" onClick={create} className="bg-slate-900 hover:bg-slate-800 w-full">Oluştur</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Ad</th>
              <th className="text-left px-4 py-3 font-medium">E-posta</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-left px-4 py-3 font-medium">Mağaza</th>
              <th className="text-left px-4 py-3 font-medium">Aktif</th>
              <th className="text-left px-4 py-3 font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => {
              const store = stores.find(s => s.id === u.store_id);
              return (
                <tr key={u.id} data-testid={`user-row-${u.id}`}>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-3 text-slate-600">{store?.name || "—"}</td>
                  <td className="px-4 py-3"><Switch data-testid={`user-active-${u.id}`} checked={u.is_active} onCheckedChange={()=>toggleActive(u)} /></td>
                  <td className="px-4 py-3">
                    <Button data-testid={`user-reset-pwd-${u.id}`} size="sm" variant="outline" onClick={()=>setPwdUser(u)}><KeyRound className="w-3.5 h-3.5 mr-1" strokeWidth={1.5}/> Parola</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!pwdUser} onOpenChange={(v)=>!v && setPwdUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading tracking-tight">Parola Sıfırla — {pwdUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input data-testid="reset-pwd-input" type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} placeholder="Yeni parola" />
            <Button data-testid="reset-pwd-submit" onClick={resetPwd} className="bg-slate-900 hover:bg-slate-800 w-full">Sıfırla</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
