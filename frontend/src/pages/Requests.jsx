import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, STATUS_LIST, STATUS_LABELS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Search, Plus } from "lucide-react";
import { Link as RLink } from "react-router-dom";

export default function Requests() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [brand, setBrand] = useState("all");
  const [storeId, setStoreId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    const params = {};
    if (search) params.search = search;
    if (status !== "all") params.status = status;
    if (brand !== "all") params.brand = brand;
    if (storeId !== "all") params.store_id = storeId;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const { data } = await api.get("/requests", { params });
    setItems(data);
  };

  useEffect(() => {
    api.get("/stores").then(r => setStores(r.data));
    api.get("/brands").then(r => setBrands(r.data));
    load();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="space-y-6" data-testid="requests-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Talepler</h1>
          <p className="text-slate-500 mt-1">Tüm onay taleplerini görüntüleyin ve filtreleyin.</p>
        </div>
        {user.role === "store_user" && (
          <RLink to="/requests/new">
            <Button data-testid="new-request-btn" className="bg-slate-900 hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-1" strokeWidth={1.5} /> Yeni Talep
            </Button>
          </RLink>
        )}
      </div>

      <Card className="border-slate-200 shadow-none p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" strokeWidth={1.5} />
            <Input data-testid="search-input" placeholder="Talep no, satış no, müşteri, telefon..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="filter-status"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              {STATUS_LIST.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger data-testid="filter-brand"><SelectValue placeholder="Marka" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Markalar</SelectItem>
              {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger data-testid="filter-store"><SelectValue placeholder="Mağaza" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Mağazalar</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button data-testid="apply-filters-btn" onClick={load} className="bg-slate-900 hover:bg-slate-800">Uygula</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
          <Input data-testid="date-from" type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} />
          <Input data-testid="date-to" type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} />
        </div>
      </Card>

      <Card className="border-slate-200 shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Talep No</th>
                <th className="text-left px-4 py-3 font-medium">Mağaza / Marka</th>
                <th className="text-left px-4 py-3 font-medium">Müşteri</th>
                <th className="text-right px-4 py-3 font-medium">Tutar</th>
                <th className="text-right px-4 py-3 font-medium">Kâr %</th>
                <th className="text-left px-4 py-3 font-medium">Atanan</th>
                <th className="text-left px-4 py-3 font-medium">Durum</th>
                <th className="text-left px-4 py-3 font-medium">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Sonuç bulunamadı.</td></tr>
              )}
              {items.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link data-testid={`row-${r.id}`} to={`/requests/${r.id}`} className="font-mono font-medium text-slate-900">{r.request_no}</Link></td>
                  <td className="px-4 py-3"><div>{r.store_name}</div><div className="text-xs text-slate-500">{r.brand}</div></td>
                  <td className="px-4 py-3"><div>{r.customer_name}</div><div className="text-xs text-slate-500 font-mono">{r.customer_phone}</div></td>
                  <td className="px-4 py-3 text-right font-mono">{r.total_amount?.toLocaleString("tr-TR")} ₺</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {(user.role === 'approval_user' || user.role === 'manager' || user.role === 'it_admin') ? (
                      <>
                        <span className={r.profit_pct < r.min_profit_pct ? "text-rose-600" : "text-emerald-600"}>%{r.profit_pct}</span>
                        <span className="text-xs text-slate-400"> / %{r.min_profit_pct}</span>
                      </>
                    ) : (
                      <span className="text-slate-700">%{r.profit_pct}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.assigned_to_name || <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{r.created_at?.slice(0,10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
