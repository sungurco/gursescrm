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
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});

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
  const canChangeStatus = isMine || isAdmin || user.role === "manager";
  const isStoreOwner = user.role === "store_user" && (user.store_ids || []).includes(r.store_id);
  const isClosed = ["approved","rejected","cancelled"].includes(r.status);
  const canEdit = (isStoreOwner || isAdmin) && !r.assigned_to && !isClosed;

  const startEdit = () => {
    setEditForm({
      customer_name: r.customer_name, customer_phone: r.customer_phone || "", sale_date: r.sale_date,
      product_info: r.product_info || "", total_amount: r.total_amount, cost_amount: r.cost_amount,
      payment_method: r.payment_method || "nakit", reason: r.reason, additional_notes: r.additional_notes || ""
    });
    setEditMode(true);
  };
  const saveEdit = async () => {
    try {
      await api.put(`/requests/${id}`, { ...editForm, total_amount: parseFloat(editForm.total_amount), cost_amount: parseFloat(editForm.cost_amount) });
      toast.success("Talep güncellendi"); setEditMode(false); await load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

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

      {editMode && (
        <Card className="border-amber-200 shadow-none bg-amber-50/50">
          <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Talebi Düzenle</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-600">Müşteri Adı</label><input className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={editForm.customer_name} onChange={(e)=>setEditForm({...editForm, customer_name:e.target.value})}/></div>
            <div><label className="text-xs text-slate-600">Telefon (11 hane, opsiyonel)</label><input className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-mono" value={editForm.customer_phone} onChange={(e)=>setEditForm({...editForm, customer_phone:e.target.value.replace(/[^0-9]/g,'').slice(0,11)})}/></div>
            <div><label className="text-xs text-slate-600">Satış Tarihi</label><input type="date" className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={editForm.sale_date} onChange={(e)=>setEditForm({...editForm, sale_date:e.target.value})}/></div>
            <div><label className="text-xs text-slate-600">Ödeme</label>
              <select className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={editForm.payment_method} onChange={(e)=>setEditForm({...editForm, payment_method:e.target.value})}>
                <option value="nakit">Nakit</option><option value="kredi_karti">Kredi Kartı</option><option value="senet">Senet</option><option value="havale">Havale/EFT</option><option value="diger">Diğer</option>
              </select></div>
            <div className="md:col-span-2"><label className="text-xs text-slate-600">Ürün Bilgisi</label><textarea rows={2} className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={editForm.product_info} onChange={(e)=>setEditForm({...editForm, product_info:e.target.value})}/></div>
            <div><label className="text-xs text-slate-600">Toplam Satış (₺)</label><input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-mono" value={editForm.total_amount} onChange={(e)=>setEditForm({...editForm, total_amount:e.target.value})}/></div>
            <div><label className="text-xs text-slate-600">Maliyet (₺)</label><input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1.5 text-sm font-mono" value={editForm.cost_amount} onChange={(e)=>setEditForm({...editForm, cost_amount:e.target.value})}/></div>
            <div className="md:col-span-2"><label className="text-xs text-slate-600">Düşük Marj Nedeni</label><textarea rows={2} className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={editForm.reason} onChange={(e)=>setEditForm({...editForm, reason:e.target.value})}/></div>
            <div className="md:col-span-2"><label className="text-xs text-slate-600">Ek Notlar</label><textarea rows={2} className="mt-1 w-full border rounded px-2 py-1.5 text-sm" value={editForm.additional_notes} onChange={(e)=>setEditForm({...editForm, additional_notes:e.target.value})}/></div>
            <div className="md:col-span-2 flex gap-2">
              <Button data-testid="edit-save-btn" onClick={saveEdit} className="bg-slate-900 hover:bg-slate-800">Kaydet</Button>
              <Button variant="outline" onClick={()=>setEditMode(false)}>İptal</Button>
            </div>
          </CardContent>
        </Card>
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
              {(user.role === 'approval_user' || user.role === 'manager' || user.role === 'it_admin') ? (
                <div className={`rounded-md border p-3 bg-slate-50 border-slate-200`}>
                  <div className="text-xs uppercase tracking-wider text-slate-600">Kâr %</div>
                  <div className="font-mono text-lg font-semibold">%{r.profit_pct}</div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-md border border-slate-200 p-3">
                  <div className="text-xs uppercase tracking-wider text-slate-500">Kâr %</div>
                  <div className="font-mono text-lg font-semibold">%{r.profit_pct}</div>
                </div>
              )}
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
          {canChangeStatus && (
            <Card className="border-slate-200 shadow-none">
              <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Karar Ver</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {isClosed && (isAdmin || user.role === "manager") && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Bu talep kapanmış; yine de durumunu değiştirebilirsiniz.</div>
                )}
                <Textarea data-testid="status-comment" value={statusComment} onChange={(e)=>setStatusComment(e.target.value)} placeholder="Yorum (opsiyonel)" rows={2} />
                <div className="grid grid-cols-1 gap-2">
                  <Button data-testid="approve-btn" onClick={()=>changeStatus("approved")} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">Onayla</Button>
                  <Button data-testid="reject-btn" onClick={()=>changeStatus("rejected")} disabled={busy} className="bg-rose-600 hover:bg-rose-700 text-white">Reddet</Button>
                  <Button data-testid="info-btn" onClick={()=>changeStatus("waiting_info")} disabled={busy} variant="outline">Bilgi İste / Tekrar Aç</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {(isStoreOwner || isAdmin) && !isClosed && (
            <Card className="border-slate-200 shadow-none">
              <CardHeader><CardTitle className="font-heading tracking-tight text-lg">Eylemler</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {canEdit && (
                  <Button data-testid="edit-request-btn" onClick={startEdit} variant="outline" className="w-full">Talebi Düzenle</Button>
                )}
                {!canEdit && r.assigned_to && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Talep üstlenildi, düzenleme kapalı.</div>
                )}
                {isStoreOwner && (
                  <Button data-testid="cancel-btn" onClick={()=>changeStatus("cancelled")} variant="outline" className="w-full">Talebi İptal Et</Button>
                )}
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
