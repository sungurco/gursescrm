from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import requests
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form, Query, Header
from fastapi.responses import Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# -------------------- DB --------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# -------------------- App --------------------
app = FastAPI(title="Sales Margin Approval CRM")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# -------------------- Constants --------------------
JWT_ALG = "HS256"
ROLES = ["store_user", "approval_user", "manager", "it_admin"]
STATUSES = ["new", "in_review", "waiting_info", "approved", "rejected", "cancelled"]

# -------------------- Auth Helpers --------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(uid: str, email: str, role: str) -> str:
    payload = {
        "sub": uid, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"], "is_active": True}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    user.pop("_id", None)
    return user

def require_roles(*allowed):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker

# -------------------- Object Storage --------------------
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = os.environ.get("APP_NAME", "margincrm")
STORAGE_MODE = os.environ.get("STORAGE_MODE", "emergent").lower()  # "emergent" | "local"
LOCAL_STORAGE_PATH = Path(os.environ.get("LOCAL_STORAGE_PATH", "/data/uploads"))
_storage_key = {"value": None}

def init_storage():
    if STORAGE_MODE == "local":
        LOCAL_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
        logger.info(f"Local storage initialized at {LOCAL_STORAGE_PATH}")
        return "local"
    if _storage_key["value"]:
        return _storage_key["value"]
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key["value"] = resp.json()["storage_key"]
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        raise
    return _storage_key["value"]

def put_object(path: str, data: bytes, content_type: str):
    if STORAGE_MODE == "local":
        init_storage()
        file_path = LOCAL_STORAGE_PATH / path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        meta_path = file_path.with_suffix(file_path.suffix + ".ct")
        meta_path.write_text(content_type, encoding="utf-8")
        return {"path": path, "size": len(data)}
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 403:
        _storage_key["value"] = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    if STORAGE_MODE == "local":
        file_path = LOCAL_STORAGE_PATH / path
        if not file_path.exists():
            raise FileNotFoundError(path)
        meta_path = file_path.with_suffix(file_path.suffix + ".ct")
        ct = meta_path.read_text(encoding="utf-8").strip() if meta_path.exists() else "application/octet-stream"
        return file_path.read_bytes(), ct
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 403:
        _storage_key["value"] = None
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# -------------------- Audit --------------------
ACTION_LABELS = {
    "login": "Giriş yaptı",
    "logout": "Çıkış yaptı",
    "create_request": "Talep oluşturdu",
    "update_request": "Talebi düzenledi",
    "claim_request": "Talebi üstlendi",
    "release_request": "Talebi serbest bıraktı",
    "status_new": "Durumu Yeni yaptı",
    "status_in_review": "Durumu İncelemeye aldı",
    "status_waiting_info": "Bilgi istedi",
    "status_approved": "Talebi ONAYLADI",
    "status_rejected": "Talebi REDDETTİ",
    "status_cancelled": "Talebi iptal etti",
    "add_comment": "Yorum ekledi",
    "upload_file": "Dosya yükledi",
    "create_user": "Kullanıcı oluşturdu",
    "update_user": "Kullanıcı bilgisini güncelledi",
    "delete_user": "Kullanıcı sildi",
    "create_store": "Mağaza oluşturdu",
    "update_store": "Mağaza güncelledi",
    "delete_store": "Mağaza sildi",
    "upsert_brand": "Marka kâr marjı ayarladı",
    "delete_brand": "Marka sildi",
    "update_logo": "Şirket logosunu güncelledi",
}

def describe_audit(action: str, meta: dict) -> str:
    base = ACTION_LABELS.get(action, action)
    parts = [base]
    if not meta: return base
    if "request_no" in meta: parts.append(f"({meta['request_no']})")
    if "email" in meta: parts.append(f"— {meta['email']}")
    if "role" in meta: parts.append(f"[rol: {meta['role']}]")
    if "name" in meta: parts.append(f"— {meta['name']}")
    if "filename" in meta: parts.append(f"— dosya: {meta['filename']}")
    if "min_profit_pct" in meta: parts.append(f"— min %{meta['min_profit_pct']}")
    if "comment" in meta and meta["comment"]: parts.append(f'— "{meta["comment"]}"')
    if "changed" in meta: parts.append(f"— değişen: {', '.join(meta['changed'])}")
    return " ".join(parts)

async def log_audit(user: dict, action: str, target_type: str = "", target_id: str = "", meta: dict = None):
    meta = meta or {}
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "user_name": user.get("name"),
        "action": action,
        "description": describe_audit(action, meta),
        "target_type": target_type,
        "target_id": target_id,
        "meta": meta,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.audit_logs.insert_one(doc)

# -------------------- Models --------------------
class LoginIn(BaseModel):
    email: str
    password: str

class UserCreateIn(BaseModel):
    email: str
    password: str
    name: str
    role: Literal["store_user", "approval_user", "manager", "it_admin"]
    store_ids: List[str] = []
    phone: Optional[str] = None
    permissions: List[str] = []

class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["store_user", "approval_user", "manager", "it_admin"]] = None
    store_ids: Optional[List[str]] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    permissions: Optional[List[str]] = None

class StoreIn(BaseModel):
    name: str
    code: str
    brand: str
    address: Optional[str] = None
    phone: Optional[str] = None

class BrandIn(BaseModel):
    name: str
    min_profit_pct: float

class RequestIn(BaseModel):
    store_id: str
    sales_number: str
    customer_name: str
    customer_phone: Optional[str] = ""
    sale_date: str
    product_info: Optional[str] = ""
    total_amount: float
    cost_amount: float
    payment_method: Literal["kredi_karti", "nakit", "senet", "havale", "diger"] = "nakit"
    reason: str
    additional_notes: Optional[str] = ""

class RequestUpdateIn(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    sale_date: Optional[str] = None
    product_info: Optional[str] = None
    total_amount: Optional[float] = None
    cost_amount: Optional[float] = None
    payment_method: Optional[Literal["kredi_karti", "nakit", "senet", "havale", "diger"]] = None
    reason: Optional[str] = None
    additional_notes: Optional[str] = None

class CommentIn(BaseModel):
    text: str

class StatusChangeIn(BaseModel):
    status: Literal["new", "in_review", "waiting_info", "approved", "rejected", "cancelled"]
    comment: Optional[str] = ""

# -------------------- Auth Routes --------------------
@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User is deactivated")
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=43200, path="/")
    await log_audit(user, "login", "auth", user["id"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    await log_audit(user, "logout", "auth", user["id"])
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# -------------------- Stores --------------------
@api.get("/stores")
async def list_stores(user: dict = Depends(get_current_user)):
    q = {}
    if user["role"] == "store_user":
        q["id"] = {"$in": user.get("store_ids") or []}
    stores = await db.stores.find(q, {"_id": 0}).to_list(1000)
    return stores

@api.post("/stores")
async def create_store(payload: StoreIn, user: dict = Depends(require_roles("it_admin", "manager"))):
    sid = str(uuid.uuid4())
    doc = {"id": sid, **payload.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.stores.insert_one(doc)
    await log_audit(user, "create_store", "store", sid, {"name": payload.name})
    doc.pop("_id", None)
    return doc

@api.put("/stores/{store_id}")
async def update_store(store_id: str, payload: StoreIn, user: dict = Depends(require_roles("it_admin", "manager"))):
    res = await db.stores.update_one({"id": store_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Store not found")
    await log_audit(user, "update_store", "store", store_id)
    return {"ok": True}

@api.delete("/stores/{store_id}")
async def delete_store(store_id: str, user: dict = Depends(require_roles("it_admin"))):
    await db.stores.delete_one({"id": store_id})
    await log_audit(user, "delete_store", "store", store_id)
    return {"ok": True}

# -------------------- Brands --------------------
@api.get("/brands")
async def list_brands(user: dict = Depends(get_current_user)):
    return await db.brands.find({}, {"_id": 0}).to_list(1000)

@api.post("/brands")
async def upsert_brand(payload: BrandIn, user: dict = Depends(require_roles("it_admin", "manager"))):
    # use name as canonical id to match seed
    bid = payload.name
    doc = {"id": bid, "name": payload.name, "min_profit_pct": payload.min_profit_pct}
    await db.brands.update_one({"name": payload.name}, {"$set": doc}, upsert=True)
    await log_audit(user, "upsert_brand", "brand", bid, {"min_profit_pct": payload.min_profit_pct})
    return doc

@api.delete("/brands/{brand_id}")
async def delete_brand(brand_id: str, user: dict = Depends(require_roles("it_admin"))):
    await db.brands.delete_one({"id": brand_id})
    await log_audit(user, "delete_brand", "brand", brand_id)
    return {"ok": True}

# -------------------- Users --------------------
@api.get("/users")
async def list_users(user: dict = Depends(require_roles("it_admin", "manager"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api.post("/users")
async def create_user(payload: UserCreateIn, user: dict = Depends(require_roles("it_admin"))):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "password_hash": hash_password(payload.password),
        "name": payload.name, "role": payload.role, "store_ids": payload.store_ids or [],
        "phone": payload.phone, "is_active": True,
        "permissions": payload.permissions or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    await log_audit(user, "create_user", "user", uid, {"email": email, "role": payload.role})
    doc.pop("password_hash", None); doc.pop("_id", None)
    return doc

@api.put("/users/{uid}")
async def update_user(uid: str, payload: UserUpdateIn, user: dict = Depends(require_roles("it_admin"))):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    res = await db.users.update_one({"id": uid}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit(user, "update_user", "user", uid, {"changed": list(updates.keys())})
    return {"ok": True}

@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("it_admin"))):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
    target = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    # Cascade safety: do NOT delete if user has created requests or been assigned (log integrity)
    has_requests = await db.requests.count_documents({"$or": [{"created_by": uid}, {"assigned_to": uid}]})
    if has_requests > 0:
        raise HTTPException(status_code=400, detail=f"Bu kullanıcı {has_requests} talep ile ilişkili. Silmek yerine pasife alın.")
    await db.users.delete_one({"id": uid})
    await log_audit(user, "delete_user", "user", uid, {"email": target.get("email"), "name": target.get("name")})
    return {"ok": True}

# -------------------- Settings (Logo) --------------------
@api.get("/settings/logo")
async def get_logo(user: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"id": "company"}, {"_id": 0}) or {}
    return {"logo_data_url": s.get("logo_data_url", "")}

class LogoIn(BaseModel):
    logo_data_url: str = ""

@api.put("/settings/logo")
async def set_logo(payload: LogoIn, user: dict = Depends(require_roles("it_admin"))):
    if payload.logo_data_url and len(payload.logo_data_url) > 500_000:
        raise HTTPException(status_code=400, detail="Logo çok büyük (max ~400KB)")
    await db.settings.update_one({"id": "company"},
                                  {"$set": {"id": "company", "logo_data_url": payload.logo_data_url}},
                                  upsert=True)
    await log_audit(user, "update_logo", "settings", "company")
    return {"ok": True}

# -------------------- Approval Requests --------------------
async def _next_request_number():
    counter = await db.counters.find_one_and_update(
        {"_id": "request_seq"}, {"$inc": {"value": 1}}, upsert=True, return_document=True
    )
    val = counter["value"] if counter else 1
    return f"TLP-{datetime.now(timezone.utc).strftime('%Y%m')}-{val:05d}"

@api.post("/requests")
async def create_request(payload: RequestIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ("store_user", "it_admin", "manager"):
        raise HTTPException(status_code=403, detail="Only store users can create requests")
    if user["role"] == "store_user":
        if payload.store_id not in (user.get("store_ids") or []):
            raise HTTPException(status_code=403, detail="Bu mağaza için talep oluşturma yetkiniz yok")
    store = await db.stores.find_one({"id": payload.store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=400, detail="Store not found")
    brand = await db.brands.find_one({"name": store["brand"]}, {"_id": 0})
    min_pct = brand["min_profit_pct"] if brand else 0.0
    profit = payload.total_amount - payload.cost_amount
    # Kâr % = (Kâr / Maliyet) * 100 (markup üzerinden, kullanıcı isteği)
    profit_pct = (profit / payload.cost_amount * 100) if payload.cost_amount > 0 else 0
    rid = str(uuid.uuid4())
    req_no = await _next_request_number()
    doc = {
        "id": rid,
        "request_no": req_no,
        "store_id": store["id"],
        "store_name": store["name"],
        "store_code": store["code"],
        "brand": store["brand"],
        "sales_number": payload.sales_number,
        "customer_name": payload.customer_name,
        "customer_phone": payload.customer_phone,
        "sale_date": payload.sale_date,
        "product_info": payload.product_info,
        "total_amount": payload.total_amount,
        "cost_amount": payload.cost_amount,
        "profit_amount": profit,
        "profit_pct": round(profit_pct, 2),
        "min_profit_pct": min_pct,
        "reason": payload.reason,
        "additional_notes": payload.additional_notes or "",
        "payment_method": payload.payment_method,
        "status": "new",
        "assigned_to": None,
        "assigned_to_name": None,
        "assigned_at": None,
        "decided_at": None,
        "decided_by": None,
        "files": [],
        "comments": [],
        "history": [{
            "status": "new", "at": datetime.now(timezone.utc).isoformat(),
            "by": user["id"], "by_name": user["name"], "comment": "Talep oluşturuldu"
        }],
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.requests.insert_one(doc)
    await log_audit(user, "create_request", "request", rid, {"request_no": req_no})
    doc.pop("_id", None)
    return doc

@api.get("/requests")
async def list_requests(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    store_id: Optional[str] = None,
    brand: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    q = {}
    if status: q["status"] = status
    if store_id: q["store_id"] = store_id
    if brand: q["brand"] = brand
    # Enforce store scope for store_user AFTER user-provided filters
    if user["role"] == "store_user":
        q["store_id"] = {"$in": user.get("store_ids") or []}
    if assigned_to:
        q["assigned_to"] = None if assigned_to == "unassigned" else assigned_to
    if date_from or date_to:
        q["created_at"] = {}
        if date_from: q["created_at"]["$gte"] = date_from
        if date_to: q["created_at"]["$lte"] = date_to + "T23:59:59Z"
    if search:
        s = search.strip()
        q["$or"] = [
            {"request_no": {"$regex": s, "$options": "i"}},
            {"sales_number": {"$regex": s, "$options": "i"}},
            {"customer_name": {"$regex": s, "$options": "i"}},
            {"customer_phone": {"$regex": s, "$options": "i"}},
        ]
    items = await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items

@api.get("/requests/{rid}")
async def get_request(rid: str, user: dict = Depends(get_current_user)):
    r = await db.requests.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "store_user" and r["store_id"] not in (user.get("store_ids") or []):
        raise HTTPException(status_code=403, detail="Forbidden")
    return r

@api.put("/requests/{rid}")
async def update_request(rid: str, payload: RequestUpdateIn, user: dict = Depends(get_current_user)):
    r = await db.requests.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    # Only store user (owner store) or it_admin can edit, and only if not assigned/closed
    if user["role"] == "store_user":
        if r["store_id"] not in (user.get("store_ids") or []):
            raise HTTPException(status_code=403, detail="Forbidden")
    elif user["role"] != "it_admin":
        raise HTTPException(status_code=403, detail="Sadece talebi oluşturan mağaza veya IT Admin düzenleyebilir")
    if r.get("assigned_to") and user["role"] != "it_admin":
        raise HTTPException(status_code=409, detail=f"Talep {r.get('assigned_to_name')} tarafından üstlenildi, düzenlenemez")
    if r["status"] in ("approved", "rejected", "cancelled"):
        raise HTTPException(status_code=400, detail="Tamamlanmış talep düzenlenemez")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    # Recompute profit
    new_total = updates.get("total_amount", r["total_amount"])
    new_cost = updates.get("cost_amount", r["cost_amount"])
    if "total_amount" in updates or "cost_amount" in updates:
        profit = new_total - new_cost
        updates["profit_amount"] = profit
        updates["profit_pct"] = round((profit / new_cost * 100) if new_cost > 0 else 0, 2)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.requests.update_one({"id": rid}, {"$set": updates})
    await log_audit(user, "update_request", "request", rid,
                    {"request_no": r["request_no"], "changed": list(updates.keys())})
    return await db.requests.find_one({"id": rid}, {"_id": 0})

@api.post("/requests/{rid}/claim")
async def claim_request(rid: str, user: dict = Depends(require_roles("approval_user", "it_admin"))):
    r = await db.requests.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if r.get("assigned_to") and r["assigned_to"] != user["id"]:
        raise HTTPException(status_code=409, detail=f"Talep zaten {r.get('assigned_to_name')} tarafından alındı")
    if r["status"] in ("approved", "rejected", "cancelled"):
        raise HTTPException(status_code=400, detail="Talep zaten tamamlanmış")
    now = datetime.now(timezone.utc).isoformat()
    new_status = "in_review" if r["status"] == "new" else r["status"]
    await db.requests.update_one({"id": rid, "$or": [{"assigned_to": None}, {"assigned_to": user["id"]}]}, {
        "$set": {"assigned_to": user["id"], "assigned_to_name": user["name"],
                 "assigned_at": now, "status": new_status, "updated_at": now},
        "$push": {"history": {"status": new_status, "at": now, "by": user["id"],
                              "by_name": user["name"], "comment": "Talep üstlenildi"}}
    })
    await log_audit(user, "claim_request", "request", rid)
    r2 = await db.requests.find_one({"id": rid}, {"_id": 0})
    return r2

@api.post("/requests/{rid}/release")
async def release_request(rid: str, user: dict = Depends(get_current_user)):
    r = await db.requests.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if user.get("role") == "store_user" and r.get("assigned_to") != user["id"] and user["role"] != "it_admin":
        raise HTTPException(status_code=403, detail="Sadece talebi alan kullanıcı veya IT Admin serbest bırakabilir")
    if r.get("assigned_to") is None:
        return await db.requests.find_one({"id": rid}, {"_id": 0})
    now = datetime.now(timezone.utc).isoformat()
    await db.requests.update_one({"id": rid}, {
        "$set": {"assigned_to": None, "assigned_to_name": None, "assigned_at": None,
                 "status": "new", "updated_at": now},
        "$push": {"history": {"status": "new", "at": now, "by": user["id"],
                              "by_name": user["name"], "comment": "Talep serbest bırakıldı"}}
    })
    await log_audit(user, "release_request", "request", rid)
    return await db.requests.find_one({"id": rid}, {"_id": 0})

@api.post("/requests/{rid}/status")
async def change_status(rid: str, payload: StatusChangeIn, user: dict = Depends(get_current_user)):
    r = await db.requests.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    # permissions
    if user["role"] == "store_user":
        if payload.status != "cancelled" or r["store_id"] not in (user.get("store_ids") or []):
            raise HTTPException(status_code=403, detail="Sadece kendi talebinizi iptal edebilirsiniz")
    elif user["role"] in ("approval_user",):
        if r.get("assigned_to") != user["id"]:
            raise HTTPException(status_code=403, detail="Önce talebi üzerinize almalısınız")
    elif user["role"] not in ("it_admin", "manager"):
        raise HTTPException(status_code=403, detail="Forbidden")

    now = datetime.now(timezone.utc).isoformat()
    update = {"status": payload.status, "updated_at": now}
    if payload.status in ("approved", "rejected"):
        update["decided_at"] = now
        update["decided_by"] = user["id"]
    history_entry = {"status": payload.status, "at": now, "by": user["id"],
                     "by_name": user["name"], "comment": payload.comment or ""}
    await db.requests.update_one({"id": rid}, {"$set": update, "$push": {"history": history_entry}})
    await log_audit(user, f"status_{payload.status}", "request", rid, {"comment": payload.comment})
    return await db.requests.find_one({"id": rid}, {"_id": 0})

@api.post("/requests/{rid}/comments")
async def add_comment(rid: str, payload: CommentIn, user: dict = Depends(get_current_user)):
    r = await db.requests.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "store_user" and r["store_id"] not in (user.get("store_ids") or []):
        raise HTTPException(status_code=403, detail="Forbidden")
    comment = {
        "id": str(uuid.uuid4()), "text": payload.text,
        "by": user["id"], "by_name": user["name"], "by_role": user["role"],
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await db.requests.update_one({"id": rid}, {
        "$push": {"comments": comment},
        "$set": {"updated_at": comment["at"]}
    })
    await log_audit(user, "add_comment", "request", rid)
    return comment

# -------------------- Files --------------------
MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "pdf": "application/pdf"}

@api.post("/requests/{rid}/files")
async def upload_file(rid: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    r = await db.requests.find_one({"id": rid})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "store_user" and r["store_id"] not in (user.get("store_ids") or []):
        raise HTTPException(status_code=403, detail="Forbidden")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Sadece JPG, PNG, PDF dosyaları yükleyebilirsiniz")
    content_type = MIME_TYPES[ext]
    fid = str(uuid.uuid4())
    path = f"{APP_NAME}/requests/{rid}/{fid}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya 10MB'tan büyük olamaz")
    try:
        result = put_object(path, data, content_type)
    except Exception as e:
        logger.error(f"upload failed: {e}")
        raise HTTPException(status_code=500, detail="Dosya yükleme başarısız")
    file_doc = {
        "id": fid,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": user["id"],
        "uploaded_by_name": user["name"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.requests.update_one({"id": rid}, {"$push": {"files": file_doc}})
    await log_audit(user, "upload_file", "request", rid, {"filename": file.filename})
    return file_doc

@api.get("/requests/{rid}/files/{fid}")
async def download_file(rid: str, fid: str, request: Request,
                        authorization: Optional[str] = Header(None),
                        auth: Optional[str] = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    elif request.cookies.get("access_token"):
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"], "is_active": True}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    r = await db.requests.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["role"] == "store_user" and r["store_id"] not in (user.get("store_ids") or []):
        raise HTTPException(status_code=403, detail="Forbidden")
    f = next((x for x in r.get("files", []) if x["id"] == fid), None)
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    data, ct = get_object(f["storage_path"])
    return FastAPIResponse(content=data, media_type=f.get("content_type", ct))

# -------------------- Dashboard --------------------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    base_q = {}
    # Store user: only own created requests on dashboard (kendi açtığı talepler)
    if user["role"] == "store_user":
        base_q["created_by"] = user["id"]
    counts = {}
    for s in STATUSES:
        counts[s] = await db.requests.count_documents({**base_q, "status": s})
    counts["total"] = await db.requests.count_documents(base_q)

    # Avg approval time
    approved = await db.requests.find({**base_q, "status": "approved", "decided_at": {"$ne": None}},
                                       {"_id": 0, "created_at": 1, "decided_at": 1}).to_list(1000)
    avg_hours = 0
    if approved:
        deltas = []
        for r in approved:
            try:
                c = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
                d = datetime.fromisoformat(r["decided_at"].replace("Z", "+00:00"))
                deltas.append((d - c).total_seconds() / 3600)
            except Exception:
                pass
        if deltas:
            avg_hours = round(sum(deltas) / len(deltas), 1)

    result = {"counts": counts, "avg_approval_hours": avg_hours}

    if user["role"] in ("approval_user", "it_admin", "manager"):
        result["my_assigned"] = await db.requests.count_documents({"assigned_to": user["id"],
                                                                    "status": {"$nin": ["approved", "rejected", "cancelled"]}})
        result["unassigned"] = await db.requests.count_documents({"assigned_to": None,
                                                                   "status": {"$in": ["new"]}})

    # Recent
    result["recent"] = await db.requests.find(base_q, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return result

# -------------------- Audit Log --------------------
@api.get("/audit-logs")
async def audit_logs(user: dict = Depends(require_roles("it_admin")),
                     limit: int = 200, action: Optional[str] = None):
    q = {}
    if action: q["action"] = action
    return await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

# -------------------- Reports --------------------
def require_reports_access():
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] in ("it_admin", "manager"):
            return user
        if "can_view_reports" in (user.get("permissions") or []):
            return user
        raise HTTPException(status_code=403, detail="Raporları görüntüleme yetkiniz yok")
    return checker

@api.get("/reports/requests")
async def report_requests(
    user: dict = Depends(require_reports_access()),
    status: Optional[str] = None, brand: Optional[str] = None,
    store_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None,
):
    q = {}
    if status: q["status"] = status
    if brand: q["brand"] = brand
    if store_id: q["store_id"] = store_id
    if date_from or date_to:
        q["created_at"] = {}
        if date_from: q["created_at"]["$gte"] = date_from
        if date_to: q["created_at"]["$lte"] = date_to + "T23:59:59Z"
    items = await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return items

# -------------------- Mount --------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Startup: Indexes, Seed, Storage --------------------
async def seed_initial_data():
    # Brands
    default_brands = [
        {"id": "Arçelik", "name": "Arçelik", "min_profit_pct": 15.0},
        {"id": "Bellona", "name": "Bellona", "min_profit_pct": 12.0},
        {"id": "Mondi", "name": "Mondi", "min_profit_pct": 13.0},
    ]
    for b in default_brands:
        await db.brands.update_one({"name": b["name"]}, {"$set": b}, upsert=True)
    # Remove legacy lowercase ids if any exist from earlier seeds
    await db.brands.delete_many({"id": {"$in": ["arcelik", "bellona", "mondi"]}, "name": {"$nin": ["Arçelik", "Bellona", "Mondi"]}})

    # Stores
    default_stores = [
        {"name": "Arçelik Kadıköy", "code": "ARC-KDK-01", "brand": "Arçelik", "address": "Kadıköy, İstanbul", "phone": "+90 216 000 0001"},
        {"name": "Bellona Merkez", "code": "BEL-MRK-01", "brand": "Bellona", "address": "Kavaklıdere, Ankara", "phone": "+90 312 000 0002"},
        {"name": "Mondi Şube", "code": "MON-SUB-01", "brand": "Mondi", "address": "Karşıyaka, İzmir", "phone": "+90 232 000 0003"},
    ]
    store_ids = {}
    for s in default_stores:
        existing = await db.stores.find_one({"code": s["code"]})
        if existing:
            store_ids[s["brand"]] = existing["id"]
        else:
            sid = str(uuid.uuid4())
            await db.stores.insert_one({"id": sid, **s, "created_at": datetime.now(timezone.utc).isoformat()})
            store_ids[s["brand"]] = sid

    # Users
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@crm.local")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    seed_users = [
        {"email": admin_email, "password": admin_password, "name": "IT Admin", "role": "it_admin", "store_ids": []},
        {"email": "manager@crm.local", "password": "Manager123!", "name": "Genel Müdür", "role": "manager", "store_ids": []},
        {"email": "approval@crm.local", "password": "Approval123!", "name": "Onay Personeli", "role": "approval_user", "store_ids": []},
        {"email": "approval2@crm.local", "password": "Approval123!", "name": "Onay Personeli 2", "role": "approval_user", "store_ids": []},
        {"email": "arcelik@crm.local", "password": "Store123!", "name": "Arçelik Kadıköy Sorumlusu", "role": "store_user", "store_ids": [store_ids.get("Arçelik")] if store_ids.get("Arçelik") else []},
        {"email": "bellona@crm.local", "password": "Store123!", "name": "Bellona Merkez Sorumlusu", "role": "store_user", "store_ids": [store_ids.get("Bellona")] if store_ids.get("Bellona") else []},
        {"email": "mondi@crm.local", "password": "Store123!", "name": "Mondi Şube Sorumlusu", "role": "store_user", "store_ids": [store_ids.get("Mondi")] if store_ids.get("Mondi") else []},
    ]
    for u in seed_users:
        existing = await db.users.find_one({"email": u["email"].lower()})
        if existing:
            updates = {}
            if not verify_password(u["password"], existing["password_hash"]):
                updates["password_hash"] = hash_password(u["password"])
            # Migrate legacy store_id -> store_ids
            if "store_id" in existing and "store_ids" not in existing:
                updates["store_ids"] = [existing["store_id"]] if existing.get("store_id") else u["store_ids"]
            if updates:
                await db.users.update_one({"email": u["email"].lower()}, {"$set": updates})
            continue
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": u["email"].lower(),
            "password_hash": hash_password(u["password"]),
            "name": u["name"],
            "role": u["role"],
            "store_ids": u["store_ids"],
            "phone": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Sample requests
    if await db.requests.count_documents({}) == 0:
        arcelik_user = await db.users.find_one({"email": "arcelik@crm.local"})
        bellona_user = await db.users.find_one({"email": "bellona@crm.local"})
        mondi_user = await db.users.find_one({"email": "mondi@crm.local"})
        samples = [
            (arcelik_user, "Arçelik", "ARC-KDK-01", store_ids.get("Arçelik"), "Arçelik Kadıköy",
             "S-2026-001", "Ahmet Yılmaz", "+90 555 111 2233", "Buzdolabı No-Frost 520L", 24000, 22000, "new"),
            (bellona_user, "Bellona", "BEL-MRK-01", store_ids.get("Bellona"), "Bellona Merkez",
             "S-2026-002", "Ayşe Demir", "+90 555 222 3344", "Yatak Odası Takımı", 35000, 32000, "in_review"),
            (mondi_user, "Mondi", "MON-SUB-01", store_ids.get("Mondi"), "Mondi Şube",
             "S-2026-003", "Mehmet Kaya", "+90 555 333 4455", "Köşe Takımı", 28000, 25500, "waiting_info"),
            (arcelik_user, "Arçelik", "ARC-KDK-01", store_ids.get("Arçelik"), "Arçelik Kadıköy",
             "S-2026-004", "Zeynep Şahin", "+90 555 444 5566", "Çamaşır Makinesi 9kg", 18000, 16500, "approved"),
        ]
        for (u, brand, code, sid, sname, sn, cust, phone, prod, total, cost, status) in samples:
            if not u: continue
            brand_doc = next((b for b in default_brands if b["name"] == brand), None)
            min_pct = brand_doc["min_profit_pct"] if brand_doc else 12.0
            profit = total - cost
            ppct = round(profit/total*100, 2) if total else 0
            req_no = await _next_request_number()
            await db.requests.insert_one({
                "id": str(uuid.uuid4()),
                "request_no": req_no,
                "store_id": sid, "store_name": sname, "store_code": code, "brand": brand,
                "sales_number": sn, "customer_name": cust, "customer_phone": phone,
                "sale_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "product_info": prod,
                "total_amount": total, "cost_amount": cost,
                "profit_amount": profit, "profit_pct": ppct, "min_profit_pct": min_pct,
                "reason": "Müşteri pazarlık etti, rekabetçi fiyat verildi.",
                "additional_notes": "",
                "status": status, "assigned_to": None, "assigned_to_name": None,
                "assigned_at": None, "decided_at": None, "decided_by": None,
                "files": [], "comments": [],
                "history": [{"status": "new", "at": datetime.now(timezone.utc).isoformat(),
                             "by": u["id"], "by_name": u["name"], "comment": "Talep oluşturuldu"}],
                "created_by": u["id"], "created_by_name": u["name"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.requests.create_index("status")
    await db.requests.create_index("store_id")
    await db.requests.create_index("assigned_to")
    await db.audit_logs.create_index([("created_at", -1)])
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage not initialized at startup: {e}")
    await seed_initial_data()
    logger.info("Startup complete")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
