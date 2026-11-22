// ===== ParkEase Pune - Frontend Application =====

const API = '';
let currentUser = null;
let token = localStorage.getItem('parkease_token');
let currentPage = 'home';
let currentSpace = null;
let puneMap = null;
let currentSearchView = 'list';
let pendingBooking = null;

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', () => {
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('searchDate').value = today;

  if (token) {
    fetchUser();
  }
  updateNav();
  loadAreas();
});

// ==================== AUTH ====================

async function fetchUser() {
  try {
    const res = await fetch(`${API}/api/me`, { headers: authHeaders() });
    if (res.ok) {
      currentUser = await res.json();
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
  document.getElementById('authModal').style.display = 'flex';
  switchAuthTab(tab);
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('authModalTitle').textContent = tab === 'login' ? 'Welcome Back' : 'Create Account';
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPass').value;

  try {
    const res = await fetch(`${API}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('parkease_token', token);
      closeAuthModal();
      updateNav();
      showToast(`Welcome back, ${currentUser.name}! 👋`, 'success');
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (e) {
    showToast('Connection error', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const phone = document.getElementById('regPhone').value;
  const password = document.getElementById('regPass').value;

  try {
    const res = await fetch(`${API}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('parkease_token', token);
      closeAuthModal();
      updateNav();
      showToast(`Welcome to ParkEase, ${currentUser.name}! 🎉`, 'success');
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (e) {
    showToast('Connection error', 'error');
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('parkease_token');
  updateNav();
  navigate('home');
  showToast('Logged out successfully', 'success');
}

// ==================== NAVIGATION ====================

function updateNav() {
  const nav = document.getElementById('navLinks');
  if (currentUser) {
    nav.innerHTML = `
      <a href="#" onclick="navigate('search')" class="${currentPage === 'search' ? 'active' : ''}">🔍 Find</a>
      <a href="#" onclick="navigate('list-space')" class="${currentPage === 'list-space' ? 'active' : ''}">➕ List Spot</a>
      <a href="#" onclick="navigate('dashboard')" class="${currentPage === 'dashboard' ? 'active' : ''}">📊 Dashboard</a>
      <a href="#" onclick="navigate('admin')" class="${currentPage === 'admin' ? 'active' : ''}">⚙️ Admin</a>
      <span style="color:var(--gray-400);font-size:13px;">Hi, ${currentUser.name.split(' ')[0]}</span>
      <button onclick="logout()" style="color:var(--danger)">Logout</button>
    `;
  } else {
    nav.innerHTML = `
      <a href="#" onclick="navigate('search')">🔍 Find Parking</a>
      <a href="#" onclick="navigate('admin')">📊 Admin</a>
      <button onclick="showAuthModal('login')" class="btn btn-secondary btn-sm">Login</button>
      <button onclick="showAuthModal('register')" class="btn btn-primary btn-sm">Sign Up</button>
    `;
  }
}

function navigate(page, data) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  currentPage = page;

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  updateNav();
  window.scrollTo(0, 0);

  // Load page data
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
    const res = await fetch(`${API}/api/areas`);
    const areas = await res.json();

    // Populate search dropdown
    const searchArea = document.getElementById('searchArea');
    const filterArea = document.getElementById('filterArea');
    areas.forEach(a => {
      searchArea.innerHTML += `<option value="${a.area}">${a.area} (${a.space_count})</option>`;
      filterArea.innerHTML += `<option value="${a.area}">${a.area}</option>`;
    });

    // Populate areas grid
    const grid = document.getElementById('areasGrid');
    grid.innerHTML = areas.map(a => `
      <div class="area-card" onclick="searchByArea('${a.area}')">
        <h4>📍 ${a.area}</h4>
        <p>${a.space_count} spot${a.space_count > 1 ? 's' : ''} available</p>
        <div class="price-range">₹${a.min_price} - ₹${a.max_price}/hr</div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load areas:', e);
  }
}

function searchByArea(area) {
  document.getElementById('filterArea').value = area;
  navigate('search');
}

function searchSpaces() {
  const area = document.getElementById('searchArea').value;
  const vehicle = document.getElementById('searchVehicle').value;
  const maxPrice = document.getElementById('searchMaxPrice').value;

  document.getElementById('filterArea').value = area;
  document.getElementById('filterVehicle').value = vehicle;

  navigate('search');
}

// ==================== SPACES & MAP ====================

function toggleSearchView(view) {
  currentSearchView = view;
  const listBtn = document.getElementById('viewListBtn');
  const mapBtn = document.getElementById('viewMapBtn');
  const mapContainer = document.getElementById('mapContainer');
  const spacesGrid = document.getElementById('spacesGrid');

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

  // Clear existing markers
  puneMap.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      puneMap.removeLayer(layer);
    }
  });

  const validSpaces = spaces.filter(s => s.lat && s.lng);
  validSpaces.forEach(s => {
    const icon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="background:#6C3CE1;color:white;font-weight:700;padding:6px 10px;border-radius:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:12px;white-space:nowrap;border:2px solid white;">₹${s.price_per_hour}/hr</div>`,
      iconSize: [60, 30],
      iconAnchor: [30, 15]
    });

    const marker = L.marker([s.lat, s.lng], { icon }).addTo(puneMap);
    marker.bindPopup(`
      <div style="font-family:sans-serif;padding:4px;">
        <strong style="color:#1E1B4B;font-size:14px;">${s.title}</strong><br>
        <span style="color:#6C3CE1;font-weight:700;font-size:15px;">₹${s.price_per_hour}/hr</span> · <span>${s.vehicle_type === 'car' ? '🚗 Car' : '🏍️ Bike'}</span><br>
        <small style="color:#6B7280;">📍 ${s.area} (${s.address})</small><br>
        <button onclick="navigate('detail', ${s.id})" style="margin-top:8px;background:#6C3CE1;color:white;border:none;padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;">View & Book</button>
      </div>
    `);
  });

  if (validSpaces.length > 0 && currentSearchView === 'map') {
    const group = L.featureGroup(validSpaces.map(s => L.marker([s.lat, s.lng])));
    puneMap.fitBounds(group.getBounds().pad(0.15));
  }
}

async function loadSpaces() {
  const area = document.getElementById('filterArea').value;
  const vehicle = document.getElementById('filterVehicle').value;

  let url = `${API}/api/spaces?`;
  if (area) url += `area=${encodeURIComponent(area)}&`;
  if (vehicle) url += `vehicle_type=${vehicle}&`;

  try {
    const res = await fetch(url);
    const spaces = await res.json();

    document.getElementById('resultCount').textContent = `${spaces.length} parking spot${spaces.length !== 1 ? 's' : ''} found`;

    initOrUpdateMap(spaces);

    const grid = document.getElementById('spacesGrid');
    if (spaces.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <div class="icon">🅿️</div>
          <h3>No parking spots found</h3>
          <p>Try adjusting your filters or search in a different area</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = spaces.map(s => `
      <div class="card space-card" onclick="navigate('detail', ${s.id})">
        <div class="space-card-header">
          <span class="vehicle-badge">${s.vehicle_type === 'car' ? '🚗 Car' : '🏍️ Bike'}</span>
          <div class="price">₹${s.price_per_hour}<small>/hr</small></div>
          <div style="font-size:13px;color:var(--gray-600);margin-top:4px;">
            ≈ ₹${Math.round(s.price_per_hour * 8 * 0.85)} owner earnings for 8hrs
          </div>
        </div>
        <div class="space-card-body">
          <span class="area-tag">📍 ${s.area}</span>
          <h3>${s.title}</h3>
          <div class="location">📌 ${s.address}</div>
          <div class="time-info">🕐 ${formatTime(s.available_from)} - ${formatTime(s.available_to)} · ${s.available_days}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
            <div class="space-features">
              ${s.is_covered ? '<span class="feature-badge active">🏠 Covered</span>' : ''}
              ${s.has_cctv ? '<span class="feature-badge active">📹 CCTV</span>' : ''}
              ${s.has_guard ? '<span class="feature-badge active">👮 Guard</span>' : ''}
            </div>
            <div class="rating-stars">
              ${s.avg_rating > 0 ? `${'⭐'.repeat(Math.round(s.avg_rating))} <span class="count">(${s.review_count})</span>` : '<span class="count">New</span>'}
            </div>
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
    const res = await fetch(`${API}/api/spaces/${id}`);
    const space = await res.json();
    currentSpace = space;

    const content = document.getElementById('detailContent');
    content.innerHTML = `
      <div class="detail-main">
        <span class="area-tag" style="margin-bottom:12px;">📍 ${space.area}</span>
        <h1 style="font-size:28px;font-weight:800;color:var(--gray-900);margin-bottom:8px;">${space.title}</h1>
        <p style="color:var(--gray-500);font-size:15px;margin-bottom:24px;">📌 ${space.address}</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
          <div style="background:var(--gray-50);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:var(--gray-500);font-weight:600;text-transform:uppercase;">Vehicle Type</div>
            <div style="font-size:16px;font-weight:600;margin-top:4px;">${space.vehicle_type === 'car' ? '🚗 Car' : '🏍️ Bike / Scooter'}</div>
          </div>
          <div style="background:var(--gray-50);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:var(--gray-500);font-weight:600;text-transform:uppercase;">Available Time</div>
            <div style="font-size:16px;font-weight:600;margin-top:4px;">🕐 ${formatTime(space.available_from)} - ${formatTime(space.available_to)}</div>
          </div>
          <div style="background:var(--gray-50);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:var(--gray-500);font-weight:600;text-transform:uppercase;">Available Days</div>
            <div style="font-size:16px;font-weight:600;margin-top:4px;">📅 ${space.available_days}</div>
          </div>
          <div style="background:var(--gray-50);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:var(--gray-500);font-weight:600;text-transform:uppercase;">Landmark</div>
            <div style="font-size:16px;font-weight:600;margin-top:4px;">🏛️ ${space.landmark || 'N/A'}</div>
          </div>
        </div>

        <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">Amenities</h3>
        <div class="space-features" style="margin-bottom:24px;">
          <span class="feature-badge ${space.is_covered ? 'active' : ''}">${space.is_covered ? '✅' : '❌'} Covered Parking</span>
          <span class="feature-badge ${space.has_cctv ? 'active' : ''}">${space.has_cctv ? '✅' : '❌'} CCTV Surveillance</span>
          <span class="feature-badge ${space.has_guard ? 'active' : ''}">${space.has_guard ? '✅' : '❌'} Security Guard</span>
        </div>

        ${space.description ? `
          <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">About this Spot</h3>
          <p style="color:var(--gray-600);font-size:14px;line-height:1.7;margin-bottom:24px;">${space.description}</p>
        ` : ''}

        <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">Owner</h3>
        <div style="display:flex;align-items:center;gap:12px;padding:16px;background:var(--gray-50);border-radius:12px;margin-bottom:24px;">
          <div style="width:44px;height:44px;background:var(--primary-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--primary);">${space.owner_name.charAt(0)}</div>
          <div>
            <div style="font-weight:600;font-size:15px;">${space.owner_name}</div>
            <div style="font-size:13px;color:var(--gray-500);">📞 ${space.owner_phone}</div>
          </div>
        </div>

        ${space.reviews && space.reviews.length > 0 ? `
          <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">Reviews (${space.review_count})</h3>
          ${space.reviews.map(r => `
            <div class="review-item">
              <div class="review-header">
                <span class="name">${r.reviewer_name}</span>
                <span class="rating-stars">${'⭐'.repeat(r.rating)}</span>
              </div>
              <p class="review-comment">${r.comment || ''}</p>
            </div>
          `).join('')}
        ` : ''}
      </div>

      <div class="detail-sidebar">
        <div class="booking-card">
          <div class="price-display">₹${space.price_per_hour}<small>/hour</small></div>
          <div class="rating-stars" style="margin-bottom:20px;">
            ${space.avg_rating > 0 ? `${'⭐'.repeat(Math.round(space.avg_rating))} <span class="count">(${space.review_count} reviews)</span>` : '<span class="count">No reviews yet</span>'}
          </div>

          <div class="form-group">
            <label>Date</label>
            <input type="date" id="bookDate" value="${new Date().toISOString().split('T')[0]}" min="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Start Time</label>
              <input type="time" id="bookStart" value="${space.available_from}" onchange="updateCost()">
            </div>
            <div class="form-group">
              <label>End Time</label>
              <input type="time" id="bookEnd" value="${space.available_to}" onchange="updateCost()">
            </div>
          </div>
          <div class="form-group">
            <label>Vehicle Number</label>
            <input type="text" id="bookVehicle" placeholder="MH12XX1234" style="text-transform:uppercase;">
          </div>

          <div class="cost-breakdown" id="costBreakdown">
            <!-- Dynamic -->
          </div>

          <button class="btn btn-primary btn-lg" style="width:100%;margin-top:12px;" onclick="confirmBooking()">
            🅿️ Book Now
          </button>
          <p style="text-align:center;font-size:12px;color:var(--gray-400);margin-top:8px;">You won't be charged yet</p>
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
      <div class="cost-row"><span>₹${currentSpace.price_per_hour} × ${hours} hours</span><span>₹${total}</span></div>
      <div class="cost-row"><span>Platform fee (15%)</span><span>₹${commission}</span></div>
      <div class="cost-row"><span>Owner receives</span><span>₹${ownerPayout}</span></div>
      <div class="cost-row"><span><strong>Total</strong></span><span><strong>₹${total}</strong></span></div>
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
    showToast('Please enter your vehicle number', 'error');
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
    <div style="background:#F5F0FF;border-radius:12px;padding:16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:700;color:#1E1B4B;font-size:16px;">${b.spaceTitle}</span>
        <span style="background:#6C3CE1;color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">📍 ${b.spaceArea}</span>
      </div>
      <div style="font-size:13px;color:#4B5563;margin-bottom:4px;">📅 ${b.booking_date} · 🕐 ${formatTime(b.start_time)} - ${formatTime(b.end_time)} (${b.hours} hrs)</div>
      <div style="font-size:13px;color:#4B5563;">🚗 Vehicle: <strong>${b.vehicle_number}</strong></div>
    </div>

    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:#6B7280;">
        <span>Parking Fee (${b.hours} hrs × ₹${Math.round(b.total_amount/b.hours)})</span>
        <span>₹${b.total_amount}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#10B981;">
        <span>Platform Commission (15% included)</span>
        <span>₹${b.commission}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px dashed #D1D5DB;font-weight:800;font-size:18px;color:#111827;">
        <span>Total Payable</span>
        <span style="color:#6C3CE1;">₹${b.total_amount}</span>
      </div>
    </div>

    <h4 style="font-size:14px;color:#374151;margin-bottom:12px;">Choose Payment Method</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
      <button type="button" class="btn btn-secondary active" style="padding:12px;justify-content:center;border-color:#6C3CE1;" onclick="selectPaymentMethod(this, 'upi')">
        📱 UPI / GPay / PhonePe
      </button>
      <button type="button" class="btn btn-secondary" style="padding:12px;justify-content:center;" onclick="selectPaymentMethod(this, 'card')">
        💳 Debit / Credit Card
      </button>
    </div>

    <div id="upiPaySection">
      <div class="form-group" style="margin-bottom:16px;">
        <label>Enter UPI ID (e.g. mobile@upi, name@okhdfcbank)</label>
        <input type="text" id="upiIdInput" value="${currentUser ? currentUser.phone + '@upi' : '9876543210@upi'}" placeholder="yourname@okhdfcbank">
      </div>
    </div>

    <button class="btn btn-primary btn-lg" style="width:100%;font-size:16px;" onclick="processPaymentAndBook()">
      🔒 Pay ₹${b.total_amount} & Get Society Gate Pass
    </button>
    <div style="text-align:center;font-size:12px;color:#9CA3AF;margin-top:8px;">
      ⚡ Instant Gate Security Approval Pass Generated
    </div>
  `;

  modal.style.display = 'flex';
}

function selectPaymentMethod(btn, method) {
  btn.parentElement.querySelectorAll('button').forEach(b => {
    b.classList.remove('active');
    b.style.borderColor = '#D1D5DB';
  });
  btn.classList.add('active');
  btn.style.borderColor = '#6C3CE1';

  const upiSec = document.getElementById('upiPaySection');
  if (upiSec) {
    if (method === 'upi') {
      upiSec.innerHTML = `
        <div class="form-group" style="margin-bottom:16px;">
          <label>Enter UPI ID (e.g. mobile@upi)</label>
          <input type="text" id="upiIdInput" value="${currentUser ? currentUser.phone + '@upi' : 'user@upi'}">
        </div>
      `;
    } else {
      upiSec.innerHTML = `
        <div class="form-group" style="margin-bottom:10px;">
          <label>Card Number</label>
          <input type="text" placeholder="4532 •••• •••• 8892" value="4532 9012 3456 8892">
        </div>
        <div class="form-row" style="margin-bottom:16px;">
          <div><label style="font-size:12px;">Expiry</label><input type="text" placeholder="MM/YY" value="08/29"></div>
          <div><label style="font-size:12px;">CVV</label><input type="password" placeholder="•••" value="892"></div>
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
    btn.textContent = 'Processing payment... ⏳';
  }

  try {
    const res = await fetch(`${API}/api/bookings`, {
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
    const data = await res.json();
    if (res.ok) {
      closePaymentModal();
      showToast(`Payment of ₹${data.total_amount} successful! Gate Pass ready. 🎉`, 'success');
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
      showToast(data.error || 'Booking failed', 'error');
    }
  } catch (e) {
    showToast('Connection error', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Pay & Get Gate Pass';
    }
  }
}

// ==================== SOCIETY GATE PASS ====================

function showGatePass(booking) {
  const modal = document.getElementById('gatePassModal');
  const body = document.getElementById('gatePassModalBody');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PARKEASE-PUNE-PASS-${booking.id}-${booking.vehicle_number}`;

  body.innerHTML = `
    <div style="border:2px dashed #6C3CE1;border-radius:16px;padding:24px;background:#FDFCFF;text-align:center;">
      <div style="display:inline-block;background:#D1FAE5;color:#065F46;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:12px;">
        ✅ VERIFIED SOCIETY GATE ENTRY
      </div>
      <h3 style="font-size:18px;color:#1E1B4B;margin-bottom:4px;">${booking.space_title || booking.title}</h3>
      <p style="font-size:13px;color:#6B7280;margin-bottom:16px;">📍 ${booking.address || booking.area}</p>

      <div style="background:white;padding:12px;display:inline-block;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.06);margin-bottom:16px;">
        <img src="${qrUrl}" alt="Gate Security QR" style="width:140px;height:140px;display:block;">
      </div>

      <div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Vehicle Number</div>
      <div style="font-size:22px;font-weight:800;color:#6C3CE1;letter-spacing:2px;margin-bottom:16px;background:#F5F0FF;padding:6px;border-radius:8px;">
        ${booking.vehicle_number}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left;font-size:12px;background:#F3F4F6;padding:12px;border-radius:10px;margin-bottom:16px;">
        <div><strong style="color:#6B7280;">Date:</strong><br>${booking.booking_date}</div>
        <div><strong style="color:#6B7280;">Time Slot:</strong><br>${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
        <div><strong style="color:#6B7280;">Resident/Host:</strong><br>${booking.owner_name}</div>
        <div><strong style="color:#6B7280;">Gate Code:</strong><br>PK-${1000 + Number(booking.id)}</div>
      </div>

      <div style="font-size:12px;color:#4B5563;line-height:1.4;">
        Show this pass to security at the society entrance gate.
      </div>

      <div style="display:flex;gap:8px;margin-top:20px;">
        <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="window.print()">🖨️ Print Pass</button>
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="closeGatePassModal(); navigate('dashboard');">Done</button>
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
    description: document.getElementById('spDesc').value,
    is_covered: document.getElementById('spCovered').checked,
    has_cctv: document.getElementById('spCCTV').checked,
    has_guard: document.getElementById('spGuard').checked
  };

  try {
    const res = await fetch(`${API}/api/spaces`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(space)
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Parking spot listed successfully! 🎉', 'success');
      document.getElementById('listSpaceForm').reset();
      navigate('dashboard');
    } else {
      showToast(data.error || 'Failed to list', 'error');
    }
  } catch (e) {
    showToast('Connection error', 'error');
  }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
  try {
    const [dashRes, bookingsRes, spaceBookingsRes, spacesRes] = await Promise.all([
      fetch(`${API}/api/dashboard`, { headers: authHeaders() }),
      fetch(`${API}/api/my-bookings`, { headers: authHeaders() }),
      fetch(`${API}/api/space-bookings`, { headers: authHeaders() }),
      fetch(`${API}/api/my-spaces`, { headers: authHeaders() })
    ]);

    const dash = await dashRes.json();
    const bookings = await bookingsRes.json();
    const spaceBookings = await spaceBookingsRes.json();
    const spaces = await spacesRes.json();

    // Stats
    document.getElementById('dashStats').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon purple">🅿️</div>
        <h3>${dash.spaceCount}</h3>
        <p>My Listed Spots</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">💰</div>
        <h3>₹${dash.ownerStats?.total_earnings || 0}</h3>
        <p>Total Earnings</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">📋</div>
        <h3>${dash.ownerStats?.active_bookings || 0}</h3>
        <p>Active Bookings (Host)</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">🚗</div>
        <h3>${dash.renterStats?.total_bookings || 0}</h3>
        <p>My Bookings (Renter)</p>
      </div>
    `;

    // Store for tab switching
    window._dashData = { bookings, spaceBookings, spaces };
    renderDashTab('my-bookings');
  } catch (e) {
    console.error('Failed to load dashboard:', e);
  }
}

function switchDashTab(tab, btn) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDashTab(tab);
}

function renderDashTab(tab) {
  const content = document.getElementById('dashContent');

  if (tab === 'my-bookings') {
    const bookings = window._dashData?.bookings || [];
    if (bookings.length === 0) {
      content.innerHTML = `<div class="empty-state"><div class="icon">🚗</div><h3>No bookings yet</h3><p>Find a parking spot and book it!</p><button class="btn btn-primary" onclick="navigate('search')">Find Parking</button></div>`;
      return;
    }
    content.innerHTML = bookings.map(b => `
      <div class="booking-item">
        <div class="booking-info">
          <h4>${b.title}</h4>
          <p>📍 ${b.area} · ${b.vehicle_type === 'car' ? '🚗' : '🏍️'} ${b.vehicle_number || ''}</p>
          <p>📅 ${b.booking_date} · 🕐 ${formatTime(b.start_time)} - ${formatTime(b.end_time)} (${b.hours}h)</p>
          <p>Owner: ${b.owner_name} · 📞 ${b.owner_phone}</p>
        </div>
        <div class="booking-meta">
          <div class="amount">₹${b.total_amount}</div>
          <span class="status-badge status-${b.status}">${b.status}</span>
          ${b.status === 'confirmed' ? `
            <div style="margin-top:8px;display:flex;gap:4px;justify-content:flex-end;">
              <button class="btn btn-primary btn-sm" onclick='showGatePass(${JSON.stringify(b).replace(/'/g, "&apos;")})'>🛡️ Gate Pass</button>
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
      content.innerHTML = `<div class="empty-state"><div class="icon">📋</div><h3>No bookings on your spaces</h3><p>List a spot and wait for bookings!</p></div>`;
      return;
    }
    content.innerHTML = bookings.map(b => `
      <div class="booking-item">
        <div class="booking-info">
          <h4>${b.title}</h4>
          <p>🧑 Renter: ${b.renter_name} · 📞 ${b.renter_phone}</p>
          <p>📅 ${b.booking_date} · 🕐 ${formatTime(b.start_time)} - ${formatTime(b.end_time)} (${b.hours}h)</p>
        </div>
        <div class="booking-meta">
          <div class="amount" style="color:var(--success);">+₹${b.owner_payout}</div>
          <div style="font-size:11px;color:var(--gray-400);">Commission: ₹${b.commission}</div>
          <span class="status-badge status-${b.status}">${b.status}</span>
        </div>
      </div>
    `).join('');
  }

  if (tab === 'my-spaces') {
    const spaces = window._dashData?.spaces || [];
    if (spaces.length === 0) {
      content.innerHTML = `<div class="empty-state"><div class="icon">🅿️</div><h3>No spots listed</h3><p>Start earning by listing your parking!</p><button class="btn btn-primary" onclick="navigate('list-space')">List a Spot</button></div>`;
      return;
    }
    content.innerHTML = `<div class="card-grid">${spaces.map(s => `
      <div class="card" style="padding:24px;">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
          <span class="area-tag">📍 ${s.area}</span>
          <span class="status-badge ${s.is_active ? 'status-confirmed' : 'status-cancelled'}">${s.is_active ? 'Active' : 'Paused'}</span>
        </div>
        <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">${s.title}</h3>
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:12px;">${s.address}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:20px;font-weight:800;color:var(--primary);">₹${s.price_per_hour}/hr</span>
          <span style="font-size:13px;color:var(--gray-500);">${s.total_bookings} bookings</span>
        </div>
        <button class="btn ${s.is_active ? 'btn-secondary' : 'btn-success'} btn-sm" style="width:100%;margin-top:12px;" onclick="toggleSpace(${s.id})">
          ${s.is_active ? '⏸️ Pause Listing' : '▶️ Activate'}
        </button>
      </div>
    `).join('')}</div>`;
  }
}

async function cancelBooking(id) {
  if (!confirm('Cancel this booking?')) return;
  try {
    const res = await fetch(`${API}/api/bookings/${id}/cancel`, {
      method: 'PUT',
      headers: authHeaders()
    });
    if (res.ok) {
      showToast('Booking cancelled', 'success');
      loadDashboard();
    }
  } catch (e) {
    showToast('Failed to cancel', 'error');
  }
}

async function toggleSpace(id) {
  try {
    const res = await fetch(`${API}/api/spaces/${id}/toggle`, {
      method: 'PUT',
      headers: authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      showToast(data.message, 'success');
      loadDashboard();
    }
  } catch (e) {
    showToast('Failed to update', 'error');
  }
}

// ==================== ADMIN ====================

async function loadAdmin() {
  try {
    const res = await fetch(`${API}/api/admin/analytics`);
    const data = await res.json();

    // Stats
    document.getElementById('adminStats').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon purple">👥</div>
        <h3>${data.totalUsers}</h3>
        <p>Registered Users</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">🅿️</div>
        <h3>${data.totalSpaces}</h3>
        <p>Active Spots</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">📋</div>
        <h3>${data.totalBookings}</h3>
        <p>Total Bookings</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">💰</div>
        <h3>₹${data.revenue?.total_commission || 0}</h3>
        <p>Platform Commission (15%)</p>
      </div>
    `;

    // Additional revenue stats
    document.getElementById('adminStats').innerHTML += `
      <div class="stat-card">
        <div class="stat-icon green">📈</div>
        <h3>₹${data.revenue?.total_revenue || 0}</h3>
        <p>Total Revenue (GMV)</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">💸</div>
        <h3>₹${data.revenue?.total_payouts || 0}</h3>
        <p>Owner Payouts</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">📊</div>
        <h3>₹${Math.round(data.revenue?.avg_booking_value || 0)}</h3>
        <p>Avg. Booking Value</p>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">📱</div>
        <h3>15%</h3>
        <p>Commission Rate</p>
      </div>
    `;

    // Area breakdown
    const maxRevenue = Math.max(...data.areaBreakdown.map(a => a.revenue || 0), 1);
    document.getElementById('areaAnalytics').innerHTML = `
      <h3>Revenue by Area</h3>
      ${data.areaBreakdown.map(a => `
        <div class="area-bar">
          <span class="label">${a.area}</span>
          <div class="bar">
            <div class="bar-fill" style="width:${((a.revenue || 0) / maxRevenue * 100)}%">₹${a.revenue || 0}</div>
          </div>
          <span style="font-size:12px;color:var(--gray-500);width:80px;text-align:right;">${a.bookings} bookings</span>
        </div>
      `).join('')}
    `;

    // Recent bookings table
    const tbody = document.querySelector('#adminBookings tbody');
    tbody.innerHTML = data.recentBookings.map(b => `
      <tr>
        <td>#${b.id}</td>
        <td>${b.title}</td>
        <td>${b.renter_name}</td>
        <td>${b.owner_name}</td>
        <td>${b.booking_date}</td>
        <td>${b.hours}h</td>
        <td style="font-weight:600;">₹${b.total_amount}</td>
        <td style="color:var(--success);font-weight:600;">₹${b.commission}</td>
        <td><span class="status-badge status-${b.status}">${b.status}</span></td>
      </tr>
    `).join('');
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

function closeBookingModal() {
  document.getElementById('bookingModal').style.display = 'none';
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
