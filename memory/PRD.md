# Sales Profit Margin Approval CRM — PRD

## Original Problem Statement
Build a web-based Sales Profit Margin Approval CRM for a Turkish retail company (Arçelik, Bellona, Mondi stores) to replace email/WhatsApp-based low-profit sale approvals with a centralized workflow. Roles: Store User, Approval Department, Manager/Owner, IT Admin. Kanban workflow, file uploads, audit log, brand-based profit margin rules.

## Stack (adapted to platform)
- Backend: FastAPI (Python) + MongoDB (was: .NET + MSSQL)
- Frontend: React 19 + Tailwind + Shadcn UI
- Auth: JWT (Bearer + httpOnly cookie fallback)
- Storage: Emergent Object Storage (JPG/PNG/PDF up to 10MB)

## User Personas
1. **Store User** — Arçelik/Bellona/Mondi store; creates low-margin approval requests
2. **Approval Officer** — Claims and reviews requests; cannot work in parallel on same request
3. **Manager/Owner** — Reads all data, configures min margin per brand
4. **IT Admin** — Full system control, user/store/role/margin management

## Core Requirements (static)
- RBAC across 4 roles
- "Talebi Üzerime Al" (claim) — concurrency-safe; only one approval user per request
- Request statuses: Yeni · İnceleniyor · Bilgi Bekleniyor · Onaylandı · Reddedildi · İptal
- Full history per request (status changes, comments, files, timestamps + user)
- Audit log for all critical actions
- File uploads linked to requests (JPG/PNG/PDF)
- Brand-based min profit % (Arçelik 15%, Bellona 12%, Mondi 13%)
- Filterable list (sales no, customer, store, brand, status, date range)
- Kanban view for approval flow

## What's Been Implemented (Feb 2026, day 1)
- ✅ JWT auth + 7 seed accounts (admin/manager/2× approval/3× store)
- ✅ 3 brands + 3 stores + 4 sample requests seeded
- ✅ Dashboard with KPIs (role-aware) and recent requests list
- ✅ Full request CRUD with profit margin auto-calc
- ✅ Claim/release with concurrency lock + Turkish error
- ✅ Status workflow with comments + history
- ✅ File upload/download via Emergent Object Storage, RBAC-scoped
- ✅ Kanban board (5 columns), card hover/translate-y animation
- ✅ Audit log (manager/admin)
- ✅ User mgmt (create, activate/deactivate, password reset)
- ✅ Store mgmt (admin)
- ✅ Brand min-margin settings (manager/admin)
- ✅ Search & filter (status/brand/store/date/free text)
- ✅ Tested: 23/23 backend tests pass, frontend flows verified

## Prioritized Backlog (P1/P2 — deferred for future iteration)
- **P1**: Email/in-app notifications when status changes
- **P1**: Bulk actions on Kanban (drag-and-drop status change)
- **P1**: CSV/Excel export of filtered requests
- **P2**: Owner approval module (escalation tier)
- **P2**: Reports module (charts: trend, brand, store, approver KPIs)
- **P2**: Connector to external sales DB (auto-detect low margin and create requests)
- **P2**: WhatsApp/SMS bot replacement
- **P2**: Per-store override of brand min margin
- **P2**: SLA timer per status with auto-escalation
- **P3**: Custom role builder (currently 4 fixed roles)

## Next Action Items
- Gather feedback from store/approval teams on the MVP
- Add notifications (P1)
- Consider IIS-based deployment if .NET migration is required later
