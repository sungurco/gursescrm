import { STATUS_LABELS } from "@/lib/api";

const STYLES = {
  new: "bg-sky-50 text-sky-700 border-sky-200",
  in_review: "bg-amber-50 text-amber-700 border-amber-200",
  waiting_info: "bg-orange-50 text-orange-700 border-orange-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function StatusBadge({ status }) {
  const cls = STYLES[status] || STYLES.cancelled;
  return (
    <span data-testid={`status-${status}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-medium ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
