import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api.get("/audit-logs").then(r => setLogs(r.data)); }, []);
  return (
    <div className="space-y-6" data-testid="audit-page">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Denetim Günlüğü</h1>
        <p className="text-slate-500 mt-1">Sistemdeki tüm önemli işlemler.</p>
      </div>
      <Card className="border-slate-200 shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Tarih</th>
                <th className="text-left px-4 py-3 font-medium">Kullanıcı</th>
                <th className="text-left px-4 py-3 font-medium">İşlem</th>
                <th className="text-left px-4 py-3 font-medium">Hedef</th>
                <th className="text-left px-4 py-3 font-medium">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map(l => (
                <tr key={l.id} data-testid={`audit-row-${l.id}`}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{new Date(l.created_at).toLocaleString("tr-TR")}</td>
                  <td className="px-4 py-2.5">{l.user_name} <span className="text-xs text-slate-500">({l.user_email})</span></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-2.5 text-slate-600">{l.target_type} {l.target_id?.slice(0,8)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{Object.keys(l.meta||{}).length ? JSON.stringify(l.meta) : "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Kayıt yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
