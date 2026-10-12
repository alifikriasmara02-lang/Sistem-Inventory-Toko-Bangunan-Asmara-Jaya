const state = { products: [], categories: [], suppliers: [], movements: [], view: 'overview' };
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('id-ID');
const stamp = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const el = (selector) => document.querySelector(selector);
const supabaseConfig = window.SUPABASE_CONFIG || {};
const supabaseUrl = String(supabaseConfig.url || '').replace(/\/$/, '');
const publishableKey = String(supabaseConfig.publishableKey || '').trim();
const authSessionKey = 'asmara-jaya-supabase-session';
const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
let authSession = null;

function buildDemoState() {
  const categories = [
    { id: 'cat-cemen', name: 'Semen & Mortar', description: 'Semen, mortar, dan bahan perekat' },
    { id: 'cat-besi', name: 'Besi & Baja', description: 'Besi beton, baja ringan, dan kawat' },
    { id: 'cat-cat', name: 'Cat & Pelapis', description: 'Cat interior, eksterior, dan pelapis' },
    { id: 'cat-pipa', name: 'Pipa & Sanitasi', description: 'Pipa dan perlengkapan sanitasi' },
    { id: 'cat-perkakas', name: 'Perkakas', description: 'Peralatan tangan dan perlengkapan kerja' }
  ];

  const suppliers = [
    { id: 'sup-utama', name: 'PT Sumber Bahan Utama', contact_name: 'Budi Santoso', phone: '0812-3456-7890', email: 'sales@sumberbahan.co.id' },
    { id: 'sup-mitra', name: 'CV Mitra Konstruksi', contact_name: 'Rina Wijaya', phone: '0813-4567-8901', email: 'order@mitrakonstruksi.co.id' },
    { id: 'sup-berkah', name: 'UD Berkah Material', contact_name: 'Agus Pratama', phone: '0815-6789-0123', email: 'berkah.material@example.com' }
  ];

  const products = [
    { id: 'prod-1', sku: 'SMN-001', name: 'Semen Portland 40kg', category_id: 'cat-cemen', supplier_id: 'sup-utama', unit: 'sak', price: 76000, stock_quantity: 18, minimum_stock: 6, categories: { name: 'Semen & Mortar' } },
    { id: 'prod-2', sku: 'BJR-014', name: 'Besi Beton 10mm', category_id: 'cat-besi', supplier_id: 'sup-mitra', unit: 'batang', price: 98000, stock_quantity: 5, minimum_stock: 8, categories: { name: 'Besi & Baja' } },
    { id: 'prod-3', sku: 'CAT-210', name: 'Cat Tembok Putih 5kg', category_id: 'cat-cat', supplier_id: 'sup-berkah', unit: 'kaleng', price: 145000, stock_quantity: 0, minimum_stock: 4, categories: { name: 'Cat & Pelapis' } },
    { id: 'prod-4', sku: 'PIP-055', name: 'Pipa PVC 1 inch', category_id: 'cat-pipa', supplier_id: 'sup-utama', unit: 'batang', price: 42000, stock_quantity: 27, minimum_stock: 7, categories: { name: 'Pipa & Sanitasi' } },
    { id: 'prod-5', sku: 'PKS-088', name: 'Palu Kunci 16oz', category_id: 'cat-perkakas', supplier_id: 'sup-mitra', unit: 'pcs', price: 260000, stock_quantity: 9, minimum_stock: 5, categories: { name: 'Perkakas' } }
  ];

  const movements = [
    { id: 'mv-1', product_id: 'prod-1', movement_type: 'in', quantity: 12, notes: 'Pembelian bulanan', created_at: '2026-10-11T08:15:00+07:00', products: { name: 'Semen Portland 40kg', sku: 'SMN-001' } },
    { id: 'mv-2', product_id: 'prod-2', movement_type: 'out', quantity: 3, notes: 'Pengiriman proyek rumah', created_at: '2026-10-11T10:30:00+07:00', products: { name: 'Besi Beton 10mm', sku: 'BJR-014' } },
    { id: 'mv-3', product_id: 'prod-4', movement_type: 'in', quantity: 8, notes: 'Restok dari pemasok', created_at: '2026-10-12T07:45:00+07:00', products: { name: 'Pipa PVC 1 inch', sku: 'PIP-055' } },
    { id: 'mv-4', product_id: 'prod-3', movement_type: 'out', quantity: 2, notes: 'Pemakaian renovasi kantor', created_at: '2026-10-12T09:20:00+07:00', products: { name: 'Cat Tembok Putih 5kg', sku: 'CAT-210' } }
  ];

  return { categories, suppliers, products, movements };
}

async function api(route, options = {}) {
  if (!supabaseUrl || !publishableKey || publishableKey.startsWith('sb_secret_')) {
    throw new Error('Konfigurasi belum benar. Gunakan publishable key sb_publishable_ di frontend/config.js, bukan secret key.');
  }
  await ensureSession();
  const method = options.method || 'GET';
  const readRoutes = {
    products: 'products?select=*,categories(name),suppliers(name)&order=updated_at.desc',
    categories: 'categories?select=id,name&order=name.asc',
    suppliers: 'suppliers?select=id,name&order=name.asc',
    movements: 'stock_movements?select=*,products(name,sku)&order=created_at.desc&limit=15'
  };
  const resource = method === 'POST'
    ? `${route === 'movements' ? 'stock_movements' : route}?select=*`
    : readRoutes[route];
  if (!resource) throw new Error('Endpoint Supabase tidak dikenal.');

  const headers = {
    apikey: publishableKey,
    Authorization: `Bearer ${authSession.access_token}`,
    'Content-Type': 'application/json',
    ...(method === 'POST' ? { Prefer: 'return=representation' } : {})
  };
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    method,
    headers,
    ...(options.body ? { body: JSON.stringify([JSON.parse(options.body)]) } : {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data?.message || data?.error_description || data?.error || 'Permintaan Supabase gagal.');
  return data;
}

function notify(message, error = false) {
  const notice = el('#notice');
  notice.textContent = message;
  notice.classList.toggle('error', error);
  notice.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { notice.hidden = true; }, 6000);
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function load() {
  el('#loading').hidden = false;
  el('#content').hidden = true;
  try {
    const [products, categories, suppliers, movements] = await Promise.all([
      api('products'), api('categories'), api('suppliers'), api('movements')
    ]);
    Object.assign(state, { products, categories, suppliers, movements });
    draw();
    const missingLists = [];
    if (!categories.length) missingLists.push('kategori');
    if (!suppliers.length) missingLists.push('pemasok');
    if (missingLists.length) {
      notify(`Daftar ${missingLists.join(' dan ')} kosong. Jalankan kembali backend/schema.sql di Supabase SQL Editor, lalu muat ulang.`, true);
    } else {
      el('#notice').hidden = true;
    }
  } catch (error) {
    const demoState = buildDemoState();
    Object.assign(state, demoState);
    draw();
    notify('Data demo aktif: koneksi database tidak tersedia. Gunakan ?demo=1 untuk melanjutkan dalam mode demo.', false);
  } finally { el('#loading').hidden = true; el('#content').hidden = false; }
}

async function authRequest(path, payload, accessToken = '') {
  const headers = { apikey: publishableKey, 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: 'POST', headers, body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || data?.error || 'Login Supabase gagal.');
  return data;
}

function saveSession(session) {
  authSession = {
    ...session,
    expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600)
  };
  localStorage.setItem(authSessionKey, JSON.stringify(authSession));
}

function clearSession() {
  authSession = null;
  localStorage.removeItem(authSessionKey);
}

async function ensureSession() {
  if (!authSession?.access_token) throw new Error('Silakan masuk dengan akun Supabase terlebih dahulu.');
  if (authSession.expires_at > Math.floor(Date.now() / 1000) + 60) return;
  if (!authSession.refresh_token) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
  const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: authSession.refresh_token });
  saveSession(refreshed);
}

function showAuth(message = '') {
  el('#app-shell').hidden = true;
  el('#auth-screen').hidden = false;
  const notice = el('#auth-message');
  notice.textContent = message;
  notice.hidden = !message;
  notice.classList.toggle('error', Boolean(message));
  if (window.lucide) window.lucide.createIcons();
}

async function initialize() {
  const demoRequested = demoMode || !supabaseUrl || !publishableKey || publishableKey.startsWith('sb_secret_');
  if (demoRequested) {
    Object.assign(state, buildDemoState());
    el('#auth-screen').hidden = true;
    el('#app-shell').hidden = false;
    el('#loading').hidden = true;
    el('#content').hidden = false;
    draw();
    return;
  }
  try {
    authSession = JSON.parse(localStorage.getItem(authSessionKey) || 'null');
    if (!authSession?.access_token) return showAuth();
    await ensureSession();
    el('#auth-screen').hidden = true;
    el('#app-shell').hidden = false;
    await load();
  } catch (error) {
    clearSession();
    showAuth(`Sesi tidak dapat dipulihkan. Silakan masuk kembali. ${error.message}`);
  }
}

function drawStats() {
  const units = state.products.reduce((sum, item) => sum + item.stock_quantity, 0);
  const low = state.products.filter((item) => item.stock_quantity <= item.minimum_stock).length;
  const value = state.products.reduce((sum, item) => sum + Number(item.price) * item.stock_quantity, 0);
  const cards = [
    ['Jenis barang', number.format(state.products.length), 'SKU terdaftar', 'boxes', 'green'],
    ['Unit tersedia', number.format(units), 'Total persediaan', 'package-check', 'blue'],
    ['Perlu restok', number.format(low), 'Mencapai batas minimum', 'triangle-alert', 'orange'],
    ['Nilai persediaan', money.format(value), 'Berdasarkan harga jual', 'wallet', 'yellow']
  ];
  el('#stats').innerHTML = cards.map(([label, value, foot, icon, color]) => `<article class="stat"><div class="stat-top">${label}<span class="stat-icon ${color}"><i data-lucide="${icon}"></i></span></div><p class="stat-value">${value}</p><p class="stat-foot">${foot}</p></article>`).join('');
}

function drawProducts() {
  const query = el('#search').value.trim().toLocaleLowerCase('id');
  const category = el('#category-filter').value;
  const items = state.products.filter((item) => `${item.name} ${item.sku}`.toLocaleLowerCase('id').includes(query) && (!category || item.category_id === category));
  el('#products').innerHTML = items.map((item) => {
    const empty = item.stock_quantity === 0;
    const low = !empty && item.stock_quantity <= item.minimum_stock;
    const status = empty ? ['empty', 'Habis'] : low ? ['low', 'Stok rendah'] : ['normal', 'Tersedia'];
    return `<tr><td><div class="product"><span class="product-icon"><i data-lucide="package"></i></span><span class="product-name"><b title="${safe(item.name)}">${safe(item.name)}</b><small>${safe(item.sku)}</small></span></div></td><td class="category">${safe(item.categories?.name || 'Tanpa kategori')}</td><td class="price">${money.format(item.price)}</td><td class="stock ${low || empty ? 'low' : ''}">${number.format(item.stock_quantity)} ${safe(item.unit)}</td><td><span class="pill ${status[0]}">${status[1]}</span></td><td><button class="row-action" data-move="${safe(item.id)}" title="Catat mutasi"><i data-lucide="arrow-left-right"></i></button></td></tr>`;
  }).join('');
  el('#empty').hidden = items.length > 0;
}

function drawActivities() {
  if (!state.movements.length) { el('#activity-list').innerHTML = '<div class="activity-empty">Belum ada aktivitas stok.</div>'; return; }
  el('#activity-list').innerHTML = state.movements.map((item) => {
    const inbound = item.movement_type === 'in';
    const name = item.products?.name || 'Barang';
    const when = item.notes ? `${item.notes} · ${stamp.format(new Date(item.created_at))}` : stamp.format(new Date(item.created_at));
    return `<article class="activity-item"><span class="activity-icon ${inbound ? 'green' : 'orange'}"><i data-lucide="${inbound ? 'arrow-down-to-line' : 'arrow-up-from-line'}"></i></span><div class="activity-copy"><b title="${safe(name)}">${safe(name)}</b><span title="${safe(when)}">${safe(when)}</span></div><span class="qty ${inbound ? 'in' : 'out'}">${inbound ? '+' : '-'}${number.format(item.quantity)}</span></article>`;
  }).join('');
}

function drawSelects() {
  const selected = el('#category-filter').value;
  const categories = state.categories.map((item) => `<option value="${safe(item.id)}">${safe(item.name)}</option>`).join('');
  el('#category-filter').innerHTML = `<option value="">Semua kategori</option>${categories}`;
  el('#category-filter').value = selected;
  const categoryPlaceholder = state.categories.length ? 'Pilih kategori' : 'Kategori belum tersedia';
  const supplierPlaceholder = state.suppliers.length ? 'Tanpa pemasok' : 'Pemasok belum tersedia';
  el('#product-category').innerHTML = `<option value="">${categoryPlaceholder}</option>${categories}`;
  el('#product-category').disabled = state.categories.length === 0;
  el('#product-supplier').innerHTML = `<option value="">${supplierPlaceholder}</option>${state.suppliers.map((item) => `<option value="${safe(item.id)}">${safe(item.name)}</option>`).join('')}`;
  el('#movement-product').innerHTML = state.products.map((item) => `<option value="${safe(item.id)}">${safe(item.name)} · ${number.format(item.stock_quantity)} ${safe(item.unit)}</option>`).join('');
}

function setView(view) {
  state.view = view;
  const copy = {
    overview: ['Ringkasan stok', 'Pantau persediaan dan aktivitas toko hari ini.', 'Ringkasan', 'Stok barang'],
    products: ['Daftar barang', 'Kelola katalog dan pantau jumlah persediaan.', 'Daftar barang', 'Semua barang'],
    movements: ['Mutasi stok', 'Telusuri barang masuk dan keluar dari persediaan.', 'Mutasi stok', 'Persediaan terkini']
  }[view];
  el('#title').textContent = copy[0]; el('#subtitle').textContent = copy[1];
  el('#crumb').textContent = copy[2]; el('#inventory-title').textContent = copy[3];
  el('#stats').hidden = view !== 'overview';
  el('#inventory').style.display = view === 'movements' ? 'none' : '';
  el('#activity').style.display = view === 'products' ? 'none' : '';
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}

function draw() {
  drawStats(); drawSelects(); drawProducts(); drawActivities(); setView(state.view);
  if (window.lucide) window.lucide.createIcons();
}

function openMovement(id = '') {
  if (!state.products.length) return notify('Tambahkan barang terlebih dahulu sebelum mencatat mutasi.', true);
  if (id) el('#movement-product').value = id;
  el('#movement-dialog').showModal();
}

el('#today').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
el('#refresh').addEventListener('click', load);
el('#add').addEventListener('click', () => el('#product-dialog').showModal());
el('#all-movements').addEventListener('click', () => setView('movements'));
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-goto]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.goto)));
el('#search').addEventListener('input', drawProducts);
el('#category-filter').addEventListener('change', drawProducts);
el('#products').addEventListener('click', (event) => { const button = event.target.closest('[data-move]'); if (button) openMovement(button.dataset.move); });

el('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const session = await authRequest('token?grant_type=password', { email: values.email, password: values.password });
    saveSession(session);
    form.reset();
    el('#auth-screen').hidden = true;
    el('#app-shell').hidden = false;
    await load();
  } catch (error) {
    showAuth(error.message);
  } finally { submit.disabled = false; }
});

el('#sign-out').addEventListener('click', async () => {
  try { await authRequest('logout', {}, authSession?.access_token || ''); } catch {}
  clearSession();
  showAuth();
});

el('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget; const submit = form.querySelector('[type=submit]'); submit.disabled = true;
  try {
    await api('products', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    el('#product-dialog').close(); form.reset(); form.elements.unit.value = 'sak'; form.elements.minimum_stock.value = '5';
    notify('Barang ditambahkan. Catat stok masuk untuk memperbarui persediaan.'); await load();
  } catch (error) { notify(error.message, true); } finally { submit.disabled = false; }
});

el('#movement-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget; const submit = form.querySelector('[type=submit]'); submit.disabled = true;
  try {
    await api('movements', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    el('#movement-dialog').close(); form.reset(); notify('Mutasi stok berhasil dicatat.'); await load();
  } catch (error) { notify(error.message, true); } finally { submit.disabled = false; }
});

if (window.lucide) window.lucide.createIcons();
initialize();