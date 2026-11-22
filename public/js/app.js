// ===== ParkEase Pune — Enterprise Mobility Frontend Application =====

// Production API endpoint resolution
const API = (window.location.hostname.includes('aenrox.com') || window.location.hostname.includes('pages.dev'))
  ? 'https://parkease-pune.onrender.com'
  : (window.location.port === '3000' || window.location.port === '10000') ? '' : 'https://parkease-pune.onrender.com';

let currentUser = null;
let token = localStorage.getItem('parkease_token');
let currentPage = 'home';
let currentSpace = null;
let puneMap = null;
let currentSearchView = 'list';
let pendingBooking = null;

// Safe JSON fetch wrapper
async function apiFetch(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API}${url}`;
  try {
    const res = await fetch(fullUrl, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, status: res.status, error: 'Service initializing, please retry momentarily', data: null };
    }
    return { ok: res.ok, status: res.status, data, error: data?.error };
  } catch (err) {
    return { ok: false, status: 0, error: 'Connection error. Please try again.', data: null };
  }
}

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('searchDate');
  if (dateInput) dateInput.value = today;

  if (token) {
    fetchUser();
  }
  updateNav();
  loadAreas();
});

// ==================== AUTH ====================

async function fetchUser() {
  try {
    const res = await apiFetch('/api/me', { headers: authHeaders() });
    if (res.ok && res.data) {
      currentUser = res.data;
      updateNav();
    } else {
      logout();
    }
  } catch (e) {
    console.error('Auth check failed:', e);
  }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function showAuthModal(tab = 'login') {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';
  switchAuthTab(tab);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('tabLogin');
  const tabReg = document.getElementById('tabRegister');
  const title = document.getElementById('authModalTitle');

  if (loginForm) loginForm.style.display = tab === 'login' ? 'block' : 'none';
  if (regForm) regForm.style.display = tab === 'register' ? 'block' : 'none';
  if (tabLogin) tabLogin.classList.toggle('active', tab === 'login');
  if (tabReg) tabReg.classList.toggle('active', tab === 'register');
  if (title) title.textContent = tab === 'login' ? 'Sign In to Account' : 'Create Organization / User Account';
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPass')?.value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';
  }

  try {
    const res = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (res.ok && res.data && res.data.token) {
      token = res.data.token;
      currentUser = res.data.user;
      localStorage.setItem('parkease_token', token);
      closeAuthModal();
      updateNav();
      showToast(`Welcome back, ${currentUser.name}`, 'success');
      navigate('dashboard');
    } else {
      showToast(res.error || 'Invalid authentication credentials', 'error');
    }
  } catch (err) {
    showToast('Connection failed. Please retry.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim();
  const phone = document.getElementById('regPhone')?.value.trim();
  const password = document.getElementById('regPass')?.value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';
  }

  try {
    const res = await apiFetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });

    if (res.ok && res.data && res.data.token) {
      token = res.data.token;
      currentUser = res.data.user;
      localStorage.setItem('parkease_token', token);
      closeAuthModal();
      updateNav();
      showToast(`Account registered for ${currentUser.name}`, 'success');
      navigate('dashboard');
    } else {
      showToast(res.error || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('parkease_token');
  updateNav();
  navigate('home');
  showToast('Signed out successfully', 'success');
}

// ==================== NAVIGATION ====================

function updateNav() {
  const nav = document.getElementById('navLinks');
  if (!nav) return;

  if (currentUser) {
    nav.innerHTML = `
      <a href="#" onclick="navigate('search')" class="${currentPage === 'search' ? 'active' : ''}">Inventory</a>
      <a href="#" onclick="navigate('list-space')" class="${currentPage === 'list-space' ? 'active' : ''}">List Space</a>
      <a href="#" onclick="navigate('dashboard')" class="${currentPage === 'dashboard' ? 'active' : ''}">Dashboard</a>
      <a href="#" onclick="navigate('admin')" class="${currentPage === 'admin' ? 'active' : ''}">Clearing</a>
      <span style="color:var(--slate-300);font-size:12px;margin:0 4px;">|</span>
      <span style="color:var(--slate-700);font-size:13px;font-weight:600;">${currentUser.name}</span>
      <button onclick="logout()" style="color:var(--status-danger-text);font-size:12px;cursor:pointer;">Sign Out</button>
    `;
  } else {
    nav.innerHTML = `
      <a href="#" onclick="navigate('search')" class="${currentPage === 'search' ? 'active' : ''}">Explore Inventory</a>
      <a href="#" onclick="navigate('admin')" class="${currentPage === 'admin' ? 'active' : ''}">Platform Clearing</a>
      <button onclick="showAuthModal('login')" class="btn btn-secondary btn-sm">Sign In</button>
      <button onclick="showAuthModal('register')" class="btn btn-dark btn-sm">Register</button>
    `;
  }
}

function navigate(page, data) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  currentPage = page;

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  updateNav();
  window.scrollTo(0, 0);

  switch(page) {
    case 'search': loadSpaces(); break;
    case 'detail': loadSpaceDetail(data); break;
    case 'dashboard':
      if (!currentUser) { showAuthModal('login'); navigate('home'); return; }
      loadDashboard();
      break;
    case 'list-space':
      if (!currentUser) { showAuthModal('login'); navigate('home'); return; }
      break;
    case 'admin': loadAdmin(); break;
  }
}

// ==================== AREAS ====================

async function loadAreas() {
  try {
    const res = await apiFetch('/api/areas');
    const areas = (res.ok && Array.isArray(res.data)) ? res.data : [];
    if (!areas.length) return;

    const searchArea = document.getElementById('searchArea');
    const filterArea = document.getElementById('filterArea');
    if (searchArea) searchArea.innerHTML = '<option value="">All Locality Hubs</option>';
    if (filterArea) filterArea.innerHTML = '<option value="">All Localities</option>';

    areas.forEach(a => {
      if (searchArea) searchArea.innerHTML += `<option value="${a.area}">${a.area} (${a.space_count} Bays)</option>`;
      if (filterArea) filterArea.innerHTML += `<option value="${a.area}">${a.area}</option>`;
    });

    const grid = document.getElementById('areasGrid');
    if (grid) {
      grid.innerHTML = areas.map(a => `
        <div style="background:var(--white);border:1px solid var(--slate-200);border-radius:var(--radius);padding:18px;cursor:pointer;transition:all 0.15s ease;" onclick="searchByArea('${a.area}')" onmouseover="this.style.borderColor='var(--slate-400)'" onmouseout="this.style.borderColor='var(--slate-200)'">
          <div style="font-size:11px;font-weight:600;color:var(--brand-accent);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Sector</div>
          <div style="font-size:15px;font-weight:700;color:var(--slate-900);">${a.area}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12px;color:var(--slate-500);">
            <span>${a.space_count} Bay${a.space_count > 1 ? 's' : ''} Allocated</span>
            <span class="mono" style="font-weight:600;color:var(--slate-900);">₹${a.min_price}-${a.max_price}/hr</span>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Failed to load areas:', e);
  }
}

function searchByArea(area) {
  const filterArea = document.getElementById('filterArea');
  if (filterArea) filterArea.value = area;
  navigate('search');
}

function searchSpaces() {
  const area = document.getElementById('searchArea')?.value || '';
  const vehicle = document.getElementById('searchVehicle')?.value || '';

  const filterArea = document.getElementById('filterArea');
  const filterVehicle = document.getElementById('filterVehicle');
  if (filterArea) filterArea.value = area;
  if (filterVehicle) filterVehicle.value = vehicle;

  navigate('search');
}

// ==================== SPACES & GEOSPATIAL MAP ====================

function toggleSearchView(view) {
  currentSearchView = view;
  const listBtn = document.getElementById('viewListBtn');
  const mapBtn = document.getElementById('viewMapBtn');
  const mapContainer = document.getElementById('mapContainer');

  if (view === 'map') {
    listBtn?.classList.remove('active');
    mapBtn?.classList.add('active');
    if (mapContainer) mapContainer.style.display = 'block';
    setTimeout(() => {
      if (puneMap) puneMap.invalidateSize();
    }, 200);
  } else {
    mapBtn?.classList.remove('active');
    listBtn?.classList.add('active');
    if (mapContainer) mapContainer.style.display = 'none';
  }
}

function initOrUpdateMap(spaces) {
  if (typeof L === 'undefined') return;
  const mapEl = document.getElementById('puneMap');
  if (!mapEl) return;

  if (!puneMap) {
    puneMap = L.map('puneMap').setView([18.5204, 73.8567], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(puneMap);
  }

  puneMap.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      puneMap.removeLayer(layer);
    }
  });

  const validSpaces = spaces.filter(s => s.lat && s.lng);
  validSpaces.forEach(s => {
    const icon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="background:#0F172A;color:#FFFFFF;font-family:'JetBrains Mono',monospace;font-weight:700;padding:4px 9px;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:11px;white-space:nowrap;border:1px solid #334155;">₹${s.price_per_hour}/hr</div>`,
      iconSize: [60, 26],
      iconAnchor: [30, 13]
    });

    const marker = L.marker([s.lat, s.lng], { icon }).addTo(puneMap);
    marker.bindPopup(`
      <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:6px;">
        <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;">${s.area}</div>
        <div style="font-weight:700;color:#0F172A;font-size:13px;margin:2px 0 4px;">${s.title}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#0F172A;font-size:14px;">₹${s.price_per_hour}/hr <span style="font-size:11px;color:#64748B;font-weight:500;">(${s.vehicle_type === 'car' ? 'Four-Wheeler' : 'Two-Wheeler'})</span></div>
        <button onclick="navigate('detail', ${s.id})" style="margin-top:10px;background:#0F172A;color:white;border:none;padding:6px 12px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;width:100%;">View Bay Details</button>
      </div>
    `);
  });

  if (validSpaces.length > 0 && currentSearchView === 'map') {
    const group = L.featureGroup(validSpaces.map(s => L.marker([s.lat, s.lng])));
    puneMap.fitBounds(group.getBounds().pad(0.15));
  }
}

async function loadSpaces() {
  const area = document.getElementById('filterArea')?.value || '';
  const vehicle = document.getElementById('filterVehicle')?.value || '';

  let url = '/api/spaces?';
  if (area) url += `area=${encodeURIComponent(area)}&`;
  if (vehicle) url += `vehicle_type=${vehicle}&`;

  try {
    const res = await apiFetch(url);
    const spaces = (res.ok && Array.isArray(res.data)) ? res.data : [];

    const resultCountEl = document.getElementById('resultCount');
    if (resultCountEl) {
      resultCountEl.textContent = `${spaces.length} verified parking bays allocated`;
    }

    initOrUpdateMap(spaces);

    const grid = document.getElementById('spacesGrid');
    if (!grid) return;

    if (spaces.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 0;background:white;border:1px solid var(--slate-200);border-radius:var(--radius-md);">
          <div style="font-size:14px;font-weight:600;color:var(--slate-800);">No parking bays found matching query parameters</div>
          <p style="font-size:12px;color:var(--slate-500);margin-top:4px;">Try modifying your sector filter or vehicle classification</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = spaces.map(s => `
      <div class="space-card" onclick="navigate('detail', ${s.id})">
        <div class="space-card-top">
          <div>
            <span class="space-locality-tag">${s.area}</span>
            <div class="rate-display">₹${s.price_per_hour}<small>/hr</small></div>
          </div>
          <span class="type-pill">${s.vehicle_type === 'car' ? 'Four-Wheeler' : 'Two-Wheeler'}</span>
        </div>
        <div class="space-card-body">
          <h3>${s.title}</h3>
          <div class="address">${s.address}</div>
          <div class="meta-row">
            <span>Hours: ${formatTime(s.available_from)} &ndash; ${formatTime(s.available_to)}</span>
            <span>&bull;</span>
            <span>${s.available_days}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--slate-100);">
            <div class="features-list">
              ${s.is_covered ? '<span class="feat-tag">Covered Bay</span>' : ''}
              ${s.has_cctv ? '<span class="feat-tag">CCTV</span>' : ''}
              ${s.has_guard ? '<span class="feat-tag">Security</span>' : ''}
            </div>
            <span style="font-size:11px;font-weight:600;color:var(--slate-600);">
              ${s.avg_rating > 0 ? `Rating: ${s.avg_rating.toFixed(1)}/5` : 'Standard'}
            </span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load spaces:', e);
  }
}

// ==================== SPACE DETAIL ====================

async function loadSpaceDetail(id) {
  try {
    const res = await apiFetch(`/api/spaces/${id}`);
    if (!res.ok || !res.data) {
      showToast('Could not load parking space details', 'error');
      return;
    }
    const space = res.data;
    currentSpace = space;

    const content = document.getElementById('detailContent');
    content.innerHTML = `
      <div style="background:var(--white);border:1px solid var(--slate-200);border-radius:var(--radius-md);padding:32px;">
        <span class="space-locality-tag" style="margin-bottom:8px;">${space.area} SECTOR</span>
        <h1 style="font-size:24px;font-weight:800;color:var(--slate-900);letter-spacing:-0.02em;margin-bottom:6px;">${space.title}</h1>
        <p style="color:var(--slate-500);font-size:14px;margin-bottom:28px;">Address: ${space.address}</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px;">
          <div style="background:var(--slate-50);border:1px solid var(--slate-200);padding:14px 16px;border-radius:var(--radius);">
            <div class="field-label" style="margin:0 0 4px;">Classification</div>
            <div style="font-weight:600;font-size:14px;color:var(--slate-900);">${space.vehicle_type === 'car' ? 'Four-Wheeler (Sedan / SUV)' : 'Two-Wheeler (Bike / EV)'}</div>
          </div>
          <div style="background:var(--slate-50);border:1px solid var(--slate-200);padding:14px 16px;border-radius:var(--radius);">
            <div class="field-label" style="margin:0 0 4px;">Availability Window</div>
            <div style="font-weight:600;font-size:14px;color:var(--slate-900);">${formatTime(space.available_from)} &ndash; ${formatTime(space.available_to)}</div>
          </div>
          <div style="background:var(--slate-50);border:1px solid var(--slate-200);padding:14px 16px;border-radius:var(--radius);">
            <div class="field-label" style="margin:0 0 4px;">Operating Days</div>
            <div style="font-weight:600;font-size:14px;color:var(--slate-900);">${space.available_days}</div>
          </div>
          <div style="background:var(--slate-50);border:1px solid var(--slate-200);padding:14px 16px;border-radius:var(--radius);">
            <div class="field-label" style="margin:0 0 4px;">Sector Landmark</div>
            <div style="font-weight:600;font-size:14px;color:var(--slate-900);">${space.landmark || 'Not Specified'}</div>
          </div>
        </div>

        <h3 style="font-size:13px;font-weight:700;color:var(--slate-900);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Security & Facility Specifications</h3>
        <div class="features-list" style="margin-bottom:28px;">
          <span class="feat-tag" style="padding:6px 12px;font-size:12px;">${space.is_covered ? '✓ Covered Parking Bay' : 'Open Air Space'}</span>
          <span class="feat-tag" style="padding:6px 12px;font-size:12px;">${space.has_cctv ? '✓ 24/7 CCTV Monitored' : 'No CCTV'}</span>
          <span class="feat-tag" style="padding:6px 12px;font-size:12px;">${space.has_guard ? '✓ Gated Security Personnel' : 'Independent Gate'}</span>
        </div>

        ${space.description ? `
          <h3 style="font-size:13px;font-weight:700;color:var(--slate-900);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Bay Description</h3>
          <p style="color:var(--slate-600);font-size:13px;line-height:1.7;margin-bottom:28px;">${space.description}</p>
        ` : ''}

        <h3 style="font-size:13px;font-weight:700;color:var(--slate-900);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">Designated Host Information</h3>
        <div style="display:flex;align-items:center;gap:14px;padding:16px;background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius);margin-bottom:28px;">
          <div style="width:40px;height:40px;background:var(--slate-900);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:white;">${space.owner_name.charAt(0)}</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--slate-900);">${space.owner_name} <span class="badge badge-confirmed" style="font-size:10px;margin-left:6px;">Verified Resident</span></div>
            <div style="font-size:12px;color:var(--slate-500);margin-top:2px;">Contact: ${space.owner_phone}</div>
          </div>
        </div>
      </div>

      <div>
        <div style="background:var(--white);border:1px solid var(--slate-300);border-radius:var(--radius-md);padding:28px;box-shadow:var(--shadow-sm);position:sticky;top:80px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px;">
            <div class="rate-display">₹${space.price_per_hour}<small style="font-size:13px;color:var(--slate-500);">/hour</small></div>
            <span style="font-size:12px;font-weight:600;color:var(--slate-500);">${space.avg_rating > 0 ? `Rating: ${space.avg_rating.toFixed(1)}/5` : 'Standard Tariff'}</span>
          </div>

          <div style="margin-bottom:14px;">
            <label class="field-label">Reservation Date</label>
            <input type="date" id="bookDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" min="${new Date().toISOString().split('T')[0]}">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
              <label class="field-label">Start Window</label>
              <input type="time" id="bookStart" class="form-control" value="${space.available_from}" onchange="updateCost()">
            </div>
            <div>
              <label class="field-label">End Window</label>
              <input type="time" id="bookEnd" class="form-control" value="${space.available_to}" onchange="updateCost()">
            </div>
          </div>
          <div style="margin-bottom:18px;">
            <label class="field-label">Vehicle Registration Number</label>
            <input type="text" id="bookVehicle" class="form-control mono" placeholder="MH12AB1234" style="text-transform:uppercase;letter-spacing:0.05em;">
          </div>

          <div style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius);padding:16px;margin-bottom:20px;" id="costBreakdown">
            <!-- Dynamic cost summary -->
          </div>

          <button class="btn btn-dark btn-lg" style="width:100%;font-size:14px;" onclick="confirmBooking()">
            Reserve Space & Generate Security Pass
          </button>
          <div style="text-align:center;font-size:11px;color:var(--slate-400);margin-top:10px;">
            Instant Gate Authorization Issued via QR Protocol
          </div>
        </div>
      </div>
    `;

    updateCost();
  } catch (e) {
    console.error('Failed to load space:', e);
  }
}

function updateCost() {
  if (!currentSpace) return;
  const start = document.getElementById('bookStart')?.value;
  const end = document.getElementById('bookEnd')?.value;
  if (!start || !end) return;

  const startDate = new Date(`2026-01-01T${start}`);
  const endDate = new Date(`2026-01-01T${end}`);
  const hours = Math.max(0, (endDate - startDate) / (1000 * 60 * 60));
  const total = Math.round(hours * currentSpace.price_per_hour);
  const commission = Math.round(total * 0.15);
  const ownerPayout = total - commission;

  const breakdown = document.getElementById('costBreakdown');
  if (breakdown) {
    breakdown.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--slate-600);margin-bottom:6px;">
        <span>Tariff (${hours} hrs &times; ₹${currentSpace.price_per_hour})</span>
        <span class="mono">₹${total}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--slate-500);margin-bottom:6px;">
        <span>Platform Settlement (15%)</span>
        <span class="mono">₹${commission}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--slate-500);margin-bottom:10px;">
        <span>Net Host Clearing</span>
        <span class="mono">₹${ownerPayout}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:var(--slate-900);padding-top:8px;border-top:1px solid var(--slate-300);">
        <span>Total Payable</span>
        <span class="mono" style="color:var(--brand-accent);">₹${total}</span>
      </div>
    `;
  }
}

async function confirmBooking() {
  if (!currentUser) {
    showAuthModal('login');
    return;
  }

  const vehicleNum = document.getElementById('bookVehicle')?.value?.trim()?.toUpperCase();
  if (!vehicleNum) {
    showToast('Please provide your vehicle license registration number', 'error');
    return;
  }

  const start = document.getElementById('bookStart')?.value;
  const end = document.getElementById('bookEnd')?.value;
  const startDate = new Date(`2026-01-01T${start}`);
  const endDate = new Date(`2026-01-01T${end}`);
  const hours = Math.max(0, (endDate - startDate) / (1000 * 60 * 60));
  const total = Math.round(hours * currentSpace.price_per_hour);
  const commission = Math.round(total * 0.15);
  const ownerPayout = total - commission;

  pendingBooking = {
    space_id: currentSpace.id,
    booking_date: document.getElementById('bookDate').value,
    start_time: start,
    end_time: end,
    vehicle_number: vehicleNum,
    hours,
    total_amount: total,
    commission,
    owner_payout: ownerPayout,
    spaceTitle: currentSpace.title,
    spaceAddress: currentSpace.address,
    spaceArea: currentSpace.area,
    ownerName: currentSpace.owner_name
  };

  openPaymentModal();
}

function openPaymentModal() {
  const b = pendingBooking;
  if (!b) return;

  const modal = document.getElementById('paymentModal');
  const body = document.getElementById('paymentModalBody');

  body.innerHTML = `
    <div style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius);padding:16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-weight:700;color:var(--slate-900);font-size:14px;">${b.spaceTitle}</span>
        <span class="badge badge-completed">${b.spaceArea}</span>
      </div>
      <div style="font-size:12px;color:var(--slate-500);margin-bottom:4px;">Date: ${b.booking_date} &bull; ${formatTime(b.start_time)} &ndash; ${formatTime(b.end_time)} (${b.hours} hrs)</div>
      <div style="font-size:12px;color:var(--slate-700);">License Plate: <strong class="mono">${b.vehicle_number}</strong></div>
    </div>

    <div style="border:1px solid var(--slate-200);border-radius:var(--radius);padding:16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;color:var(--slate-600);">
        <span>Reservation Fee</span>
        <span class="mono">₹${b.total_amount}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:11px;color:var(--slate-500);">
        <span>Platform Commission (15% inclusive)</span>
        <span class="mono">₹${b.commission}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px dashed var(--slate-300);font-weight:800;font-size:16px;color:var(--slate-900);">
        <span>Total Payable (INR)</span>
        <span class="mono" style="color:var(--brand-accent);">₹${b.total_amount}</span>
      </div>
    </div>

    <div style="font-size:12px;font-weight:600;color:var(--slate-700);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Select Settlement Method</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
      <button type="button" class="btn btn-secondary active" style="padding:10px;font-size:12px;" onclick="selectPaymentMethod(this, 'upi')">
        UPI / Mobile Clearing
      </button>
      <button type="button" class="btn btn-secondary" style="padding:10px;font-size:12px;" onclick="selectPaymentMethod(this, 'card')">
        Corporate Card
      </button>
    </div>

    <div id="upiPaySection" style="margin-bottom:20px;">
      <label class="field-label">Virtual Payment Address (VPA / UPI ID)</label>
      <input type="text" id="upiIdInput" class="form-control mono" value="${currentUser ? currentUser.phone + '@upi' : 'user@okhdfcbank'}" placeholder="mobile@upi">
    </div>

    <button class="btn btn-dark btn-lg" style="width:100%;font-size:14px;" onclick="processPaymentAndBook()">
      Authorize ₹${b.total_amount} & Issue Gate Pass
    </button>
  `;

  modal.style.display = 'flex';
}

function selectPaymentMethod(btn, method) {
  btn.parentElement.querySelectorAll('button').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');

  const upiSec = document.getElementById('upiPaySection');
  if (upiSec) {
    if (method === 'upi') {
      upiSec.innerHTML = `
        <label class="field-label">Virtual Payment Address (VPA / UPI ID)</label>
        <input type="text" id="upiIdInput" class="form-control mono" value="${currentUser ? currentUser.phone + '@upi' : 'user@okhdfcbank'}">
      `;
    } else {
      upiSec.innerHTML = `
        <div style="margin-bottom:10px;">
          <label class="field-label">Card Number</label>
          <input type="text" class="form-control mono" placeholder="4532 •••• •••• 8892" value="4532 9012 3456 8892">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><label class="field-label">Expiry (MM/YY)</label><input type="text" class="form-control mono" value="08/29"></div>
          <div><label class="field-label">CVV</label><input type="password" class="form-control mono" value="892"></div>
        </div>
      `;
    }
  }
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
}

async function processPaymentAndBook() {
  if (!pendingBooking) return;

  const btn = event?.currentTarget;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Clearing settlement...';
  }

  try {
    const res = await apiFetch('/api/bookings', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        space_id: pendingBooking.space_id,
        booking_date: pendingBooking.booking_date,
        start_time: pendingBooking.start_time,
        end_time: pendingBooking.end_time,
        vehicle_number: pendingBooking.vehicle_number
      })
    });
    if (res.ok && res.data) {
      const data = res.data;
      closePaymentModal();
      showToast(`Settlement cleared: ₹${data.total_amount}. Security pass issued.`, 'success');
      showGatePass({
        id: data.id,
        space_title: pendingBooking.spaceTitle,
        address: pendingBooking.spaceAddress,
        area: pendingBooking.spaceArea,
        vehicle_number: pendingBooking.vehicle_number,
        booking_date: pendingBooking.booking_date,
        start_time: pendingBooking.start_time,
        end_time: pendingBooking.end_time,
        owner_name: pendingBooking.ownerName,
        total_amount: data.total_amount
      });
    } else {
      showToast(res.error || 'Booking failed', 'error');
    }
  } catch (e) {
    showToast('Connection error', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Authorize & Issue Pass';
    }
  }
}

// ==================== CORPORATE SECURITY GATE PASS ====================

function showGatePass(booking) {
  const modal = document.getElementById('gatePassModal');
  const body = document.getElementById('gatePassModalBody');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=PARKEASE-SECURE-ACCESS-${booking.id}-${booking.vehicle_number}`;

  body.innerHTML = `
    <div class="access-badge-container">
      <div class="access-badge-header">
        <div class="access-badge-title">Housing Society Entry Authorization</div>
        <span class="badge badge-confirmed">Gate Verified</span>
      </div>

      <div style="text-align:center;">
        <div style="font-size:16px;font-weight:700;color:var(--slate-900);margin-bottom:4px;">${booking.space_title || booking.title}</div>
        <div style="font-size:12px;color:var(--slate-500);margin-bottom:14px;">${booking.address || booking.area}</div>

        <div class="access-pass-qr">
          <img src="${qrUrl}" alt="Security Scan QR" style="width:130px;height:130px;display:block;">
        </div>

        <div style="font-size:10px;font-weight:600;color:var(--slate-400);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Authorized Vehicle License</div>
        <div class="access-plate">${booking.vehicle_number}</div>

        <div class="access-grid-spec">
          <div><div class="lbl">Permit Date</div><div class="val">${booking.booking_date}</div></div>
          <div><div class="lbl">Authorized Hours</div><div class="val">${formatTime(booking.start_time)} &ndash; ${formatTime(booking.end_time)}</div></div>
          <div><div class="lbl">Resident / Bay Allocator</div><div class="val">${booking.owner_name}</div></div>
          <div><div class="lbl">Security Token</div><div class="val mono">AUTH-PK-${1000 + Number(booking.id)}</div></div>
        </div>

        <div style="font-size:11px;color:var(--slate-500);line-height:1.5;margin-bottom:20px;">
          Present this verified pass upon arrival at the housing society entrance barrier. Security personnel can scan the token for bay allocation access.
        </div>

        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="window.print()">Print Official Pass</button>
          <button class="btn btn-dark btn-sm" style="flex:1;" onclick="closeGatePassModal(); navigate('dashboard');">Close</button>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeGatePassModal() {
  document.getElementById('gatePassModal').style.display = 'none';
}

// ==================== LIST SPACE ====================

async function submitSpace(e) {
  e.preventDefault();
  if (!currentUser) { showAuthModal('login'); return; }

  const days = Array.from(document.querySelectorAll('#spDays input:checked')).map(c => c.value).join(',');

  const space = {
    title: document.getElementById('spTitle').value,
    area: document.getElementById('spArea').value,
    landmark: document.getElementById('spLandmark').value,
    address: document.getElementById('spAddress').value,
    vehicle_type: document.getElementById('spVehicle').value,
    price_per_hour: Number(document.getElementById('spPrice').value),
    available_from: document.getElementById('spFrom').value,
    available_to: document.getElementById('spTo').value,
    available_days: days,
    description: document.getElementById('spDesc')?.value || '',
    is_covered: document.getElementById('spCovered').checked,
    has_cctv: document.getElementById('spCCTV').checked,
    has_guard: document.getElementById('spGuard').checked
  };

  try {
    const res = await apiFetch('/api/spaces', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(space)
    });
    if (res.ok) {
      showToast('Parking bay registered and listed on inventory', 'success');
      document.getElementById('listSpaceForm').reset();
      navigate('dashboard');
    } else {
      showToast(res.error || 'Failed to list asset', 'error');
    }
  } catch (e) {
    showToast('Connection error', 'error');
  }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
  try {
    const [dashRes, bookingsRes, spaceBookingsRes, spacesRes] = await Promise.all([
      apiFetch('/api/dashboard', { headers: authHeaders() }),
      apiFetch('/api/my-bookings', { headers: authHeaders() }),
      apiFetch('/api/space-bookings', { headers: authHeaders() }),
      apiFetch('/api/my-spaces', { headers: authHeaders() })
    ]);

    const dash = dashRes.ok && dashRes.data ? dashRes.data : {};
    const bookings = bookingsRes.ok && Array.isArray(bookingsRes.data) ? bookingsRes.data : [];
    const spaceBookings = spaceBookingsRes.ok && Array.isArray(spaceBookingsRes.data) ? spaceBookingsRes.data : [];
    const spaces = spacesRes.ok && Array.isArray(spacesRes.data) ? spacesRes.data : [];

    // Executive KPI Metrics
    document.getElementById('dashStats').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Registered Private Bays</div>
        <div class="stat-value">${dash.spaceCount}</div>
        <div class="stat-footer">Active real estate inventory</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net Host Clearing</div>
        <div class="stat-value mono">₹${dash.ownerStats?.total_earnings || 0}</div>
        <div class="stat-footer">Cleared after 15% platform fee</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Host Bookings</div>
        <div class="stat-value">${dash.ownerStats?.active_bookings || 0}</div>
        <div class="stat-footer">Current day bay occupancy</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Renter Bookings</div>
        <div class="stat-value">${dash.renterStats?.total_bookings || 0}</div>
        <div class="stat-footer">Cumulative commuter reservations</div>
      </div>
    `;

    window._dashData = { bookings, spaceBookings, spaces };
    renderDashTab('my-bookings');
  } catch (e) {
    console.error('Failed to load dashboard:', e);
  }
}

function switchDashTab(tab, btn) {
  document.querySelectorAll('.tabs-header .tab-btn').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDashTab(tab);
}

function renderDashTab(tab) {
  const content = document.getElementById('dashContent');

  if (tab === 'my-bookings') {
    const bookings = window._dashData?.bookings || [];
    if (bookings.length === 0) {
      content.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--slate-400);"><p>No reservation history recorded.</p><button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="navigate('search')">Explore Available Bays</button></div>`;
      return;
    }
    content.innerHTML = bookings.map(b => `
      <div class="ledger-item">
        <div class="ledger-main">
          <h4>${b.title}</h4>
          <div class="sub">Sector: ${b.area} &bull; Vehicle: <span class="mono" style="font-weight:600;color:var(--slate-800);">${b.vehicle_number || 'N/A'}</span></div>
          <div class="sub" style="margin-top:2px;">Scheduled: ${b.booking_date} (${formatTime(b.start_time)} &ndash; ${formatTime(b.end_time)}, ${b.hours} hrs) &bull; Host: ${b.owner_name} (${b.owner_phone})</div>
        </div>
        <div style="text-align:right;">
          <div class="ledger-amount">₹${b.total_amount}</div>
          <span class="badge badge-${b.status}">${b.status}</span>
          ${b.status === 'confirmed' ? `
            <div style="margin-top:10px;display:flex;gap:6px;justify-content:flex-end;">
              <button class="btn btn-dark btn-sm" onclick='showGatePass(${JSON.stringify(b).replace(/'/g, "&apos;")})'>Access Pass</button>
              <button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">Cancel</button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  if (tab === 'space-bookings') {
    const bookings = window._dashData?.spaceBookings || [];
    if (bookings.length === 0) {
      content.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--slate-400);"><p>No incoming reservation activity recorded on your spaces.</p></div>`;
      return;
    }
    content.innerHTML = bookings.map(b => `
      <div class="ledger-item">
        <div class="ledger-main">
          <h4>${b.title}</h4>
          <div class="sub">Commuter: ${b.renter_name} &bull; Phone: ${b.renter_phone}</div>
          <div class="sub" style="margin-top:2px;">Date: ${b.booking_date} (${formatTime(b.start_time)} &ndash; ${formatTime(b.end_time)}, ${b.hours} hrs)</div>
        </div>
        <div style="text-align:right;">
          <div class="ledger-amount" style="color:var(--status-success-text);">+₹${b.owner_payout}</div>
          <div style="font-size:11px;color:var(--slate-400);">Fee: ₹${b.commission}</div>
          <span class="badge badge-${b.status}">${b.status}</span>
        </div>
      </div>
    `).join('');
  }

  if (tab === 'my-spaces') {
    const spaces = window._dashData?.spaces || [];
    if (spaces.length === 0) {
      content.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--slate-400);"><p>No parking spaces registered yet.</p><button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="navigate('list-space')">Register a Bay</button></div>`;
      return;
    }
    content.innerHTML = `<div class="card-grid">${spaces.map(s => `
      <div class="space-card" style="padding:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <span class="space-locality-tag">${s.area}</span>
          <span class="badge ${s.is_active ? 'badge-confirmed' : 'badge-cancelled'}">${s.is_active ? 'Active Bay' : 'Suspended'}</span>
        </div>
        <h3 style="font-size:15px;font-weight:700;margin-bottom:4px;">${s.title}</h3>
        <p style="font-size:12px;color:var(--slate-500);margin-bottom:14px;">${s.address}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--slate-100);">
          <span class="mono" style="font-size:18px;font-weight:700;color:var(--slate-900);">₹${s.price_per_hour}/hr</span>
          <span style="font-size:12px;color:var(--slate-500);">${s.total_bookings} Bookings Cleared</span>
        </div>
        <button class="btn ${s.is_active ? 'btn-secondary' : 'btn-dark'} btn-sm" style="width:100%;margin-top:14px;" onclick="toggleSpace(${s.id})">
          ${s.is_active ? 'Suspend Availability' : 'Activate Space'}
        </button>
      </div>
    `).join('')}</div>`;
  }
}

async function cancelBooking(id) {
  if (!confirm('Cancel this reservation?')) return;
  try {
    const res = await apiFetch(`/api/bookings/${id}/cancel`, {
      method: 'PUT',
      headers: authHeaders()
    });
    if (res.ok) {
      showToast('Reservation cancelled', 'success');
      loadDashboard();
    } else {
      showToast(res.error || 'Failed to cancel', 'error');
    }
  } catch (e) {
    showToast('Failed to cancel', 'error');
  }
}

async function toggleSpace(id) {
  try {
    const res = await apiFetch(`/api/spaces/${id}/toggle`, {
      method: 'PUT',
      headers: authHeaders()
    });
    if (res.ok && res.data) {
      showToast(res.data.message || 'Status updated', 'success');
      loadDashboard();
    } else {
      showToast(res.error || 'Failed to update', 'error');
    }
  } catch (e) {
    showToast('Failed to update', 'error');
  }
}

// ==================== PLATFORM CLEARING & ADMIN ====================

async function loadAdmin() {
  try {
    const res = await apiFetch('/api/admin/analytics');
    if (!res.ok || !res.data) return;
    const data = res.data;

    document.getElementById('adminStats').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Registered Accounts</div>
        <div class="stat-value">${data.totalUsers}</div>
        <div class="stat-footer">Verified users & hosts</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Space Inventory</div>
        <div class="stat-value">${data.totalSpaces}</div>
        <div class="stat-footer">Allocated parking bays</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Gross Merchandise Volume (GMV)</div>
        <div class="stat-value mono">₹${data.revenue?.total_revenue || 0}</div>
        <div class="stat-footer">Total platform volume</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Platform Yield (15% Commission)</div>
        <div class="stat-value mono" style="color:var(--brand-accent);">₹${data.revenue?.total_commission || 0}</div>
        <div class="stat-footer">Net platform revenue</div>
      </div>
    `;

    const maxRevenue = Math.max(...data.areaBreakdown.map(a => a.revenue || 0), 1);
    const areaEl = document.getElementById('areaAnalytics');
    if (areaEl) {
      areaEl.innerHTML = `
        <h3 style="font-size:15px;font-weight:700;color:var(--slate-900);margin-bottom:14px;">Sector Gross Revenue Distribution</h3>
        <div style="background:var(--white);border:1px solid var(--slate-200);border-radius:var(--radius-md);padding:20px;">
          ${data.areaBreakdown.map(a => `
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
              <span style="width:140px;font-size:13px;font-weight:600;color:var(--slate-700);">${a.area}</span>
              <div style="flex:1;height:24px;background:var(--slate-100);border-radius:4px;overflow:hidden;">
                <div style="height:100%;background:var(--slate-900);border-radius:4px;display:flex;align-items:center;padding-left:10px;font-size:11px;font-weight:600;color:white;width:${((a.revenue || 0) / maxRevenue * 100)}%;">
                  ₹${a.revenue || 0}
                </div>
              </div>
              <span style="font-size:12px;color:var(--slate-500);width:90px;text-align:right;">${a.bookings} txs</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    const tbody = document.querySelector('#adminBookings tbody');
    if (tbody) {
      tbody.innerHTML = data.recentBookings.map(b => `
        <tr>
          <td class="mono" style="font-size:12px;font-weight:600;">#TX-${1000 + b.id}</td>
          <td>${b.title} <span style="font-size:11px;color:var(--slate-400);">(${b.area})</span></td>
          <td>${b.renter_name}</td>
          <td>${b.owner_name}</td>
          <td>${b.booking_date}</td>
          <td>${b.hours} hrs</td>
          <td class="mono" style="font-weight:600;">₹${b.total_amount}</td>
          <td class="mono" style="color:var(--brand-accent);font-weight:600;">₹${b.commission}</td>
          <td><span class="badge badge-${b.status}">${b.status}</span></td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error('Failed to load admin:', e);
  }
}

// ==================== HELPERS ====================

function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function closeModal(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.style.display = 'none';
  }
}

function showToast(message, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
