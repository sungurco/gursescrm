import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, formatApiError, STATUS_LABELS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { ArrowLeft, FileText, Image as ImgIcon, Download, MessageSquare, History, UserCheck, Unlock } from "lucide-react";

function FieldRow({ label, value, mono }) {
  return (
    <div className="py-2 border-b border-slate-100 last:border-0">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm text-slate-900 mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [r, setR] = useState(null);
  const [comment, setComment] = useState("");
  const [statusComment, setStatusComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/requests/${id}`);
      setR(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  useEffect(() => { load(); }, [id]);

  if (!r) return <div className="text-slate-500">Yükleniyor...</div>;

  const isApprovalUser = user.role === "approval_user" || user.role === "it_admin";
  const isMine = r.assigned_to === user.id;
  const isAdmin = user.role === "it_admin";
  const canChangeStatus = isMine || isAdmin;
  const isStoreOwner = user.role === "store_user" && (user.store_ids || []).includes(r.store_id);
  const isClosed = ["approved","rejected","cancelled"].includes(r.status);
  const canEdit = (isStoreOwner || isAdmin) && !r.assigned_to && !isClosed;

  const claim = async () => {
    setBusy(true);
    try {
      await api.post(`/requests/${id}/claim`);
      toast.success("Talep üstlenildi");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const release = async () => {
    setBusy(true);
    try {
      await api.post(`/requests/${id}/release`);
      toast.success("Serbest bırakıldı");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const changeStatus = async (newStatus) => {
    setBusy(true);
    try {
      await api.post(`/requests/${id}/status`, { status: newStatus, comment: statusComment });
      toast.success("Durum güncellendi");
      setStatusComment("");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    try {
      await api.post(`/requests/${id}/comments`, { text: comment });
      setComment("");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const upload = async () => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      await api.post(`/requests/${id}/files`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Dosya yüklendi");
      setFile(null);
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const fileUrl = (f) => `${api.defaults.baseURL}/requests/${id}/files/${f.id}?auth=${localStorage.getItem("token")}`;

  return (
    <div className="space-y-6 max-w-6xl" data-testid="request-detail-page">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={()=>nav(-1)} className="text-sm text-slate-500 flex items-center gap-1 hover:text-slate-900 mb-1">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5}/> Geri
          </button>
          <h1 className="font-heading text-3xl font-semibold tracking-tight font-mono">{r.request_no}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={r.status} />
            <span className="text-sm text-slate-500">{r.store_name} · {r.brand}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isApprovalUser && !r.assigned_to && !isClosed && (
            <Button data-testid="claim-btn" onClick={claim} disabled={busy} className="bg-slate-900 hover:bg-slate-800">
              <UserCheck className="w-4 h-4 mr-1" strokeWidth={1.5}/> Talebi Üzerime Al
            </Button>
          )}
          {isApprovalUser && isMine && !isClosed && (
            <Button data-testid="release-btn" variant="outline" onClick={release} disabled={busy}>
              <Unlock className="w-4 h-4 mr-1" strokeWidth={1.5}/> Serbest Bırak
            </Button>
          )}
          {isApprovalUser && r.assigned_to && !isMine && !isClosed && (
            <div data-testid="locked-by" className="text-xs px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-md">
              Talep {r.assigned_to_name} tarafından alındı
            </div>
          )}
        </div>
      </div>

      {r.assigned_to && (
        <div data-testid="assigned-banner" className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-amber-700" strokeWidth={1.5} />
          <div className="text-sm">
            <span className="font-semibold text-amber-900">{r.assigned_to_name}</span>
            <span className="text-amber-800"> talebi üstlenmiş durumda. Atanan onay personeli olduğu için talep düzenlenemez.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-none">
            <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Satış Bilgileri</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <FieldRow label="Mağaza" value={`${r.store_name} (${r.store_code})`} />
              <FieldRow label="Marka" value={r.brand} />
              <FieldRow label="Satış No" value={r.sales_number} mono />
              <FieldRow label="Satış Tarihi" value={r.sale_date} mono />
              <FieldRow label="Müşteri" value={r.customer_name} />
              <FieldRow label="Telefon" value={r.customer_phone} mono />
              <FieldRow label="Ödeme Yöntemi" value={({kredi_karti:"Kredi Kartı",nakit:"Nakit",senet:"Senet",havale:"Havale/EFT",diger:"Diğer"})[r.payment_method] || r.payment_method || "—"} />
              <div className="md:col-span-2"><FieldRow label="Ürün" value={r.product_info} /></div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none">
            <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Kâr Marjı</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-md border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-500">Toplam</div>
                <div className="font-mono text-lg font-semibold">{r.total_amount?.toLocaleString("tr-TR")} ₺</div>
              </div>
              <div className="bg-slate-50 rounded-md border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-500">Maliyet</div>
                <div className="font-mono text-lg font-semibold">{r.cost_amount?.toLocaleString("tr-TR")} ₺</div>
              </div>
              <div className="bg-slate-50 rounded-md border border-slate-200 p-3">
                <div className="text-xs uppercase tracking-wider text-slate-500">Kâr</div>
                <div className="font-mono text-lg font-semibold">{r.profit_amount?.toLocaleString("tr-TR")} ₺</div>
              </div>
              <div className={`rounded-md border p-3 ${(user.role === 'approval_user' || user.role === 'manager' || user.role === 'it_admin') ? (r.profit_pct < r.min_profit_pct ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200") : "bg-slate-50 border-slate-200"}`}>
                <div className="text-xs uppercase tracking-wider text-slate-600">
                  {(user.role === 'approval_user' || user.role === 'manager' || user.role === 'it_admin') ? `Kâr % (Min %${r.min_profit_pct})` : "Kâr %"}
                </div>
                <div className="font-mono text-lg font-semibold">%{r.profit_pct}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none">
            <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Açıklamalar</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Düşük Marj Nedeni</div>
                <div className="text-sm mt-1">{r.reason}</div>
              </div>
              {r.additional_notes && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Ek Notlar</div>
                  <div className="text-sm mt-1">{r.additional_notes}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none">
            <CardHeader><CardTitle className="font-heading tracking-tight text-lg flex items-center gap-2"><FileText className="w-4 h-4" strokeWidth={1.5}/> Dosyalar ({r.files.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {r.files.length === 0 && <div className="text-sm text-slate-500">Henüz dosya yüklenmedi.</div>}
                {r.files.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-md">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                      {f.content_type?.startsWith("image/") ? <ImgIcon className="w-4 h-4 text-slate-500" strokeWidth={1.5}/> : <FileText className="w-4 h-4 text-slate-500" strokeWidth={1.5}/>}
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{f.original_filename}</div>
                        <div className="text-xs text-slate-500">{f.uploaded_by_name} · {Math.round((f.size||0)/1024)} KB</div>
                      </div>
                    </div>
                    <a href={fileUrl(f)} target="_blank" rel="noreferrer" data-testid={`view-file-${f.id}`} className="text-sm text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 mr-3">
                      <ImgIcon className="w-4 h-4" strokeWidth={1.5}/> Görüntüle
                    </a>
                    <a href={fileUrl(f)} download={f.original_filename} data-testid={`download-file-${f.id}`} className="text-sm text-slate-700 hover:text-slate-900 inline-flex items-center gap-1">
                      <Download className="w-4 h-4" strokeWidth={1.5}/> İndir
                    </a>
                  </div>
                ))}
              </div>
              {(isStoreOwner || isMine || isAdmin) && !isClosed && (
                <div className="mt-4 flex gap-2">
                  <input data-testid="upload-file-input" type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e)=>setFile(e.target.files?.[0])} className="text-sm" />
                  <Button data-testid="upload-file-btn" size="sm" onClick={upload} disabled={!file} variant="outline">Yükle</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none">
            <CardHeader><CardTitle className="font-heading tracking-tight text-lg flex items-center gap-2"><MessageSquare className="w-4 h-4" strokeWidth={1.5}/> Yorumlar</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {r.comments.length === 0 && <div className="text-sm text-slate-500">Yorum yok.</div>}
                {r.comments.map(c => (
                  <div key={c.id} className="border-l-2 border-slate-200 pl-3">
                    <div className="text-xs text-slate-500"><span className="font-medium text-slate-700">{c.by_name}</span> · {new Date(c.at).toLocaleString("tr-TR")}</div>
                    <div className="text-sm mt-1">{c.text}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea data-testid="comment-input" value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="Yorum yaz..." rows={2} />
                <Button data-testid="comment-submit" onClick={addComment} className="bg-slate-900 hover:bg-slate-800 self-end">Gönder</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canChangeStatus && !isClosed && (
            <Card className="border-slate-200 shadow-none">
              <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Karar Ver</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea data-testid="status-comment" value={statusComment} onChange={(e)=>setStatusComment(e.target.value)} placeholder="Yorum (opsiyonel)" rows={2} />
                <div className="grid grid-cols-1 gap-2">
                  <Button data-testid="approve-btn" onClick={()=>changeStatus("approved")} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">Onayla</Button>
                  <Button data-testid="reject-btn" onClick={()=>changeStatus("rejected")} disabled={busy} className="bg-rose-600 hover:bg-rose-700 text-white">Reddet</Button>
                  <Button data-testid="info-btn" onClick={()=>changeStatus("waiting_info")} disabled={busy} variant="outline">Bilgi İste</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isStoreOwner && !isClosed && (
            <Card className="border-slate-200 shadow-none">
              <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Eylemler</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {canEdit && (
                  <Button data-testid="edit-request-btn" onClick={async()=>{
                    const reason = window.prompt("Düşük marj nedeni:", r.reason);
                    if (reason === null) return;
                    const notes = window.prompt("Ek notlar:", r.additional_notes || "") || "";
                    try {
                      await api.put(`/requests/${id}`, { reason, additional_notes: notes });
                      toast.success("Talep güncellendi");
                      load();
                    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
                  }} variant="outline" className="w-full">Talebi Düzenle</Button>
                )}
                {!canEdit && r.assigned_to && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Talep üstlenildi, düzenleme kapalı.</div>
                )}
                <Button data-testid="cancel-btn" onClick={()=>changeStatus("cancelled")} variant="outline" className="w-full">Talebi İptal Et</Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200 shadow-none">
            <CardHeader><CardTitle className="font-heading tracking-tight text-lg flex items-center gap-2"><History className="w-4 h-4" strokeWidth={1.5}/> Geçmiş</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {r.history.map((h, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={h.status} />
                      <span className="text-xs text-slate-500 font-mono">{new Date(h.at).toLocaleString("tr-TR")}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">{h.by_name} {h.comment && `· ${h.comment}`}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
