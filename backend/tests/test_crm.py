"""CRM Backend tests - auth, requests, claim concurrency, RBAC, files, dashboard, audit."""
import os, io, pytest, requests

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://margin-approval-hub.preview.emergentagent.com').rstrip('/') + '/api'

CREDS = {
    'admin': ('admin@crm.local', 'Admin123!'),
    'manager': ('manager@crm.local', 'Manager123!'),
    'approval': ('approval@crm.local', 'Approval123!'),
    'approval2': ('approval2@crm.local', 'Approval123!'),
    'arcelik': ('arcelik@crm.local', 'Store123!'),
    'bellona': ('bellona@crm.local', 'Store123!'),
}

def login(role):
    email, pw = CREDS[role]
    r = requests.post(f'{BASE}/auth/login', json={'email': email, 'password': pw}, timeout=30)
    assert r.status_code == 200, f'login {role} failed: {r.status_code} {r.text}'
    j = r.json()
    return j['token'], j['user']

def H(tok): return {'Authorization': f'Bearer {tok}'}

@pytest.fixture(scope='module')
def tokens():
    return {k: login(k) for k in CREDS}

# ---- Auth ----
def test_login_all_roles(tokens):
    for k, (tok, u) in tokens.items():
        assert tok and u['email'] == CREDS[k][0]

def test_login_invalid():
    r = requests.post(f'{BASE}/auth/login', json={'email':'admin@crm.local','password':'wrong'}, timeout=15)
    assert r.status_code == 401

def test_me(tokens):
    tok,_ = tokens['admin']
    r = requests.get(f'{BASE}/auth/me', headers=H(tok), timeout=15)
    assert r.status_code == 200 and r.json()['role'] == 'it_admin'

# ---- Dashboard ----
def test_dashboard_store(tokens):
    tok,_ = tokens['arcelik']
    r = requests.get(f'{BASE}/dashboard', headers=H(tok), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert 'counts' in d and 'recent' in d
    for s in ['new','in_review','waiting_info','approved','rejected','cancelled','total']:
        assert s in d['counts']
    assert 'my_assigned' not in d

def test_dashboard_approval_has_extras(tokens):
    tok,_ = tokens['approval']
    d = requests.get(f'{BASE}/dashboard', headers=H(tok), timeout=15).json()
    assert 'my_assigned' in d and 'unassigned' in d and 'avg_approval_hours' in d

# ---- Requests CRUD ----
@pytest.fixture(scope='module')
def store_arcelik(tokens):
    tok,_ = tokens['admin']
    stores = requests.get(f'{BASE}/stores', headers=H(tok), timeout=15).json()
    return next(s for s in stores if s['brand']=='Arçelik')

@pytest.fixture(scope='module')
def new_request(tokens, store_arcelik):
    tok,_ = tokens['arcelik']
    payload = {'store_id': store_arcelik['id'], 'sales_number':'TEST_S1',
               'customer_name':'TEST Cust','customer_phone':'+905551112233',
               'sale_date':'2026-01-15','product_info':'TEST product',
               'total_amount':10000,'cost_amount':9000,'reason':'TEST'}
    r = requests.post(f'{BASE}/requests', headers=H(tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j['profit_amount'] == 1000
    # Profit pct uses (total-cost)/cost*100 = 1000/9000*100 = 11.11
    assert j['profit_pct'] == 11.11
    assert j['min_profit_pct'] == 15.0
    assert j['request_no'].startswith('TLP-')
    assert j['status'] == 'new'
    return j

def test_create_request_persisted(tokens, new_request):
    tok,_ = tokens['arcelik']
    r = requests.get(f'{BASE}/requests/{new_request["id"]}', headers=H(tok), timeout=15)
    assert r.status_code == 200 and r.json()['request_no'] == new_request['request_no']

def test_list_requests_filters(tokens):
    tok,_ = tokens['admin']
    r = requests.get(f'{BASE}/requests?status=new', headers=H(tok), timeout=15)
    assert r.status_code == 200
    assert all(i['status']=='new' for i in r.json())

def test_store_user_sees_only_own(tokens, store_arcelik):
    tok,_ = tokens['arcelik']
    items = requests.get(f'{BASE}/requests', headers=H(tok), timeout=15).json()
    assert all(i['store_id']==store_arcelik['id'] for i in items)

# ---- Claim concurrency ----
def test_claim_lock(tokens, new_request):
    tok1,_ = tokens['approval']
    tok2,_ = tokens['approval2']
    rid = new_request['id']
    # release first if held
    requests.post(f'{BASE}/requests/{rid}/release', headers=H(tok1), timeout=15)
    r1 = requests.post(f'{BASE}/requests/{rid}/claim', headers=H(tok1), timeout=15)
    assert r1.status_code == 200, r1.text
    assert r1.json()['status'] == 'in_review'
    assert r1.json()['assigned_to_name']
    # 2nd user tries -> 409
    r2 = requests.post(f'{BASE}/requests/{rid}/claim', headers=H(tok2), timeout=15)
    assert r2.status_code == 409
    assert 'tarafından alındı' in r2.json().get('detail','')
    # release
    rr = requests.post(f'{BASE}/requests/{rid}/release', headers=H(tok1), timeout=15)
    assert rr.status_code == 200
    assert rr.json()['status'] == 'new' and rr.json()['assigned_to'] is None

def test_status_change_requires_claim(tokens, new_request):
    tok2,_ = tokens['approval2']
    r = requests.post(f'{BASE}/requests/{new_request["id"]}/status',
                      headers=H(tok2), json={'status':'approved','comment':'ok'}, timeout=15)
    assert r.status_code == 403

def test_status_change_after_claim(tokens, new_request):
    tok,_ = tokens['approval']
    rid = new_request['id']
    requests.post(f'{BASE}/requests/{rid}/claim', headers=H(tok), timeout=15)
    r = requests.post(f'{BASE}/requests/{rid}/status', headers=H(tok),
                     json={'status':'waiting_info','comment':'need info'}, timeout=15)
    assert r.status_code == 200
    assert r.json()['status'] == 'waiting_info'

def test_store_cancel_own(tokens, store_arcelik):
    tok,_ = tokens['arcelik']
    payload = {'store_id': store_arcelik['id'], 'sales_number':'TEST_S2',
               'customer_name':'TEST C2','customer_phone':'+905552223344',
               'sale_date':'2026-01-15','product_info':'TEST p2',
               'total_amount':5000,'cost_amount':4500,'reason':'TEST'}
    rid = requests.post(f'{BASE}/requests', headers=H(tok), json=payload, timeout=15).json()['id']
    r = requests.post(f'{BASE}/requests/{rid}/status', headers=H(tok),
                     json={'status':'cancelled','comment':''}, timeout=15)
    assert r.status_code == 200 and r.json()['status']=='cancelled'

# ---- Comments ----
def test_add_comment(tokens, new_request):
    tok,_ = tokens['approval']
    r = requests.post(f'{BASE}/requests/{new_request["id"]}/comments',
                      headers=H(tok), json={'text':'TEST comment'}, timeout=15)
    assert r.status_code == 200 and r.json()['text']=='TEST comment'

# ---- Files ----
def test_upload_invalid_ext(tokens, new_request):
    tok,_ = tokens['arcelik']
    files = {'file': ('bad.exe', b'MZ', 'application/octet-stream')}
    r = requests.post(f'{BASE}/requests/{new_request["id"]}/files',
                      headers=H(tok), files=files, timeout=30)
    assert r.status_code == 400

def test_upload_png_and_download(tokens, new_request):
    tok,_ = tokens['arcelik']
    png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000101a5f645400000000049454e44ae426082')
    files = {'file': ('t.png', png, 'image/png')}
    r = requests.post(f'{BASE}/requests/{new_request["id"]}/files',
                      headers=H(tok), files=files, timeout=60)
    if r.status_code != 200:
        pytest.skip(f'Object storage unavailable: {r.status_code} {r.text[:200]}')
    fid = r.json()['id']
    d = requests.get(f'{BASE}/requests/{new_request["id"]}/files/{fid}?auth={tok}', timeout=30)
    assert d.status_code == 200

# ---- RBAC ----
def test_store_cannot_create_user(tokens):
    tok,_ = tokens['arcelik']
    r = requests.post(f'{BASE}/users', headers=H(tok),
                      json={'email':'TEST_x@x.com','password':'X1!','name':'X','role':'store_user'}, timeout=15)
    assert r.status_code == 403

def test_approval_cannot_upsert_brand(tokens):
    tok,_ = tokens['approval']
    r = requests.post(f'{BASE}/brands', headers=H(tok),
                      json={'name':'TestBrand','min_profit_pct':5.0}, timeout=15)
    assert r.status_code == 403

def test_store_cannot_view_other_store_request(tokens):
    tok_a,_ = tokens['admin']
    items = requests.get(f'{BASE}/requests?brand=Bellona', headers=H(tok_a), timeout=15).json()
    if not items: pytest.skip('no bellona request')
    tok,_ = tokens['arcelik']
    r = requests.get(f'{BASE}/requests/{items[0]["id"]}', headers=H(tok), timeout=15)
    assert r.status_code == 403

# ---- Audit ----
def test_audit_logs(tokens):
    tok,_ = tokens['admin']
    r = requests.get(f'{BASE}/audit-logs', headers=H(tok), timeout=15)
    assert r.status_code == 200
    actions = {x['action'] for x in r.json()}
    assert 'login' in actions

def test_audit_forbidden_for_store(tokens):
    tok,_ = tokens['arcelik']
    r = requests.get(f'{BASE}/audit-logs', headers=H(tok), timeout=15)
    assert r.status_code == 403

# ---- Admin endpoints ----
def test_upsert_brand(tokens):
    tok,_ = tokens['admin']
    r = requests.post(f'{BASE}/brands', headers=H(tok),
                     json={'name':'TestBrandZ','min_profit_pct':9.5}, timeout=15)
    assert r.status_code == 200 and r.json()['min_profit_pct']==9.5

def test_create_user(tokens):
    tok,_ = tokens['admin']
    import uuid as _u
    email = f'TEST_{_u.uuid4().hex[:8]}@x.com'
    r = requests.post(f'{BASE}/users', headers=H(tok),
                     json={'email':email,'password':'Pwd123!','name':'TEST User','role':'store_user'}, timeout=15)
    assert r.status_code == 200 and r.json()['email']==email.lower()

# ---- File download RBAC across stores ----
def test_download_file_cross_store_forbidden(tokens, new_request):
    tok_a,_ = tokens['arcelik']
    png = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000101a5f645400000000049454e44ae426082')
    up = requests.post(f'{BASE}/requests/{new_request["id"]}/files',
                       headers=H(tok_a), files={'file':('t.png', png, 'image/png')}, timeout=60)
    if up.status_code != 200:
        pytest.skip('storage unavailable')
    fid = up.json()['id']
    tok_b,_ = tokens['bellona']
    r = requests.get(f'{BASE}/requests/{new_request["id"]}/files/{fid}?auth={tok_b}', timeout=30)
    assert r.status_code == 403
