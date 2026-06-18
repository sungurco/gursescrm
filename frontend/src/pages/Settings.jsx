import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Settings() {
  const [brands, setBrands] = useState([]);
  const [newBrand, setNewBrand] = useState({ name: "", min_profit_pct: "" });

  const load = async () => setBrands((await api.get("/brands")).data);
  useEffect(() => { load(); }, []);

  const save = async (b) => {
    try {
      await api.post("/brands", { name: b.name, min_profit_pct: parseFloat(b.min_profit_pct) });
      toast.success(`${b.name} güncellendi`);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const addBrand = async () => {
    if (!newBrand.name || !newBrand.min_profit_pct) return;
    try {
      await api.post("/brands", { name: newBrand.name, min_profit_pct: parseFloat(newBrand.min_profit_pct) });
      toast.success("Marka eklendi");
      setNewBrand({ name:"", min_profit_pct: "" });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Kâr Marjı Ayarları</h1>
        <p className="text-slate-500 mt-1">Her marka için minimum kâr marjını yapılandırın.</p>
      </div>

      <Card className="border-slate-200 shadow-none">
        <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Markalar</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {brands.map((b, i) => (
            <div key={b.id} data-testid={`brand-${b.id}`} className="flex items-center gap-3 p-3 border border-slate-200 rounded-md">
              <div className="flex-1 font-medium">{b.name}</div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500">Min Kâr %</Label>
                <Input data-testid={`brand-pct-${b.id}`} type="number" step="0.1"
                       value={b.min_profit_pct}
                       onChange={(e)=>setBrands(brands.map((x,j)=> j===i ? {...x, min_profit_pct: e.target.value} : x))}
                       className="w-24 font-mono" />
                <Button data-testid={`brand-save-${b.id}`} size="sm" onClick={()=>save(b)} className="bg-slate-900 hover:bg-slate-800">Kaydet</Button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 p-3 border border-dashed border-slate-300 rounded-md">
            <Input data-testid="new-brand-name" placeholder="Yeni marka adı" value={newBrand.name} onChange={(e)=>setNewBrand({...newBrand, name: e.target.value})} className="flex-1" />
            <Input data-testid="new-brand-pct" type="number" step="0.1" placeholder="Min Kâr %" value={newBrand.min_profit_pct} onChange={(e)=>setNewBrand({...newBrand, min_profit_pct: e.target.value})} className="w-32 font-mono" />
            <Button data-testid="new-brand-add" onClick={addBrand} className="bg-slate-900 hover:bg-slate-800">Ekle</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
