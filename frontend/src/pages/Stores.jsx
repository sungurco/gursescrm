import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", code:"", brand:"", address:"", phone:"" });

  const load = async () => setStores((await api.get("/stores")).data);
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post("/stores", form);
      toast.success("Mağaza oluşturuldu");
      setOpen(false);
      setForm({ name:"", code:"", brand:"", address:"", phone:"" });
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-store-btn" className="bg-slate-900 hover:bg-slate-800"><Plus className="w-4 h-4 mr-1" strokeWidth={1.5}/> Yeni Mağaza</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading tracking-tight">Yeni Mağaza</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Ad</Label><Input data-testid="store-name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Kod</Label><Input data-testid="store-code" value={form.code} onChange={(e)=>setForm({...form, code: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Marka</Label><Input data-testid="store-brand" value={form.brand} onChange={(e)=>setForm({...form, brand: e.target.value})} className="mt-1.5" placeholder="Arçelik, Bellona, Mondi..." /></div>
              <div><Label>Adres</Label><Input data-testid="store-address" value={form.address} onChange={(e)=>setForm({...form, address: e.target.value})} className="mt-1.5" /></div>
              <div><Label>Telefon</Label><Input data-testid="store-phone" value={form.phone} onChange={(e)=>setForm({...form, phone: e.target.value})} className="mt-1.5" /></div>
              <Button data-testid="store-create-submit" onClick={create} className="bg-slate-900 hover:bg-slate-800 w-full">Oluştur</Button>
            </div>
          </DialogContent>
        </Dialog>
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
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
