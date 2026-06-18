import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function RequestCreate() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({
    store_id: user.store_id || "",
    sales_number: "",
    customer_name: "",
    customer_phone: "",
    sale_date: new Date().toISOString().slice(0, 10),
    product_info: "",
    total_amount: "",
    cost_amount: "",
    payment_method: "nakit",
    reason: "",
    additional_notes: "",
  });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/stores").then(r => {
      setStores(r.data);
      if (user.role === "store_user" && r.data.length === 1) {
        setForm(f => ({ ...f, store_id: r.data[0].id }));
      }
    });
  }, [user]);

  const total = parseFloat(form.total_amount) || 0;
  const cost = parseFloat(form.cost_amount) || 0;
  const profit = total - cost;
  const pct = total > 0 ? ((profit / total) * 100).toFixed(2) : "0.00";

  const submit = async (e) => {
    e.preventDefault();
    if (!form.store_id) return toast.error("Lütfen mağaza seçin");
    setSubmitting(true);
    try {
      const payload = { ...form, total_amount: total, cost_amount: cost };
      const { data } = await api.post("/requests", payload);
      // upload files
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        await api.post(`/requests/${data.id}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      toast.success("Talep oluşturuldu");
      nav(`/requests/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6" data-testid="request-create-page">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Yeni Onay Talebi</h1>
        <p className="text-slate-500 mt-1">Düşük kâr marjlı satış için onay talebi oluşturun.</p>
      </div>

      <form onSubmit={submit}>
        <Card className="border-slate-200 shadow-none">
          <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Satış Bilgileri</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Mağaza</Label>
                <Select value={form.store_id} onValueChange={(v)=>setForm({...form, store_id: v})}>
                  <SelectTrigger data-testid="store-select" className="mt-1.5"><SelectValue placeholder="Mağaza seç" /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {s.brand}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Satış Numarası</Label>
                <Input data-testid="sales-number" required value={form.sales_number} onChange={(e)=>setForm({...form, sales_number: e.target.value})} className="mt-1.5" />
              </div>
              <div>
                <Label>Müşteri Adı</Label>
                <Input data-testid="customer-name" required value={form.customer_name} onChange={(e)=>setForm({...form, customer_name: e.target.value})} className="mt-1.5" />
              </div>
              <div>
                <Label>Müşteri Telefon <span className="text-xs text-slate-400">(opsiyonel)</span></Label>
                <Input data-testid="customer-phone" value={form.customer_phone} onChange={(e)=>setForm({...form, customer_phone: e.target.value.replace(/[^0-9]/g,'').slice(0,11)})} className="mt-1.5" placeholder="11 haneli (örn: 05551112233)" pattern="[0-9]{11}" />
                {form.customer_phone && form.customer_phone.length !== 11 && (
                  <div className="text-xs text-rose-600 mt-1">Telefon 11 haneli olmalıdır.</div>
                )}
              </div>
              <div>
                <Label>Satış Tarihi</Label>
                <Input data-testid="sale-date" type="date" required value={form.sale_date} onChange={(e)=>setForm({...form, sale_date: e.target.value})} className="mt-1.5" />
              </div>
              <div>
                <Label>Ödeme Yöntemi</Label>
                <Select value={form.payment_method} onValueChange={(v)=>setForm({...form, payment_method: v})}>
                  <SelectTrigger data-testid="payment-method" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nakit">Nakit</SelectItem>
                    <SelectItem value="kredi_karti">Kredi Kartı</SelectItem>
                    <SelectItem value="senet">Senet</SelectItem>
                    <SelectItem value="havale">Havale / EFT</SelectItem>
                    <SelectItem value="diger">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Ürün Bilgisi</Label>
              <Textarea data-testid="product-info" required value={form.product_info} onChange={(e)=>setForm({...form, product_info: e.target.value})} rows={2} className="mt-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-none mt-4">
          <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Tutarlar</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Toplam Satış (₺)</Label>
                <Input data-testid="total-amount" type="number" step="0.01" required value={form.total_amount} onChange={(e)=>setForm({...form, total_amount: e.target.value})} className="mt-1.5 font-mono" />
              </div>
              <div>
                <Label>Maliyet (₺)</Label>
                <Input data-testid="cost-amount" type="number" step="0.01" required value={form.cost_amount} onChange={(e)=>setForm({...form, cost_amount: e.target.value})} className="mt-1.5 font-mono" />
              </div>
              <div className="bg-slate-50 rounded-md border border-slate-200 p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider">Kâr</div>
                <div className="font-mono text-lg font-semibold mt-1">{profit.toLocaleString("tr-TR")} ₺</div>
                <div className="font-mono text-sm text-slate-600">%{pct}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-none mt-4">
          <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Açıklama ve Belgeler</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Düşük Marj Nedeni</Label>
              <Textarea data-testid="reason" required value={form.reason} onChange={(e)=>setForm({...form, reason: e.target.value})} rows={3} className="mt-1.5" placeholder="Örn: Müşteri pazarlığı, rakip teklifi..." />
            </div>
            <div>
              <Label>Ek Notlar</Label>
              <Textarea data-testid="notes" value={form.additional_notes} onChange={(e)=>setForm({...form, additional_notes: e.target.value})} rows={2} className="mt-1.5" />
            </div>
            <div>
              <Label>Belgeler (JPG, PNG, PDF)</Label>
              <Input data-testid="files-input" type="file" multiple accept=".jpg,.jpeg,.png,.pdf"
                     onChange={(e)=>setFiles(Array.from(e.target.files || []))} className="mt-1.5" />
              {files.length > 0 && (
                <div className="text-xs text-slate-500 mt-2">{files.length} dosya seçildi.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button data-testid="submit-request-btn" type="submit" disabled={submitting} className="bg-slate-900 hover:bg-slate-800">
            {submitting ? "Gönderiliyor..." : "Talebi Gönder"}
          </Button>
          <Button type="button" variant="outline" onClick={()=>nav("/requests")}>İptal</Button>
        </div>
      </form>
    </div>
  );
}
