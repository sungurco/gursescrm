import { useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Upload, RotateCcw, Users as UsersIcon, Database, AlertTriangle, ShieldAlert } from "lucide-react";

const API_BASE = api.defaults.baseURL;

function getToken() { return localStorage.getItem("token"); }

async function downloadFile(url, fallbackName) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({detail:"İndirme başarısız"}));
    throw new Error(err.detail || "İndirme başarısız");
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const name = m ? m[1] : fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Backup() {
  const [busy, setBusy] = useState(false);

  // Dialog state
  const [dlg, setDlg] = useState(null); // {type, title, danger, action, extra?}
  const [pwd, setPwd] = useState("");
  const [file, setFile] = useState(null);
  const [userMode, setUserMode] = useState("merge");

  const closeDlg = () => { setDlg(null); setPwd(""); setFile(null); setUserMode("merge"); };

  const handleDownloadFull = async () => {
    setBusy(true);
    try {
      await downloadFile("/admin/backup", "gurses-crm-backup.json");
      toast.success("Yedek indirildi");
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const handleDownloadUsers = async () => {
    setBusy(true);
    try {
      await downloadFile("/admin/backup/users", "gurses-crm-users.json");
      toast.success("Kullanıcı yedeği indirildi");
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const runRestoreFull = async () => {
    if (!file) return toast.error("Lütfen bir yedek dosyası seçin");
    if (!pwd) return toast.error("Şifrenizi girin");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("password", pwd);
      const { data } = await api.post("/admin/restore", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const counts = Object.entries(data.restored || {}).map(([k,v])=>`${k}:${v}`).join(", ");
      toast.success(`Geri yükleme tamam (${counts})`);
      closeDlg();
      setTimeout(()=>window.location.reload(), 1200);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const runRestoreUsers = async () => {
    if (!file) return toast.error("Lütfen bir yedek dosyası seçin");
    if (!pwd) return toast.error("Şifrenizi girin");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("password", pwd); fd.append("mode", userMode);
      const { data } = await api.post("/admin/restore/users", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Kullanıcılar yüklendi (eklenen: ${data.inserted}, güncellenen: ${data.updated})`);
      closeDlg();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const runReset = async () => {
    if (!pwd) return toast.error("Şifrenizi girin");
    setBusy(true);
    try {
      await api.post("/admin/reset", { password: pwd });
      toast.success("Veritabanı sıfırlandı");
      closeDlg();
      setTimeout(()=>window.location.reload(), 1500);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-5xl" data-testid="backup-page">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Yedekleme ve Geri Yükleme</h1>
        <p className="text-slate-500 mt-1">Veritabanı yedeği indirme, geri yükleme ve sıfırlama işlemleri.</p>
      </div>

      <Card className="border-amber-200 bg-amber-50/50 shadow-none">
        <CardContent className="pt-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" strokeWidth={1.5}/>
          <div className="text-sm text-amber-900">
            <strong>Önemli:</strong> Yedek dosyalarınızı güvenli bir yerde saklayın. Yedekler kullanıcı şifre hash&apos;lerini ve tüm talepleri içerir. Geri yükleme ve sıfırlama işlemleri <strong>geri alınamaz</strong>.
          </div>
        </CardContent>
      </Card>

      {/* Full Backup Section */}
      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="font-heading tracking-tight text-lg flex items-center gap-2">
            <Database className="w-5 h-5" strokeWidth={1.5}/> Tam Veritabanı Yedeği
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Tüm verileri (kullanıcılar, mağazalar, markalar, talepler, denetim kayıtları, ayarlar) tek bir JSON dosyası olarak indirir.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button data-testid="download-full-btn" onClick={handleDownloadFull} disabled={busy} className="bg-slate-900 hover:bg-slate-800">
              <Download className="w-4 h-4 mr-1.5" strokeWidth={1.5}/> Yedek İndir
            </Button>
            <Button data-testid="open-restore-full-btn" onClick={()=>setDlg({type:"restore-full"})} disabled={busy} variant="outline">
              <Upload className="w-4 h-4 mr-1.5" strokeWidth={1.5}/> Yedekten Geri Yükle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Backup */}
      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="font-heading tracking-tight text-lg flex items-center gap-2">
            <UsersIcon className="w-5 h-5" strokeWidth={1.5}/> Sadece Kullanıcı Yedeği
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Sadece kullanıcı listesini (rol, mağaza, izinler, şifre hash&apos;i) ayrı bir dosyaya yedekleyin. Sıfırlama sonrası geri yükleyebilirsiniz.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button data-testid="download-users-btn" onClick={handleDownloadUsers} disabled={busy} className="bg-slate-900 hover:bg-slate-800">
              <Download className="w-4 h-4 mr-1.5" strokeWidth={1.5}/> Kullanıcı Yedeği İndir
            </Button>
            <Button data-testid="open-restore-users-btn" onClick={()=>setDlg({type:"restore-users"})} disabled={busy} variant="outline">
              <Upload className="w-4 h-4 mr-1.5" strokeWidth={1.5}/> Kullanıcı Yedeğinden Yükle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Section */}
      <Card className="border-rose-200 shadow-none">
        <CardHeader>
          <CardTitle className="font-heading tracking-tight text-lg flex items-center gap-2 text-rose-700">
            <ShieldAlert className="w-5 h-5" strokeWidth={1.5}/> Tehlikeli Bölge — Veritabanını Sıfırla
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-700">
            <strong className="text-rose-700">DİKKAT:</strong> Bu işlem tüm talepleri, denetim kayıtlarını, mağazaları, kullanıcıları ve yüklenen dosya referanslarını <strong>kalıcı olarak siler</strong>. Sistem varsayılan seed kullanıcıları ve mağazaları ile yeniden başlatılır. İşlem geri alınamaz.
          </p>
          <p className="text-xs text-slate-500">
            <strong>Öneri:</strong> Sıfırlamadan önce yukarıdaki &quot;Yedek İndir&quot; ile mevcut durumu kaydedin.
          </p>
          <Button data-testid="open-reset-btn" onClick={()=>setDlg({type:"reset"})} disabled={busy} variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
            <RotateCcw className="w-4 h-4 mr-1.5" strokeWidth={1.5}/> Veritabanını Sıfırla
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={dlg !== null} onOpenChange={(v)=>!v && closeDlg()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading tracking-tight">
              {dlg?.type === "restore-full" && "Yedekten Tam Geri Yükle"}
              {dlg?.type === "restore-users" && "Kullanıcı Yedeğinden Yükle"}
              {dlg?.type === "reset" && "Veritabanını Sıfırla"}
            </DialogTitle>
          </DialogHeader>

          {dlg?.type === "restore-full" && (
            <div className="space-y-3">
              <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">
                ⚠️ Bu işlem <strong>mevcut tüm verileri silip</strong> yedekten gelen veriyle değiştirir.
              </div>
              <div>
                <Label>Yedek dosyası (.json)</Label>
                <Input data-testid="restore-full-file" type="file" accept=".json" onChange={(e)=>setFile(e.target.files?.[0])} className="mt-1.5" />
              </div>
              <div>
                <Label>Şifrenizi onayı için girin</Label>
                <Input data-testid="restore-full-pwd" type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} className="mt-1.5" placeholder="Mevcut admin şifreniz" />
              </div>
            </div>
          )}

          {dlg?.type === "restore-users" && (
            <div className="space-y-3">
              <div>
                <Label>Kullanıcı yedeği (.json)</Label>
                <Input data-testid="restore-users-file" type="file" accept=".json" onChange={(e)=>setFile(e.target.files?.[0])} className="mt-1.5" />
              </div>
              <div>
                <Label>Mod</Label>
                <Select value={userMode} onValueChange={setUserMode}>
                  <SelectTrigger data-testid="restore-users-mode" className="mt-1.5"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merge">Birleştir (mevcut kullanıcıları günceller, yenileri ekler)</SelectItem>
                    <SelectItem value="replace">Tamamen değiştir (mevcut kullanıcıları siler, sadece sizi korur)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Şifrenizi onayı için girin</Label>
                <Input data-testid="restore-users-pwd" type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} className="mt-1.5" />
              </div>
            </div>
          )}

          {dlg?.type === "reset" && (
            <div className="space-y-3">
              <div className="text-sm text-rose-900 bg-rose-50 border border-rose-200 rounded p-3">
                ⚠️ <strong>Bu işlem geri alınamaz!</strong> Tüm talepler, mağazalar, kullanıcılar, denetim kayıtları silinecek ve varsayılan seed verilerle başlanacak.
              </div>
              <div>
                <Label>Onaylamak için şifrenizi girin</Label>
                <Input data-testid="reset-pwd" type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} className="mt-1.5" placeholder="Mevcut admin şifreniz" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDlg} disabled={busy}>İptal</Button>
            {dlg?.type === "restore-full" && (
              <Button data-testid="confirm-restore-full" onClick={runRestoreFull} disabled={busy} className="bg-amber-600 hover:bg-amber-700 text-white">
                {busy ? "Geri yükleniyor..." : "Geri Yükle"}
              </Button>
            )}
            {dlg?.type === "restore-users" && (
              <Button data-testid="confirm-restore-users" onClick={runRestoreUsers} disabled={busy} className="bg-slate-900 hover:bg-slate-800">
                {busy ? "Yükleniyor..." : "Yükle"}
              </Button>
            )}
            {dlg?.type === "reset" && (
              <Button data-testid="confirm-reset" onClick={runReset} disabled={busy} className="bg-rose-600 hover:bg-rose-700 text-white">
                {busy ? "Sıfırlanıyor..." : "EVET, SIFIRLA"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
