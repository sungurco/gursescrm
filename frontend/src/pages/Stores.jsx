import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

const EMPTY = { name:"", code:"", brand:"", address:"", phone:"" };

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // store object or null
  const [form, setForm] = useState(EMPTY);

  const load = async () => setStores((await api.get("/stores")).data);
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code, brand: s.brand, address: s.address || "", phone: s.phone || "" });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await api.put(`/stores/${editing.id}`, form);
        toast.success("Mağaza güncellendi");
      } else {
        await api.post("/stores", form);
        toast.success("Mağaza oluşturuldu");
      }
      setOpen(false); setEditing(null); setForm(EMPTY);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6" data-testid="stores-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Mağazalar</h1>
          <p className="text-slate-500 mt-1">Mağaza tanımlarını yönetin.</p>
        </div>
        <Button data-testid="new-store-btn" onClick={openNew} className="bg-slate-900 hover:bg-slate-800">
          <Plus className="w-4 h-4 mr-1" strokeWidth={1.5}/> Yeni Mağaza
        </Button>
      </div>

      <Card className="border-slate-200 shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Ad</th>
              <th className="text-left px-4 py-3 font-medium">Kod</th>
              <th className="text-left px-4 py-3 font-medium">Marka</th>
              <th className="text-left px-4 py-3 font-medium">Adres</th>
              <th className="text-left px-4 py-3 font-medium">Telefon</th>
              <th className="text-right px-4 py-3 font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stores.map(s => (
              <tr key={s.id} data-testid={`store-row-${s.id}`}>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-3">{s.brand}</td>
                <td className="px-4 py-3 text-slate-600">{s.address}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.phone}</td>
                <td className="px-4 py-3 text-right">
                  <Button data-testid={`store-edit-${s.id}`} size="sm" variant="outline" onClick={()=>openEdit(s)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" strokeWidth={1.5}/> Düzenle
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(v)=>{ setOpen(v); if(!v){ setEditing(null); setForm(EMPTY);} }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">
              {editing ? `Mağaza Düzenle — ${editing.name}` : "Yeni Mağaza"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Ad</Label><Input data-testid="store-name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Kod</Label><Input data-testid="store-code" value={form.code} onChange={(e)=>setForm({...form, code: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Marka</Label><Input data-testid="store-brand" value={form.brand} onChange={(e)=>setForm({...form, brand: e.target.value})} className="mt-1.5" placeholder="Arçelik, Bellona, Mondi..." /></div>
            <div><Label>Adres</Label><Input data-testid="store-address" value={form.address} onChange={(e)=>setForm({...form, address: e.target.value})} className="mt-1.5" /></div>
            <div><Label>Telefon</Label><Input data-testid="store-phone" value={form.phone} onChange={(e)=>setForm({...form, phone: e.target.value})} className="mt-1.5" /></div>
            <Button data-testid="store-save-submit" onClick={save} className="bg-slate-900 hover:bg-slate-800 w-full">
              {editing ? "Kaydet" : "Oluştur"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
