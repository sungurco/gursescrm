# Gürses CRM — Sales Profit Margin Approval

## Original Problem Statement
Web-based Sales Profit Margin Approval CRM for a Turkish retail company (Arçelik, Bellona, Mondi stores) replacing email/WhatsApp low-margin sale approvals. Roles: Store User, Approval User, Manager, IT Admin. Kanban workflow, file uploads, audit log, multi-store assignment, reporting.

## Stack
- Backend: FastAPI + MongoDB (Motor)
- Frontend: React 19 + Tailwind + Shadcn UI
- Auth: JWT (Bearer + httpOnly cookie)
- Storage: Emergent Object Storage (JPG/PNG/PDF)

## Critical Rules (DO NOT VIOLATE)
- Profit %: `(Sale - Cost) / Cost * 100` (cost-based, NOT sale-based)
- Request ID prefix: `TLP-` (e.g. TLP-202606-00017)
- All UI strings in Turkish
- No "Minimum Profit Margin" reference anywhere in the UI
- Footer signature: "© 2026 Gürses CRM · H.Sungur"

## What's Been Implemented
- ✅ JWT auth + 7 seed accounts (admin/manager/2× approval/3× store)
- ✅ Full request CRUD with profit auto-calc, claim/release, status flow, history, comments
- ✅ Multi-store per user, RBAC, audit log (admin only)
- ✅ Kanban board, file upload/download via Emergent Object Storage
- ✅ User mgmt (create, activate/deactivate, password reset), store mgmt
- ✅ Reports module with semicolon-CSV (BOM, CRLF) + PDF print export
- ✅ Custom logo upload, login subtitle, Turkish audit logs
- ✅ Inline file preview, optional phone (11-digit), payment_method field
- ✅ TLP- request prefix, store user sees only own store requests
- ✅ **Reports access via permissions array** — non-admin/manager users can be granted `can_view_reports`
- ✅ **Full edit form** on RequestDetail (all 9 fields: customer, phone, sale_date, product, amounts, payment_method, reason, notes)
- ✅ **Admin/Manager can revert closed (approved/rejected) requests** — Karar Ver panel shown even when closed, with "Bu talep kapanmış…" banner
- ✅ **Live profit % on Create form** uses correct (total-cost)/cost*100 formula
- ✅ **Admin can edit requests via UI** (Eylemler panel now visible to admin too)
- ✅ React hooks-order bug in RequestDetail.jsx fixed (useState moved above early return)

## Backlog
- P1: Email/in-app notifications when status changes
- P1: Kanban drag-and-drop status change
- P2: SLA timer per status with auto-escalation
- P2: Owner approval module (escalation tier)
- P2: Connector to external sales DB (auto-detect low margin)
- P2: Per-store override of brand min margin
- P3: Custom role builder

## Test Files
- `/app/backend/tests/test_crm.py` (23 regression tests)
- `/app/backend/tests/test_fixes.py` (11 tests for the 5 fixes verified)
- `/app/test_reports/iteration_3.json` (latest verification — 34/34 backend, 5/5 frontend fixes pass)

## Key Files
- `/app/backend/server.py` — single-file backend; `RequestUpdateIn` includes `payment_method`; `require_reports_access()` enforces permission.
- `/app/frontend/src/pages/Reports.jsx` — exportCSV uses `\uFEFF` BOM + `;` delimiter + `\r\n`.
- `/app/frontend/src/pages/RequestDetail.jsx` — hooks above early return; admin sees Eylemler panel.
- `/app/frontend/src/pages/RequestCreate.jsx` — live pct `((total-cost)/cost)*100`.
- `/app/frontend/src/pages/Users.jsx` — "Ek İzinler > Raporları Görüntüleyebilir" checkbox (`data-testid=perm-reports`).
- `/app/frontend/src/components/Layout.jsx`, `App.js`, `ProtectedRoute.jsx` — permission-based nav/routing.
