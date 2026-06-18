import { useEffect, useState } from "react";
import { api, formatApiError, ROLE_LABELS } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, KeyRound, Pencil } from "lucide-react";

const EMPTY = { email:"", password:"", name:"", role:"store_user", store_ids:[] };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [pwdUser, setPwdUser] = useState(null);
  const [pwd, setPwd] = useState("");

  const load = async () => {
    setUsers((await api.get("/users")).data);
    setStores((await api.get("/stores")).data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ email: u.email, password: "", name: u.name, role: u.role, store_ids: u.store_ids || [] });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role, store_ids: form.store_ids };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editing.id}`, payload);
        toast.success("Kullanıcı güncellendi");
      } else {
        await api.post("/users", form);
        toast.success("Kullanıcı oluşturuldu");
      }
      setOpen(false); setEditing(null); setForm(EMPTY); load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const toggleActive = async (u) => {
    try { await api.put(`/users/${u.id}`, { is_active: !u.is_active }); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const resetPwd = async () => {
    try {
      await api.put(`/users/${pwdUser.id}`, { password: pwd });
      toast.success("Parola sıfırlandı");
      setPwdUser(null); setPwd("");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const toggleStoreInForm = (sid) => {
    setForm(f => ({
      ...f,
      store_ids: f.store_ids.includes(sid) ? f.store_ids.filter(x=>x!==sid) : [...f.store_ids, sid]
    }));
  };

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Kullanıcılar</h1>
          <p className="text-slate-500 mt-1">Sistem kullanıcılarını yönetin.</p>
        </div>
        <Button data-testid="new-user-btn" onClick={openNew} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-1" strokeWidth={1.5}/> Yeni Kullanıcı
        </Button>
      </div>

      <Card className="border-slate-200 shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Ad</th>
              <th className="text-left px-4 py-3 font-medium">E-posta</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-left px-4 py-3 font-medium">Mağazalar</th>
              <th className="text-left px-4 py-3 font-medium">Aktif</th>
              <th className="text-right px-4 py-3 font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => {
              const userStores = (u.store_ids || []).map(id => stores.find(s=>s.id===id)?.name).filter(Boolean);
              return (
                <tr key={u.id} data-testid={`user-row-${u.id}`}>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{userStores.length ? userStores.join(", ") : "—"}</td>
                  <td className="px-4 py-3"><Switch data-testid={`user-active-${u.id}`} checked={u.is_active} onCheckedChange={()=>toggleActive(u)} /></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button data-testid={`user-edit-${u.id}`} size="sm" variant="outline" onClick={()=>openEdit(u)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" strokeWidth={1.5}/> Düzenle
                    </Button>
                    <Button data-testid={`user-reset-pwd-${u.id}`} size="sm" variant="outline" onClick={()=>setPwdUser(u)}>
                      <KeyRound className="w-3.5 h-3.5 mr-1" strokeWidth={1.5}/> Parola
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(v)=>{ setOpen(v); if(!v){ setEditing(null); setForm(EMPTY);} }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">
              {editing ? `Düzenle — ${editing.name}` : "Yeni Kullanıcı"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Ad Soyad</Label><Input data-testid="user-name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="mt-1.5" /></div>
            {!editing && <div><Label>E-posta</Label><Input data-testid="user-email" type="email" value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} className="mt-1.5" /></div>}
            <div>
              <Label>{editing ? "Yeni Parola (boş bırakılırsa değişmez)" : "Parola"}</Label>
              <Input data-testid="user-password" type="password" value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})} className="mt-1.5" />
            </div>
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
                <Label>Mağazalar (birden fazla seçebilirsiniz)</Label>
                <div className="mt-2 border border-slate-200 rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {stores.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
                      <Checkbox
                        data-testid={`user-store-${s.id}`}
                        checked={form.store_ids.includes(s.id)}
                        onCheckedChange={()=>toggleStoreInForm(s.id)}
                      />
                      <span>{s.name} <span className="text-xs text-slate-500">— {s.brand}</span></span>
                    </label>
                  ))}
                  {stores.length === 0 && <div className="text-xs text-slate-500">Önce mağaza ekleyin.</div>}
                </div>
                <div className="text-xs text-slate-500 mt-1">Seçili: {form.store_ids.length}</div>
              </div>
            )}
            <Button data-testid="user-save-submit" onClick={save} className="bg-slate-900 hover:bg-slate-800 w-full">
              {editing ? "Kaydet" : "Oluştur"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
