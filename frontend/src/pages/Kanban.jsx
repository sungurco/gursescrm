import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, STATUS_LABELS } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";

const COLUMNS = [
  { key: "new", title: "Yeni" },
  { key: "in_review", title: "İnceleniyor" },
  { key: "waiting_info", title: "Bilgi Bekleniyor" },
  { key: "approved", title: "Onaylandı" },
  { key: "rejected", title: "Reddedildi" },
];

function waitingTime(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h}s`;
  return `${Math.floor(h / 24)}g`;
}

export default function Kanban() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/requests").then(r => setItems(r.data));
  }, []);

  return (
    <div className="space-y-4" data-testid="kanban-page">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Onay Kanban Panosu</h1>
        <p className="text-slate-500 mt-1">İş akışını görsel olarak takip edin.</p>
      </div>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {COLUMNS.map(col => {
            const colItems = items.filter(i => i.status === col.key);
            return (
              <div key={col.key} data-testid={`kanban-col-${col.key}`} className="w-80 flex-shrink-0">
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 h-full">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading font-semibold text-sm tracking-tight">{col.title}</h3>
                    <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded">{colItems.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colItems.map(r => (
                      <Link key={r.id} to={`/requests/${r.id}`} data-testid={`kanban-card-${r.id}`}>
                        <Card className="border-slate-200 shadow-none p-3 hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer bg-white">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-xs font-semibold text-slate-900">{r.request_no}</div>
                            <div className={`text-xs font-mono ${r.profit_pct < r.min_profit_pct ? "text-rose-600" : "text-emerald-600"}`}>%{r.profit_pct}</div>
                          </div>
                          <div className="text-sm mt-2 font-medium truncate">{r.customer_name}</div>
                          <div className="text-xs text-slate-500 truncate">{r.product_info}</div>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <div className="text-slate-500 truncate">{r.brand} · {r.store_code}</div>
                            <div className="flex items-center gap-1 text-slate-500 font-mono">
                              <Clock className="w-3 h-3" strokeWidth={1.5}/> {waitingTime(r.created_at)}
                            </div>
                          </div>
                          {r.assigned_to_name && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1 truncate">
                              👤 {r.assigned_to_name}
                            </div>
                          )}
                        </Card>
                      </Link>
                    ))}
                    {colItems.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Boş</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
