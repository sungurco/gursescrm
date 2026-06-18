import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, ROLE_LABELS } from "@/lib/api";
import { LayoutDashboard, ClipboardList, KanbanSquare, ShieldCheck, Users, Store, Settings, ScrollText, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Pano", icon: LayoutDashboard, roles: ["store_user","approval_user","manager","it_admin"], testid: "nav-dashboard" },
  { to: "/requests", label: "Talepler", icon: ClipboardList, roles: ["store_user","approval_user","manager","it_admin"], testid: "nav-requests" },
  { to: "/kanban", label: "Kanban", icon: KanbanSquare, roles: ["approval_user","manager","it_admin"], testid: "nav-kanban" },
  { to: "/audit", label: "Denetim Günlüğü", icon: ScrollText, roles: ["it_admin"], testid: "nav-audit" },
  { to: "/users", label: "Kullanıcılar", icon: Users, roles: ["it_admin"], testid: "nav-users" },
  { to: "/stores", label: "Mağazalar", icon: Store, roles: ["it_admin","manager"], testid: "nav-stores" },
  { to: "/settings", label: "Kâr Marjı Ayarları", icon: Settings, roles: ["it_admin","manager"], testid: "nav-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [logo, setLogo] = useState("");

  useEffect(() => {
    const fetchLogo = () => api.get("/settings/logo").then(r => setLogo(r.data.logo_data_url || "")).catch(()=>{});
    fetchLogo();
    window.addEventListener("logo-updated", fetchLogo);
    return () => window.removeEventListener("logo-updated", fetchLogo);
  }, []);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="logo" className="w-8 h-8 object-contain" data-testid="company-logo" />
            ) : (
              <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
              </div>
            )}
            <div>
              <div className="font-heading font-semibold text-sm tracking-tight">Gürses CRM</div>
              <div className="text-xs text-slate-500">Onay Sistemi</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.filter(n => n.roles.includes(user.role)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <n.icon className="w-4 h-4" strokeWidth={1.5} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="text-xs text-slate-500">Giriş yapan</div>
          <div className="text-sm font-medium truncate" data-testid="current-user-name">{user.name}</div>
          <div className="text-xs text-slate-500 mb-3" data-testid="current-user-role">{ROLE_LABELS[user.role]}</div>
          <Button
            data-testid="logout-btn"
            variant="outline"
            className="w-full"
            onClick={async () => { await logout(); nav("/login"); }}
          >
            <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} /> Çıkış Yap
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="h-14 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
          <div className="font-heading font-semibold tracking-tight">Düşük Kâr Marjı Onay Yönetimi</div>
          {user.role === "store_user" && (
            <Button
              data-testid="new-request-header-btn"
              size="sm"
              className="bg-slate-900 hover:bg-slate-800"
              onClick={() => nav("/requests/new")}
            >
              <Plus className="w-4 h-4 mr-1" strokeWidth={1.5} /> Yeni Talep
            </Button>
          )}
        </header>
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
