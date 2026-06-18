import { useEffect, useState } from "react";
import { api, STATUS_LIST, STATUS_LABELS } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet } from "lucide-react";

export default function Reports() {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [brands, setBrands] = useState([]);
  const [f, setF] = useState({ status:"all", brand:"all", store_id:"all", date_from:"", date_to:"" });

  useEffect(() => {
    api.get("/stores").then(r => setStores(r.data));
    api.get("/brands").then(r => setBrands(r.data));
  }, []);

  const run = async () => {
    const params = {};
    if (f.status !== "all") params.status = f.status;
    if (f.brand !== "all") params.brand = f.brand;
    if (f.store_id !== "all") params.store_id = f.store_id;
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;
    const { data } = await api.get("/reports/requests", { params });
    setItems(data);
  };

  const exportCSV = () => {
    const headers = ["Talep No","Mağaza","Marka","Müşteri","Telefon","Tutar","Maliyet","Kâr","Kâr %","Ödeme","Durum","Atanan","Oluşturma","Karar"];
    const rows = items.map(r => [r.request_no,r.store_name,r.brand,r.customer_name,r.customer_phone,r.total_amount,r.cost_amount,r.profit_amount,r.profit_pct,r.payment_method,STATUS_LABELS[r.status],r.assigned_to_name||"",r.created_at?.slice(0,16),r.decided_at?.slice(0,16)||""]);
    // Use semicolon delimiter (Turkish Excel default) and CRLF line endings
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `rapor_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const exportPDF = () => {
    const html = `<html><head><meta charset="utf-8"><title>Rapor</title><style>body{font-family:Arial;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:4px;text-align:left}th{background:#f3f4f6}</style></head><body><h1>Gürses CRM — Talep Raporu (${new Date().toLocaleString("tr-TR")})</h1><table><thead><tr><th>Talep No</th><th>Mağaza</th><th>Müşteri</th><th>Tutar</th><th>Kâr %</th><th>Ödeme</th><th>Durum</th><th>Atanan</th></tr></thead><tbody>${items.map(r=>`<tr><td>${r.request_no}</td><td>${r.store_name}</td><td>${r.customer_name}</td><td>${(r.total_amount||0).toLocaleString("tr-TR")} ₺</td><td>%${r.profit_pct}</td><td>${r.payment_method||""}</td><td>${STATUS_LABELS[r.status]}</td><td>${r.assigned_to_name||""}</td></tr>`).join("")}</tbody></table><p>Toplam: ${items.length} talep</p></body></html>`;
    const w = window.open("", "_blank"); w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500);
  };

  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Raporlar</h1>
        <p className="text-slate-500 mt-1">Talepleri filtreleyin ve Excel/PDF olarak dışa aktarın.</p>
      </div>
      <Card className="border-slate-200 shadow-none p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Select value={f.status} onValueChange={(v)=>setF({...f, status:v})}>
            <SelectTrigger data-testid="rep-status"><SelectValue placeholder="Durum"/></SelectTrigger>
            <SelectContent><SelectItem value="all">Tüm Durumlar</SelectItem>{STATUS_LIST.map(s=><SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.brand} onValueChange={(v)=>setF({...f, brand:v})}>
            <SelectTrigger data-testid="rep-brand"><SelectValue placeholder="Marka"/></SelectTrigger>
            <SelectContent><SelectItem value="all">Tüm Markalar</SelectItem>{brands.map(b=><SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.store_id} onValueChange={(v)=>setF({...f, store_id:v})}>
            <SelectTrigger data-testid="rep-store"><SelectValue placeholder="Mağaza"/></SelectTrigger>
            <SelectContent><SelectItem value="all">Tüm Mağazalar</SelectItem>{stores.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input data-testid="rep-from" type="date" value={f.date_from} onChange={(e)=>setF({...f, date_from:e.target.value})}/>
          <Input data-testid="rep-to" type="date" value={f.date_to} onChange={(e)=>setF({...f, date_to:e.target.value})}/>
          <Button data-testid="rep-run" onClick={run} className="bg-slate-900 hover:bg-slate-800">Uygula</Button>
        </div>
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <Button data-testid="export-csv" onClick={exportCSV} variant="outline" disabled={!items.length}><FileSpreadsheet className="w-4 h-4 mr-1" strokeWidth={1.5}/> Excel (CSV)</Button>
          <Button data-testid="export-pdf" onClick={exportPDF} variant="outline" disabled={!items.length}><Download className="w-4 h-4 mr-1" strokeWidth={1.5}/> PDF (Yazdır)</Button>
          <div className="ml-auto text-sm text-slate-500 self-center">{items.length} kayıt</div>
        </div>
      </Card>
      <Card className="border-slate-200 shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600"><tr><th className="text-left px-3 py-2">Talep No</th><th className="text-left px-3 py-2">Mağaza</th><th className="text-left px-3 py-2">Müşteri</th><th className="text-right px-3 py-2">Tutar</th><th className="text-right px-3 py-2">Kâr %</th><th className="text-left px-3 py-2">Ödeme</th><th className="text-left px-3 py-2">Durum</th><th className="text-left px-3 py-2">Atanan</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{items.map(r=>(<tr key={r.id}><td className="px-3 py-2 font-mono">{r.request_no}</td><td className="px-3 py-2">{r.store_name}</td><td className="px-3 py-2">{r.customer_name}</td><td className="px-3 py-2 text-right font-mono">{r.total_amount?.toLocaleString("tr-TR")} ₺</td><td className="px-3 py-2 text-right font-mono">%{r.profit_pct}</td><td className="px-3 py-2">{r.payment_method}</td><td className="px-3 py-2">{STATUS_LABELS[r.status]}</td><td className="px-3 py-2 text-slate-600">{r.assigned_to_name||"—"}</td></tr>))}</tbody>
        </table>
      </Card>
    </div>
  );
}
