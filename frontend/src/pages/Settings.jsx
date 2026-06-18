import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  const [brands, setBrands] = useState([]);
  const [newBrand, setNewBrand] = useState({ name: "", min_profit_pct: "" });
  const [logo, setLogo] = useState("");

  const load = async () => {
    setBrands((await api.get("/brands")).data);
    try { setLogo((await api.get("/settings/logo")).data.logo_data_url || ""); } catch (e) { /* logo optional */ }
  };
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

  const uploadLogo = async (file) => {
    if (!file) return;
    if (file.size > 400_000) return toast.error("Logo 400KB'tan büyük olamaz");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.put("/settings/logo", { logo_data_url: reader.result });
        setLogo(reader.result);
        toast.success("Logo güncellendi");
        window.dispatchEvent(new Event("logo-updated"));
      } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = async () => {
    try {
      await api.put("/settings/logo", { logo_data_url: "" });
      setLogo("");
      toast.success("Logo kaldırıldı");
      window.dispatchEvent(new Event("logo-updated"));
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Sistem Ayarları</h1>
        <p className="text-slate-500 mt-1">Marka kâr marjı ve firma logosu.</p>
      </div>

      {user.role === "it_admin" && (
        <Card className="border-slate-200 shadow-none">
          <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Firma Logosu</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 border border-slate-200 rounded-md flex items-center justify-center bg-slate-50 overflow-hidden">
                {logo ? <img src={logo} alt="logo" className="max-w-full max-h-full object-contain" data-testid="logo-preview" /> : <span className="text-xs text-slate-400">Logo yok</span>}
              </div>
              <div className="flex-1 space-y-2">
                <Input data-testid="logo-upload" type="file" accept="image/*" onChange={(e)=>uploadLogo(e.target.files?.[0])} />
                <div className="text-xs text-slate-500">PNG/JPG/SVG önerilir. Max 400KB.</div>
                {logo && <Button data-testid="logo-remove" variant="outline" size="sm" onClick={removeLogo}>Logoyu Kaldır</Button>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-none">
        <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Markalar — Minimum Kâr %</CardTitle></CardHeader>
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
