/* MealBridge — front-end SPA
   Talks to the Node/Express backend in /server. Auth is JWT in localStorage.
   Maps use Leaflet + OpenStreetMap tiles (no API key needed).
*/

// ============ Config ============
// If you serve the frontend from the Node server (recommended), this auto-detects the same origin.
const API_BASE = (location.port === '4000' || location.protocol === 'file:')
  ? 'http://localhost:4000/api'
  : `${location.origin}/api`;

const TOKEN_KEY = 'mb_token';
const USER_KEY = 'mb_user';

// Default map center — Karachi (matches the seed data). Falls back if geolocation denied.
const DEFAULT_CENTER = [24.8607, 67.0011];

// ============ Tiny helpers ============
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const state = {
  token: localStorage.getItem(TOKEN_KEY) || null,
  user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  regPin: null, // {lat,lng} chosen on register map
  newOfferPin: null, // {lat,lng} chosen on donor map
};

// ============ Toast notifications ============
function toast(msg, kind = 'info', ms = 3200) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  const icons = { success: '✓', error: '!', info: 'i' };
  el.innerHTML = `<div class="ic">${icons[kind] || 'i'}</div><div>${esc(msg)}</div>`;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 260); }, ms);
}

// ============ API ============
async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ============ Routing ============
function go(viewId, opts = {}) {
  // Guard: dashboard/receiver need auth + the right role
  if ((viewId === 'dashboard' || viewId === 'receiver') && !state.user) {
    toast('Please log in first', 'info');
    viewId = 'login';
  }
  if (viewId === 'dashboard' && state.user && state.user.role !== 'donor') viewId = 'receiver';
  if (viewId === 'receiver' && state.user && state.user.role !== 'ngo') viewId = 'dashboard';

  $$('.view').forEach(v => v.classList.toggle('active', v.id === viewId));
  $$('.nav-links button').forEach(b => b.classList.toggle('active', b.dataset.go === viewId));
  window.scrollTo({ top: 0, behavior: 'instant' });

  // mobile nav close
  $('#navLinks')?.classList.remove('open');

  // Per-view setup
  if (viewId === 'register') setupRegisterMap(opts.role);
  if (viewId === 'dashboard') loadDonorDashboard();
  if (viewId === 'receiver') loadNgoDashboard();
  if (viewId === 'faq') renderFaq();
}

function bindNav() {
  $$('[data-go]').forEach(b => b.addEventListener('click', e => {
    const target = b.dataset.go;
    const role = b.dataset.role;
    go(target, { role });
  }));
  $('#navToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
  $('#logoutBtn').addEventListener('click', logout);
}

function applyAuthUI() {
  const isAuthed = !!state.user;
  $$('.nav-links .anon').forEach(b => b.hidden = isAuthed);
  $$('.nav-links .auth').forEach(b => b.hidden = !isAuthed);
  $$('.donor-only').forEach(b => b.hidden = !(isAuthed && state.user.role === 'donor'));
  $$('.ngo-only').forEach(b => b.hidden = !(isAuthed && state.user.role === 'ngo'));
  if (isAuthed) $('#profileName').textContent = state.user.name?.split(' ')[0] || 'Me';
}

// ============ Auth ============
function persistAuth(token, user) {
  state.token = token; state.user = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  applyAuthUI();
}
function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY);
  applyAuthUI();
  toast('Logged out', 'info');
  go('landing');
}

async function refreshMe() {
  if (!state.token) return;
  try {
    const { user } = await api('/auth/me', { auth: true });
    state.user = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    applyAuthUI();
  } catch (err) {
    if (err.status === 401) logout();
  }
}

// ============ Login form ============
function bindLogin() {
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPass').value;
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      persistAuth(token, user);
      toast(`Welcome back, ${user.name.split(' ')[0]}`, 'success');
      go(user.role === 'ngo' ? 'receiver' : 'dashboard');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const demo = async (email) => {
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password: 'demo1234' } });
      persistAuth(token, user);
      toast(`Logged in as ${user.name}`, 'success');
      go(user.role === 'ngo' ? 'receiver' : 'dashboard');
    } catch (err) {
      toast('Demo login failed — is the backend running?', 'error');
    }
  };
  $('#demoDonor').addEventListener('click', () => demo('donor@example.com'));
  $('#demoNgo').addEventListener('click', () => demo('ngo@example.com'));
}

// ============ Register form + map ============
let regMap = null, regMarker = null;
function setupRegisterMap(preselectedRole) {
  if (preselectedRole === 'ngo') {
    const r = document.querySelector('input[name="regRole"][value="ngo"]');
    if (r) r.checked = true;
  }
  // Initialize once, then invalidateSize so it lays out correctly when shown
  setTimeout(() => {
    if (!regMap) {
      regMap = L.map('regMap', { zoomControl: true }).setView(DEFAULT_CENTER, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(regMap);
      regMap.on('click', e => setRegPin(e.latlng.lat, e.latlng.lng));
    }
    regMap.invalidateSize();
  }, 50);
}
function setRegPin(lat, lng) {
  state.regPin = { lat, lng };
  if (regMarker) regMap.removeLayer(regMarker);
  regMarker = L.marker([lat, lng]).addTo(regMap);
  regMap.setView([lat, lng], Math.max(regMap.getZoom(), 14));
  $('#regCoords').innerHTML = `📍 Pinned at <strong>${lat.toFixed(5)}, ${lng.toFixed(5)}</strong>`;
}
function bindRegister() {
  $('#regUseMyLoc').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Geolocation not supported by your browser', 'error');
    navigator.geolocation.getCurrentPosition(
      pos => setRegPin(pos.coords.latitude, pos.coords.longitude),
      () => toast('Could not get your location', 'error')
    );
  });

  $('#registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const role = document.querySelector('input[name="regRole"]:checked').value;
    const payload = {
      name: $('#regName').value.trim(),
      email: $('#regEmail').value.trim(),
      password: $('#regPass').value,
      role,
      phone: $('#regPhone').value.trim() || null,
      address: $('#regAddress').value.trim() || null,
      lat: state.regPin?.lat ?? null,
      lng: state.regPin?.lng ?? null,
    };
    if (payload.lat == null) { toast('Please drop a pin on the map to set your location', 'error'); return; }
    try {
      const { token, user } = await api('/auth/register', { method: 'POST', body: payload });
      persistAuth(token, user);
      toast(`Account created — welcome, ${user.name.split(' ')[0]}!`, 'success');
      go(user.role === 'ngo' ? 'receiver' : 'dashboard');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ============ Donor dashboard ============
let donorMap = null, donorMyMarker = null, donorPinMarker = null, donorNgoLayer = null;

async function loadDonorDashboard() {
  if (!state.user) return go('login');
  setTimeout(() => {
    if (!donorMap) {
      donorMap = L.map('donorMap', { zoomControl: true }).setView(
        [state.user.lat || DEFAULT_CENTER[0], state.user.lng || DEFAULT_CENTER[1]], 12
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(donorMap);
      donorMap.on('click', e => {
        state.newOfferPin = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (donorPinMarker) donorMap.removeLayer(donorPinMarker);
        donorPinMarker = L.marker([e.latlng.lat, e.latlng.lng], { title: 'New offer pickup' }).addTo(donorMap);
        donorPinMarker.bindPopup('Pickup location for new offer').openPopup();
        $('#offerCoords').innerHTML = `📍 Pickup pinned at <strong>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}</strong>`;
      });
      donorNgoLayer = L.layerGroup().addTo(donorMap);
    }
    donorMap.invalidateSize();

    // Drop a "you" marker
    if (state.user.lat && state.user.lng) {
      if (donorMyMarker) donorMap.removeLayer(donorMyMarker);
      donorMyMarker = L.circleMarker([state.user.lat, state.user.lng], {
        radius: 9, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.5, weight: 2
      }).addTo(donorMap).bindPopup('<strong>You are here</strong>');
    }
  }, 60);

  // Fill expiry default to +6h
  if (!$('#expiry').value) {
    const d = new Date(Date.now() + 6 * 3600 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    $('#expiry').value = d.toISOString().slice(0, 16);
  }

  await Promise.all([loadMyOffers(), loadClosestNgos()]);
}

async function loadMyOffers() {
  try {
    const offers = await api('/offers/mine', { auth: true });
    const root = $('#myOffers');
    $('#myOffersCount').textContent = offers.length;
    const totals = { total: offers.length, open: 0, accepted: 0, collected: 0 };
    offers.forEach(o => { if (o.status === 'open') totals.open++; if (o.status === 'accepted') totals.accepted++; if (o.status === 'collected') totals.collected++; });
    $('#dMTotal').textContent = totals.total;
    $('#dMOpen').textContent = totals.open;
    $('#dMAccepted').textContent = totals.accepted;
    $('#dMCollected').textContent = totals.collected;

    if (!offers.length) { root.innerHTML = '<div class="empty">You haven\'t posted any offers yet. Use the form on the right to post your first one.</div>'; return; }

    root.innerHTML = offers.map(o => `
      <div class="offer-card">
        <img src="${esc(o.photo) || 'https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=200&h=200&fit=crop'}" alt="" onerror="this.src='https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=200&h=200&fit=crop'" />
        <div class="body">
          <h4>${esc(o.itemName)} <span class="badge ${o.status}">${o.status}</span></h4>
          <div class="meta">
            <span>🍱 ${o.quantity} portions</span>
            ${o.category ? `<span>· ${esc(o.category)}</span>` : ''}
            ${o.expiry ? `<span>· best before ${new Date(o.expiry).toLocaleString()}</span>` : ''}
          </div>
          <div class="meta" style="margin-top:4px">
            ${o.pickup ? `<span>📍 ${esc(o.pickup)}</span>` : ''}
          </div>
        </div>
        <div class="actions">
          ${o.status === 'open' ? `<button class="btn danger" data-remove="${o.id}">Remove</button>` : ''}
        </div>
      </div>
    `).join('');

    root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Remove this offer? NGOs will no longer see it.')) return;
      try {
        await api('/offers/' + b.dataset.remove, { method: 'DELETE', auth: true });
        toast('Offer removed', 'success');
        await loadMyOffers();
      } catch (err) { toast(err.message, 'error'); }
    }));
  } catch (err) {
    $('#myOffers').innerHTML = `<div class="empty">Couldn't load offers: ${esc(err.message)}</div>`;
  }
}

async function loadClosestNgos() {
  const lat = state.user.lat, lng = state.user.lng;
  const root = $('#closeNgos');
  if (lat == null || lng == null) { root.innerHTML = '<div class="empty">Set your location in your profile to see nearby NGOs.</div>'; return; }
  try {
    const ngos = await api(`/ngos?lat=${lat}&lng=${lng}`);
    if (!ngos.length) { root.innerHTML = '<div class="empty">No NGOs registered yet.</div>'; return; }
    root.innerHTML = ngos.slice(0, 6).map(n => `
      <div class="offer-card" style="padding:12px">
        <div style="width:48px;height:48px;border-radius:10px;background:var(--primary-soft);color:var(--primary);display:grid;place-items:center;font-size:20px;flex-shrink:0">🤝</div>
        <div class="body">
          <h4>${esc(n.name)} ${n.verified ? '<span class="badge open">✓ verified</span>' : ''}</h4>
          <div class="meta">
            ${n.distanceKm != null ? `<span class="badge dist">${n.distanceKm} km away</span>` : ''}
            ${n.contact_phone ? `<span>📞 ${esc(n.contact_phone)}</span>` : ''}
          </div>
          ${n.description ? `<div class="meta" style="margin-top:4px">${esc(n.description)}</div>` : ''}
        </div>
      </div>
    `).join('');

    // Show NGOs on the map too
    donorNgoLayer?.clearLayers();
    ngos.slice(0, 10).forEach(n => {
      if (!n.lat || !n.lng) return;
      const m = L.marker([n.lat, n.lng]).addTo(donorNgoLayer);
      m.bindPopup(`<strong>${esc(n.name)}</strong><div class="small">${n.distanceKm} km away</div><div class="small">${esc(n.contact_phone || '')}</div>`);
    });
  } catch (err) {
    root.innerHTML = `<div class="empty">Couldn't load NGOs: ${esc(err.message)}</div>`;
  }
}

function bindOfferForm() {
  $('#offerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      itemName: $('#itemName').value.trim(),
      quantity: parseInt($('#quantity').value, 10) || 1,
      category: $('#category').value,
      pickup: $('#pickup').value.trim(),
      expiry: $('#expiry').value || null,
      photo: $('#photo').value.trim() || null,
      lat: state.newOfferPin?.lat ?? state.user?.lat ?? null,
      lng: state.newOfferPin?.lng ?? state.user?.lng ?? null,
    };
    if (payload.lat == null) { toast('Click the map to set a pickup location', 'error'); return; }
    try {
      await api('/offers', { method: 'POST', body: payload, auth: true });
      toast('Offer posted — NGOs nearby can see it now', 'success');
      $('#offerForm').reset();
      $('#offerCoords').innerHTML = '📍 Pickup location not set — click the map.';
      if (donorPinMarker) { donorMap.removeLayer(donorPinMarker); donorPinMarker = null; }
      state.newOfferPin = null;
      await loadMyOffers();
    } catch (err) { toast(err.message, 'error'); }
  });
  $('#dashRefresh').addEventListener('click', loadDonorDashboard);
}

// ============ NGO dashboard ============
let ngoMap = null, ngoMyMarker = null, ngoOfferLayer = null;

async function loadNgoDashboard() {
  if (!state.user) return go('login');
  setTimeout(() => {
    if (!ngoMap) {
      ngoMap = L.map('ngoMap', { zoomControl: true }).setView(
        [state.user.lat || DEFAULT_CENTER[0], state.user.lng || DEFAULT_CENTER[1]], 12
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(ngoMap);
      ngoOfferLayer = L.layerGroup().addTo(ngoMap);
    }
    ngoMap.invalidateSize();
    if (state.user.lat && state.user.lng) {
      if (ngoMyMarker) ngoMap.removeLayer(ngoMyMarker);
      ngoMyMarker = L.circleMarker([state.user.lat, state.user.lng], {
        radius: 10, color: '#f97316', fillColor: '#f97316', fillOpacity: 0.5, weight: 2
      }).addTo(ngoMap).bindPopup('<strong>Your NGO base</strong>');
    }
  }, 60);

  await Promise.all([loadOpenOffers(), loadMyClaims()]);
}

async function loadOpenOffers() {
  const lat = state.user.lat, lng = state.user.lng;
  const root = $('#openOffers');
  try {
    const qs = lat != null ? `?status=open&lat=${lat}&lng=${lng}` : '?status=open';
    const offers = await api('/offers' + qs);
    $('#rMOpen').textContent = offers.length;
    $('#openOffersCount').textContent = offers.length;
    $('#rMPortions').textContent = offers.reduce((s, o) => s + (o.quantity || 0), 0);

    if (!offers.length) { root.innerHTML = '<div class="empty">No open donations right now. Check back soon — the map updates live when donors post.</div>'; }
    else {
      root.innerHTML = offers.map(o => `
        <div class="offer-card" data-id="${o.id}">
          <img src="${esc(o.photo) || 'https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=200&h=200&fit=crop'}" onerror="this.src='https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=200&h=200&fit=crop'" />
          <div class="body">
            <h4>${esc(o.itemName)} ${o.distanceKm != null ? `<span class="badge dist">${o.distanceKm} km</span>` : ''}</h4>
            <div class="meta">
              <span>🍱 ${o.quantity} portions</span>
              ${o.category ? `<span>· ${esc(o.category)}</span>` : ''}
              ${o.expiry ? `<span>· best before ${new Date(o.expiry).toLocaleString()}</span>` : ''}
            </div>
            ${o.donor ? `<div class="meta" style="margin-top:4px"><span>👤 ${esc(o.donor.name)}</span>${o.donor.phone ? ` <span>· 📞 ${esc(o.donor.phone)}</span>` : ''}</div>` : ''}
            ${o.pickup ? `<div class="meta" style="margin-top:4px"><span>📍 ${esc(o.pickup)}</span></div>` : ''}
          </div>
          <div class="actions">
            <button class="btn" data-accept="${o.id}">Accept</button>
            <button class="btn ghost" data-locate="${o.id}" data-lat="${o.lat}" data-lng="${o.lng}">View on map</button>
          </div>
        </div>
      `).join('');

      root.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Accept this offer? The donor will be notified to expect your pickup.')) return;
        try {
          await api(`/offers/${b.dataset.accept}/accept`, { method: 'POST', auth: true });
          toast('Offer accepted — contact the donor to arrange pickup', 'success');
          await Promise.all([loadOpenOffers(), loadMyClaims()]);
        } catch (err) { toast(err.message, 'error'); }
      }));
      root.querySelectorAll('[data-locate]').forEach(b => b.addEventListener('click', () => {
        const lat = parseFloat(b.dataset.lat), lng = parseFloat(b.dataset.lng);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) { ngoMap.setView([lat, lng], 15); }
      }));
    }

    // Update map markers
    ngoOfferLayer?.clearLayers();
    offers.forEach(o => {
      if (!o.lat || !o.lng) return;
      const m = L.marker([o.lat, o.lng]).addTo(ngoOfferLayer);
      m.bindPopup(`
        <strong>${esc(o.itemName)}</strong>
        <div class="small">${o.quantity} portions · ${esc(o.category || '')}</div>
        <div class="small">${o.distanceKm != null ? o.distanceKm + ' km away' : ''}</div>
        ${o.donor ? `<div class="small">${esc(o.donor.name)}${o.donor.phone ? ' · ' + esc(o.donor.phone) : ''}</div>` : ''}
        <button onclick="acceptFromPopup(${o.id})">Accept</button>
      `);
    });
  } catch (err) {
    root.innerHTML = `<div class="empty">Couldn't load offers: ${esc(err.message)}</div>`;
  }
}

window.acceptFromPopup = async function(id) {
  try {
    await api(`/offers/${id}/accept`, { method: 'POST', auth: true });
    toast('Offer accepted', 'success');
    await Promise.all([loadOpenOffers(), loadMyClaims()]);
  } catch (err) { toast(err.message, 'error'); }
};

async function loadMyClaims() {
  try {
    const offers = await api('/offers/accepted', { auth: true });
    $('#rMMine').textContent = offers.length;
    const done = offers.filter(o => o.status === 'collected').length;
    $('#rMDone').textContent = done;
    $('#myClaimsCount').textContent = offers.length;
    const root = $('#myClaims');
    if (!offers.length) { root.innerHTML = '<div class="empty">You haven\'t accepted any offers yet.</div>'; return; }
    root.innerHTML = offers.map(o => `
      <div class="offer-card">
        <img src="${esc(o.photo) || 'https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=200&h=200&fit=crop'}" onerror="this.src='https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=200&h=200&fit=crop'" />
        <div class="body">
          <h4>${esc(o.itemName)} <span class="badge ${o.status}">${o.status}</span></h4>
          <div class="meta">
            <span>🍱 ${o.quantity} portions</span>
            ${o.donor ? `<span>· 👤 ${esc(o.donor.name)}</span>` : ''}
            ${o.donor?.phone ? `<span>· 📞 ${esc(o.donor.phone)}</span>` : ''}
          </div>
          ${o.pickup ? `<div class="meta" style="margin-top:4px"><span>📍 ${esc(o.pickup)}</span></div>` : ''}
        </div>
        <div class="actions">
          ${o.status === 'accepted' ? `<button class="btn warn" data-collected="${o.id}">Mark collected</button>` : ''}
        </div>
      </div>
    `).join('');
    root.querySelectorAll('[data-collected]').forEach(b => b.addEventListener('click', async () => {
      try {
        await api(`/offers/${b.dataset.collected}/collected`, { method: 'POST', auth: true });
        toast('Marked as collected — thank you for the pickup!', 'success');
        await loadMyClaims();
      } catch (err) { toast(err.message, 'error'); }
    }));
  } catch (err) {
    $('#myClaims').innerHTML = `<div class="empty">Couldn't load: ${esc(err.message)}</div>`;
  }
}

function bindReceiver() {
  $('#receiverRefresh').addEventListener('click', loadNgoDashboard);
}

// ============ FAQ ============
const FAQS = [
  { q: 'Is MealBridge really free?', a: 'Yes — completely free for both donors and NGOs, with no fees and no hidden charges. The platform is built as a not-for-profit prototype to reduce food waste.' },
  { q: 'Who can sign up as a donor?', a: 'Any restaurant, caterer, grocery store, bakery, school cafeteria, event venue or even an individual household with surplus safe-to-eat food.' },
  { q: 'How do you verify NGOs?', a: 'NGOs are reviewed before being marked verified — we check their registration, ongoing operations, and on-the-ground food distribution work.' },
  { q: 'What kind of food can I donate?', a: 'Anything safe to eat: cooked meals stored properly, sealed packaged food, fresh produce, bakery items. Set an honest "best before" time when you post.' },
  { q: 'How does location matching work?', a: 'When a donor posts an offer, we calculate the straight-line distance from every NGO. NGOs see open offers sorted by distance and can pick whichever fits their route and capacity.' },
  { q: 'Do you handle the actual pickup?', a: 'No — MealBridge is a connector. The NGO arranges its own pickup and transport. We share contact details once an offer is accepted so the two sides can coordinate directly.' },
  { q: 'Is my data safe?', a: 'We only store what we need to make matches: name, email, role, contact info and the location you pin. Data is never sold and accounts can be deleted on request.' },
  { q: 'Can I post anonymously?', a: 'No — for food safety the NGO needs to know who they are picking up from, and donors deserve to know which NGO is collecting from them.' },
];

function renderFaq() {
  const root = $('#faqList');
  if (root.dataset.rendered) return;
  root.innerHTML = FAQS.map(({ q, a }, i) => `
    <div class="faq-item" data-i="${i}">
      <button class="faq-q">${esc(q)}</button>
      <div class="faq-a"><p>${esc(a)}</p></div>
    </div>
  `).join('');
  root.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => item.classList.toggle('open'));
  });
  root.dataset.rendered = '1';
}

// ============ Boot ============
function boot() {
  $('#year').textContent = new Date().getFullYear();
  bindNav();
  bindLogin();
  bindRegister();
  bindOfferForm();
  bindReceiver();
  applyAuthUI();
  refreshMe();
  go('landing');
}
document.addEventListener('DOMContentLoaded', boot);
