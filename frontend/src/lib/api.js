import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
});

// Attach token from localStorage as fallback (cross-origin cookies)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Bir hata oluştu.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const STATUS_LABELS = {
  new: "Yeni",
  in_review: "İnceleniyor",
  waiting_info: "Bilgi Bekleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  cancelled: "İptal Edildi",
};

export const ROLE_LABELS = {
  store_user: "Mağaza Kullanıcısı",
  approval_user: "Onay Personeli",
  manager: "Yönetici",
  it_admin: "IT Yöneticisi",
};

export const STATUS_LIST = ["new", "in_review", "waiting_info", "approved", "rejected", "cancelled"];
