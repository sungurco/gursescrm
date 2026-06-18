"""Targeted tests for 5 fixes: reports RBAC + permissions override, update_request all fields including payment_method, status revert from approved, profit_pct correctness."""
import os
import pytest
import requests

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://margin-approval-hub.preview.emergentagent.com').rstrip('/') + '/api'

CREDS = {
    'admin': ('admin@crm.local', 'Admin123!'),
    'manager': ('manager@crm.local', 'Manager123!'),
    'approval': ('approval@crm.local', 'Approval123!'),
    'arcelik': ('arcelik@crm.local', 'Store123!'),
}


def login(role):
    e, p = CREDS[role]
    r = requests.post(f'{BASE}/auth/login', json={'email': e, 'password': p}, timeout=30)
    assert r.status_code == 200, f'{role} login failed: {r.text}'
    j = r.json()
    return j['token'], j['user']


def H(t):
    return {'Authorization': f'Bearer {t}'}


@pytest.fixture(scope='module')
def toks():
    return {k: login(k) for k in CREDS}


# ---- Fix 1: /api/reports/requests RBAC ----
def test_reports_admin_200(toks):
    tok, _ = toks['admin']
    r = requests.get(f'{BASE}/reports/requests', headers=H(tok), timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_reports_manager_200(toks):
    tok, _ = toks['manager']
    r = requests.get(f'{BASE}/reports/requests', headers=H(tok), timeout=15)
    assert r.status_code == 200


def test_reports_approval_default_403(toks):
    # First make sure permissions are empty
    admin_tok, _ = toks['admin']
    _, appr_user = toks['approval']
    requests.put(f'{BASE}/users/{appr_user["id"]}', headers=H(admin_tok),
                 json={'permissions': []}, timeout=15)
    tok, _ = toks['approval']
    r = requests.get(f'{BASE}/reports/requests', headers=H(tok), timeout=15)
    assert r.status_code == 403


def test_reports_store_default_403(toks):
    tok, _ = toks['arcelik']
    r = requests.get(f'{BASE}/reports/requests', headers=H(tok), timeout=15)
    assert r.status_code == 403


def test_reports_permission_override(toks):
    """PUT /users/{id} with permissions=['can_view_reports'] grants approval user reports access."""
    admin_tok, _ = toks['admin']
    _, appr_user = toks['approval']
    upd = requests.put(f'{BASE}/users/{appr_user["id"]}', headers=H(admin_tok),
                       json={'permissions': ['can_view_reports']}, timeout=15)
    assert upd.status_code == 200
    # Re-login to refresh user context (permissions stored on user doc, dep reloads from DB anyway)
    tok2, _ = login('approval')
    r = requests.get(f'{BASE}/reports/requests', headers=H(tok2), timeout=15)
    assert r.status_code == 200, r.text
    # Cleanup
    requests.put(f'{BASE}/users/{appr_user["id"]}', headers=H(admin_tok),
                 json={'permissions': []}, timeout=15)


# ---- Fix 2: Update request all fields incl payment_method ----
@pytest.fixture(scope='module')
def open_req(toks):
    tok, _ = toks['arcelik']
    stores = requests.get(f'{BASE}/stores', headers=H(tok), timeout=15).json()
    arc = next(s for s in stores if s['brand'] == 'Arçelik')
    payload = {'store_id': arc['id'], 'sales_number': 'TEST_UPD1',
               'customer_name': 'Orig Cust', 'customer_phone': '+905550000001',
               'sale_date': '2026-01-15', 'product_info': 'Orig product',
               'total_amount': 5000, 'cost_amount': 4000, 'reason': 'low margin',
               'payment_method': 'nakit'}
    r = requests.post(f'{BASE}/requests', headers=H(tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_update_request_all_fields(toks, open_req):
    tok, _ = toks['admin']
    rid = open_req['id']
    new = {
        'customer_name': 'Updated Cust',
        'customer_phone': '+905559998877',
        'sale_date': '2026-02-01',
        'product_info': 'Updated product info',
        'total_amount': 10000,
        'cost_amount': 8000,
        'payment_method': 'kredi_karti',
        'reason': 'Promosyon',
        'additional_notes': 'Ek not testi'
    }
    r = requests.put(f'{BASE}/requests/{rid}', headers=H(tok), json=new, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j['customer_name'] == 'Updated Cust'
    assert j['customer_phone'] == '+905559998877'
    assert j['sale_date'] == '2026-02-01'
    assert j['product_info'] == 'Updated product info'
    assert j['total_amount'] == 10000
    assert j['cost_amount'] == 8000
    assert j['payment_method'] == 'kredi_karti'
    assert j['reason'] == 'Promosyon'
    assert j['additional_notes'] == 'Ek not testi'
    # profit_pct recomputed: (10000-8000)/8000*100 = 25.0
    assert j['profit_pct'] == 25.0
    assert j['profit_amount'] == 2000

    # Verify persistence via GET
    g = requests.get(f'{BASE}/requests/{rid}', headers=H(tok), timeout=15)
    assert g.status_code == 200
    gj = g.json()
    assert gj['payment_method'] == 'kredi_karti'
    assert gj['profit_pct'] == 25.0


# ---- Fix 3: Status revert from approved ----
@pytest.fixture(scope='module')
def approved_req(toks):
    """Create a fresh request, claim, approve."""
    tok_s, _ = toks['arcelik']
    stores = requests.get(f'{BASE}/stores', headers=H(tok_s), timeout=15).json()
    arc = next(s for s in stores if s['brand'] == 'Arçelik')
    payload = {'store_id': arc['id'], 'sales_number': 'TEST_REVERT1',
               'customer_name': 'Rev Cust', 'customer_phone': '+905550003344',
               'sale_date': '2026-01-15', 'product_info': 'Rev prod',
               'total_amount': 10000, 'cost_amount': 8500, 'reason': 'test revert'}
    rid = requests.post(f'{BASE}/requests', headers=H(tok_s), json=payload, timeout=15).json()['id']
    tok_a, _ = toks['approval']
    requests.post(f'{BASE}/requests/{rid}/claim', headers=H(tok_a), timeout=15)
    requests.post(f'{BASE}/requests/{rid}/status', headers=H(tok_a),
                  json={'status': 'approved', 'comment': 'ok'}, timeout=15)
    return rid


def test_status_revert_admin_approved_to_rejected(toks, approved_req):
    tok, _ = toks['admin']
    r = requests.post(f'{BASE}/requests/{approved_req}/status', headers=H(tok),
                      json={'status': 'rejected', 'comment': 'revert test'}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j['status'] == 'rejected'
    # history appended
    assert any(h.get('status') == 'rejected' for h in j.get('history', []))


def test_status_revert_admin_to_new(toks, approved_req):
    tok, _ = toks['admin']
    r = requests.post(f'{BASE}/requests/{approved_req}/status', headers=H(tok),
                      json={'status': 'new', 'comment': 'back to new'}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()['status'] == 'new'


def test_status_revert_manager(toks, approved_req):
    # bring back to approved first via admin
    tok_admin, _ = toks['admin']
    requests.post(f'{BASE}/requests/{approved_req}/status', headers=H(tok_admin),
                  json={'status': 'approved', 'comment': 're-approve'}, timeout=15)
    tok_m, _ = toks['manager']
    r = requests.post(f'{BASE}/requests/{approved_req}/status', headers=H(tok_m),
                      json={'status': 'waiting_info', 'comment': 'need info'}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()['status'] == 'waiting_info'


# ---- Fix 4: profit_pct correctness on create ----
def test_profit_pct_25(toks):
    tok, _ = toks['arcelik']
    stores = requests.get(f'{BASE}/stores', headers=H(tok), timeout=15).json()
    arc = next(s for s in stores if s['brand'] == 'Arçelik')
    payload = {'store_id': arc['id'], 'sales_number': 'TEST_PCT_25',
               'customer_name': 'PCT', 'customer_phone': '+90555000',
               'sale_date': '2026-01-15', 'product_info': 'p',
               'total_amount': 10000, 'cost_amount': 8000, 'reason': 't'}
    r = requests.post(f'{BASE}/requests', headers=H(tok), json=payload, timeout=15)
    assert r.status_code == 200
    assert r.json()['profit_pct'] == 25.0


def test_profit_pct_100(toks):
    tok, _ = toks['arcelik']
    stores = requests.get(f'{BASE}/stores', headers=H(tok), timeout=15).json()
    arc = next(s for s in stores if s['brand'] == 'Arçelik')
    payload = {'store_id': arc['id'], 'sales_number': 'TEST_PCT_100',
               'customer_name': 'PCT', 'customer_phone': '+90555000',
               'sale_date': '2026-01-15', 'product_info': 'p',
               'total_amount': 1000, 'cost_amount': 500, 'reason': 't'}
    r = requests.post(f'{BASE}/requests', headers=H(tok), json=payload, timeout=15)
    assert r.status_code == 200
    assert r.json()['profit_pct'] == 100.0
