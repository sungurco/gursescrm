import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, STATUS_LABELS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import { Clock, FileText, CheckCircle2, XCircle, Inbox, UserCheck } from "lucide-react";

function Stat({ label, value, icon: Icon, accent = "slate", testid }) {
  return (
    <Card data-testid={testid} className="border-slate-200 shadow-none">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</div>
            <div className="font-mono text-3xl font-semibold mt-2 text-slate-900">{value}</div>
          </div>
          <div className={`w-9 h-9 rounded-md flex items-center justify-center bg-${accent}-50 text-${accent}-600`}>
            <Icon className="w-5 h-5" strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then(r => setData(r.data));
  }, []);

  if (!data) return <div className="text-slate-500">Yükleniyor...</div>;

  const c = data.counts;
  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Hoş geldiniz, {user.name}</h1>
        <p className="text-slate-500 mt-1">Güncel onay süreçlerinin özetine göz atın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat testid="stat-total" label="Toplam Talep" value={c.total} icon={FileText} accent="slate" />
        <Stat testid="stat-open" label="Açık Talepler" value={c.new + c.in_review + c.waiting_info} icon={Inbox} accent="sky" />
        <Stat testid="stat-approved" label="Onaylanan" value={c.approved} icon={CheckCircle2} accent="emerald" />
        <Stat testid="stat-rejected" label="Reddedilen" value={c.rejected} icon={XCircle} accent="rose" />
      </div>

      {(user.role === "approval_user" || user.role === "it_admin" || user.role === "manager") && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat testid="stat-unassigned" label="Atanmamış Yeni" value={data.unassigned ?? 0} icon={Inbox} accent="amber" />
          <Stat testid="stat-mine" label="Üzerimde Olan" value={data.my_assigned ?? 0} icon={UserCheck} accent="indigo" />
          <Stat testid="stat-avg" label="Ort. Onay Süresi (saat)" value={data.avg_approval_hours} icon={Clock} accent="slate" />
        </div>
      )}

      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="font-heading text-lg tracking-tight">Son Talepler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {data.recent.length === 0 && <div className="text-sm text-slate-500 py-4">Henüz talep yok.</div>}
            {data.recent.map(r => (
              <Link key={r.id} to={`/requests/${r.id}`} data-testid={`recent-${r.id}`} className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded">
                <div className="flex flex-col">
                  <div className="font-mono text-sm font-medium">{r.request_no}</div>
                  <div className="text-xs text-slate-500">{r.store_name} · {r.customer_name}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-mono text-sm text-slate-700">%{r.profit_pct}</div>
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
