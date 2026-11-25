const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { initDB, queryAll, queryOne, runSQL } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'parkease-pune-secret-2026';

// Financial settlement rules: Commuter pays 100%, Host legally receives 80%, Platform retains 20%
const COMMISSION_RATE = 0.20; // 20% platform commission retained
const HOST_PAYOUT_RATE = 0.80; // 80% legally paid to host client

// Indian Payment Gateway Configuration (Razorpay / UPI / Cards / NetBanking)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_ParkEaseDemo';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'parkease_test_secret_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ==================== AUTH ROUTES ====================

app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }
  try {
    const hashed = bcrypt.hashSync(password, 10);
    const result = runSQL('INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)', [name, email, phone, hashed]);
    const token = jwt.sign({ id: result.lastInsertRowid, name, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastInsertRowid, name, email, phone } });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
});

app.get('/api/me', auth, (req, res) => {
  const user = queryOne('SELECT id, name, email, phone, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

// ==================== PARKING SPACES ====================

app.get('/api/spaces', (req, res) => {
  const { area, vehicle_type, min_price, max_price } = req.query;
  let query = `
    SELECT ps.*, u.name as owner_name, u.phone as owner_phone,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(r.id) as review_count
    FROM parking_spaces ps
    JOIN users u ON ps.owner_id = u.id
    LEFT JOIN reviews r ON ps.id = r.space_id
    WHERE ps.is_active = 1
  `;
  const params = [];

  if (area) { query += ' AND ps.area LIKE ?'; params.push(`%${area}%`); }
  if (vehicle_type) { query += ' AND ps.vehicle_type = ?'; params.push(vehicle_type); }
  if (min_price) { query += ' AND ps.price_per_hour >= ?'; params.push(Number(min_price)); }
  if (max_price) { query += ' AND ps.price_per_hour <= ?'; params.push(Number(max_price)); }

  query += ' GROUP BY ps.id ORDER BY avg_rating DESC, ps.created_at DESC';

  const spaces = queryAll(query, params).map(s => ({
    ...s,
    customer_price: Math.ceil(s.price_per_hour / 0.80)
  }));
  res.json(spaces);
});

app.get('/api/spaces/:id', (req, res) => {
  const space = queryOne(`
    SELECT ps.*, u.name as owner_name, u.phone as owner_phone,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(r.id) as review_count
    FROM parking_spaces ps
    JOIN users u ON ps.owner_id = u.id
    LEFT JOIN reviews r ON ps.id = r.space_id
    WHERE ps.id = ?
    GROUP BY ps.id
  `, [Number(req.params.id)]);

  if (!space) return res.status(404).json({ error: 'Space not found' });

  const reviews = queryAll(`
    SELECT r.*, u.name as reviewer_name
    FROM reviews r JOIN users u ON r.reviewer_id = u.id
    WHERE r.space_id = ?
    ORDER BY r.created_at DESC
  `, [Number(req.params.id)]);

  res.json({
    ...space,
    customer_price: Math.ceil(space.price_per_hour / 0.80),
    reviews
  });
});

app.post('/api/spaces', auth, (req, res) => {
  const { title, address, area, landmark, lat, lng, vehicle_type, price_per_hour, available_from, available_to, available_days, description, is_covered, has_cctv, has_guard } = req.body;
  try {
    const result = runSQL(
      'INSERT INTO parking_spaces (owner_id, title, address, area, landmark, lat, lng, vehicle_type, price_per_hour, available_from, available_to, available_days, description, is_covered, has_cctv, has_guard) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.user.id, title, address, area, landmark, lat || null, lng || null, vehicle_type || 'car', price_per_hour, available_from, available_to, available_days || 'Mon,Tue,Wed,Thu,Fri', description || '', is_covered ? 1 : 0, has_cctv ? 1 : 0, has_guard ? 1 : 0]
    );
    res.json({ id: result.lastInsertRowid, message: 'Parking space listed successfully!' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list space' });
  }
});

app.get('/api/my-spaces', auth, (req, res) => {
  const spaces = queryAll(`
    SELECT ps.*,
      COALESCE(AVG(r.rating), 0) as avg_rating,
      COUNT(DISTINCT r.id) as review_count,
      COUNT(DISTINCT b.id) as total_bookings
    FROM parking_spaces ps
    LEFT JOIN reviews r ON ps.id = r.space_id
    LEFT JOIN bookings b ON ps.id = b.space_id
    WHERE ps.owner_id = ?
    GROUP BY ps.id
  `, [req.user.id]).map(s => ({
    ...s,
    customer_price: Math.ceil(s.price_per_hour / 0.80)
  }));
  res.json(spaces);
});

app.put('/api/spaces/:id/toggle', auth, (req, res) => {
  const space = queryOne('SELECT * FROM parking_spaces WHERE id = ? AND owner_id = ?', [Number(req.params.id), req.user.id]);
  if (!space) return res.status(404).json({ error: 'Space not found' });
  runSQL('UPDATE parking_spaces SET is_active = ? WHERE id = ?', [space.is_active ? 0 : 1, Number(req.params.id)]);
  res.json({ message: space.is_active ? 'Space deactivated' : 'Space activated' });
});

// ==================== BOOKINGS ====================

app.post('/api/bookings', auth, (req, res) => {
  const { space_id, booking_date, start_time, end_time, vehicle_number, is_test_booking, payment_method } = req.body;
  const space = queryOne('SELECT * FROM parking_spaces WHERE id = ? AND is_active = 1', [space_id]);
  if (!space) return res.status(404).json({ error: 'Space not available' });
  if (space.owner_id === req.user.id && !is_test_booking) {
    return res.status(400).json({ error: 'Cannot book your own space in standard checkout. Use "Instant Test Booking" to simulate a reservation.' });
  }

  // Calculate hours
  const start = new Date(`2026-01-01T${start_time}`);
  const end = new Date(`2026-01-01T${end_time}`);
  const hours = (end - start) / (1000 * 60 * 60);
  if (hours <= 0) return res.status(400).json({ error: 'Invalid time range' });

  // Customer tariff: User pays 100%, Host receives 80% legal settlement, Platform retains 20%
  const customer_rate = Math.ceil(space.price_per_hour / 0.80);
  const total_amount = Math.round(hours * customer_rate);
  const commission = Math.round(total_amount * COMMISSION_RATE); // 20% platform fee
  const owner_payout = total_amount - commission; // 80% legal host clearing

  // Check for conflicting bookings
  const conflict = queryOne(`
    SELECT id FROM bookings 
    WHERE space_id = ? AND booking_date = ? AND status IN ('confirmed', 'active')
    AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))
  `, [space_id, booking_date, end_time, start_time, end_time, start_time]);

  if (conflict) return res.status(400).json({ error: 'Time slot already booked' });

  try {
    const paymentId = is_test_booking ? `test_bypass_${Date.now()}` : (req.body.payment_id || `sim_${Date.now()}`);
    const method = is_test_booking ? 'sandbox_zero_bypass' : (payment_method || 'razorpay');

    const result = runSQL(
      'INSERT INTO bookings (space_id, renter_id, owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, vehicle_number, payment_method, payment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [space_id, req.user.id, space.owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, vehicle_number || 'MH12XX0000', method, paymentId]
    );
    res.json({
      id: result.lastInsertRowid,
      total_amount,
      commission,
      owner_payout,
      is_test_booking: !!is_test_booking,
      payment_method: method,
      message: is_test_booking ? 'Test reservation confirmed (₹0 Sandbox Bypass)!' : 'Booking confirmed via Indian Gateway!'
    });
  } catch (e) {
    res.status(500).json({ error: 'Booking failed' });
  }
});

// ==================== PAYMENT GATEWAY (RAZORPAY & INDIAN PAYMENTS) ====================

app.get('/api/payment/config', (req, res) => {
  res.json({
    gateway: 'razorpay',
    key_id: RAZORPAY_KEY_ID,
    is_live: !!process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.startsWith('rzp_test_ParkEaseDemo'),
    currency: 'INR',
    commission_rate: COMMISSION_RATE, // 0.20 (20%)
    host_payout_rate: HOST_PAYOUT_RATE // 0.80 (80%)
  });
});

app.post('/api/payment/create-order', auth, async (req, res) => {
  const { space_id, booking_date, start_time, end_time, vehicle_number } = req.body;
  const space = queryOne('SELECT * FROM parking_spaces WHERE id = ? AND is_active = 1', [space_id]);
  if (!space) return res.status(404).json({ error: 'Space not available' });

  // Calculate hours
  const start = new Date(`2026-01-01T${start_time}`);
  const end = new Date(`2026-01-01T${end_time}`);
  const hours = (end - start) / (1000 * 60 * 60);
  if (hours <= 0) return res.status(400).json({ error: 'Invalid time range' });

  // Conflict check
  const conflict = queryOne(`
    SELECT id FROM bookings 
    WHERE space_id = ? AND booking_date = ? AND status IN ('confirmed', 'active')
    AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))
  `, [space_id, booking_date, end_time, start_time, end_time, start_time]);
  if (conflict) return res.status(400).json({ error: 'Time slot already booked by another commuter' });

  // Pricing model: User pays 100%, Host receives 80%, Platform retains 20%
  const customer_rate = Math.ceil(space.price_per_hour / 0.80);
  const total_amount = Math.round(hours * customer_rate); // 100%
  const commission = Math.round(total_amount * COMMISSION_RATE); // 20%
  const owner_payout = total_amount - commission; // 80%
  const amount_in_paise = total_amount * 100;

  let orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // If live Razorpay API keys are configured, create real Razorpay Order
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      const basicAuth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount_in_paise,
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
          notes: {
            space_id: String(space_id),
            booking_date,
            vehicle_number: vehicle_number || ''
          }
        })
      });
      const rzpData = await rzpRes.json();
      if (rzpData && rzpData.id) {
        orderId = rzpData.id;
      }
    } catch (err) {
      console.warn('Razorpay Live API connection error, generating seamless order ID:', err.message);
    }
  }

  // Generate UPI deep-link string for instant Android payment
  const upiIntentString = `upi://pay?pa=aenrox.parkease@icici&pn=ParkEase%20Pune&am=${total_amount}&cu=INR&tn=ParkEase%20Bay%20Reservation%20${space_id}`;

  res.json({
    order_id: orderId,
    amount: total_amount,
    amount_in_paise,
    currency: 'INR',
    key_id: RAZORPAY_KEY_ID,
    upi_intent: upiIntentString,
    financial_breakdown: {
      commuter_total: total_amount, // 100%
      host_settlement: owner_payout, // 80%
      platform_fee: commission, // 20%
      hours,
      rate_per_hour: customer_rate
    },
    space: {
      id: space.id,
      title: space.title,
      area: space.area,
      address: space.address
    }
  });
});

app.post('/api/payment/verify', auth, (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    space_id,
    booking_date,
    start_time,
    end_time,
    vehicle_number,
    payment_method
  } = req.body;

  const space = queryOne('SELECT * FROM parking_spaces WHERE id = ? AND is_active = 1', [space_id]);
  if (!space) return res.status(404).json({ error: 'Space not available' });

  // Signature verification if live secret configured and signature provided
  if (process.env.RAZORPAY_KEY_SECRET && razorpay_signature && razorpay_order_id && razorpay_payment_id) {
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature. Transaction unverified.' });
    }
  }

  // Calculate pricing
  const start = new Date(`2026-01-01T${start_time}`);
  const end = new Date(`2026-01-01T${end_time}`);
  const hours = Math.max(1, (end - start) / (1000 * 60 * 60));

  const customer_rate = Math.ceil(space.price_per_hour / 0.80);
  const total_amount = Math.round(hours * customer_rate); // 100%
  const commission = Math.round(total_amount * COMMISSION_RATE); // 20%
  const owner_payout = total_amount - commission; // 80%

  try {
    const paymentId = razorpay_payment_id || `pay_rzp_${Date.now()}`;
    const method = payment_method || 'razorpay';
    const result = runSQL(
      'INSERT INTO bookings (space_id, renter_id, owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, vehicle_number, payment_method, payment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [space_id, req.user.id, space.owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, vehicle_number || 'MH12XX0000', method, paymentId]
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      total_amount,
      commission,
      owner_payout,
      payment_id: paymentId,
      payment_method: method,
      message: 'Payment verified and reservation confirmed!'
    });
  } catch (err) {
    console.error('Failed to record verified booking:', err);
    res.status(500).json({ error: 'Database record failed' });
  }
});

// Real-time slot availability for a space on a given date (shows ticked/reserved slots)
app.get('/api/spaces/:id/availability', (req, res) => {
  const { date } = req.query;
  const bookingDate = date || new Date().toISOString().split('T')[0];
  const bookings = queryAll(`
    SELECT id, start_time, end_time, vehicle_number, status
    FROM bookings 
    WHERE space_id = ? AND booking_date = ? AND status IN ('confirmed', 'active')
    ORDER BY start_time ASC
  `, [Number(req.params.id), bookingDate]);
  res.json(bookings);
});

// Admin direct complimentary reservation dispatch (Zero payment required)
app.post('/api/admin/dispatch-booking', auth, requireAdmin, (req, res) => {
  const { space_id, booking_date, start_time, end_time, vehicle_number } = req.body;
  const space = queryOne('SELECT * FROM parking_spaces WHERE id = ?', [space_id]);
  if (!space) return res.status(404).json({ error: 'Space not found' });

  const start = new Date(`2026-01-01T${start_time}`);
  const end = new Date(`2026-01-01T${end_time}`);
  const hours = Math.max(1, (end - start) / (1000 * 60 * 60));

  const customer_rate = Math.ceil(space.price_per_hour / 0.80);
  const total_amount = Math.round(hours * customer_rate);
  const commission = Math.round(total_amount * COMMISSION_RATE); // 20%
  const owner_payout = total_amount - commission; // 80%

  try {
    const result = runSQL(
      'INSERT INTO bookings (space_id, renter_id, owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, vehicle_number, payment_method, payment_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [space_id, req.user.id, space.owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, vehicle_number || 'MH12ADMIN01', 'admin_dispatch', `disp_${Date.now()}`]
    );
    res.json({
      id: result.lastInsertRowid,
      total_amount,
      message: 'Admin complimentary reservation dispatched successfully!'
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to dispatch booking' });
  }
});

app.get('/api/my-bookings', auth, (req, res) => {
  const bookings = queryAll(`
    SELECT b.id, b.space_id, b.booking_date, b.start_time, b.end_time, b.hours, b.total_amount, b.status, b.vehicle_number, b.created_at,
      ps.title, ps.address, ps.area, ps.vehicle_type,
      u.name as owner_name, u.phone as owner_phone
    FROM bookings b
    JOIN parking_spaces ps ON b.space_id = ps.id
    JOIN users u ON b.owner_id = u.id
    WHERE b.renter_id = ?
    ORDER BY b.booking_date DESC, b.start_time DESC
  `, [req.user.id]);
  res.json(bookings);
});

app.get('/api/space-bookings', auth, (req, res) => {
  const bookings = queryAll(`
    SELECT b.*, ps.title, ps.address, ps.area,
      u.name as renter_name, u.phone as renter_phone
    FROM bookings b
    JOIN parking_spaces ps ON b.space_id = ps.id
    JOIN users u ON b.renter_id = u.id
    WHERE b.owner_id = ?
    ORDER BY b.booking_date DESC, b.start_time DESC
  `, [req.user.id]);
  res.json(bookings);
});

app.put('/api/bookings/:id/cancel', auth, (req, res) => {
  const booking = queryOne('SELECT * FROM bookings WHERE id = ? AND (renter_id = ? OR owner_id = ?)', [Number(req.params.id), req.user.id, req.user.id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
  runSQL("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [Number(req.params.id)]);
  res.json({ message: 'Booking cancelled' });
});

// ==================== REVIEWS ====================

app.post('/api/reviews', auth, (req, res) => {
  const { booking_id, rating, comment } = req.body;
  const booking = queryOne("SELECT * FROM bookings WHERE id = ? AND renter_id = ? AND status = 'completed'", [booking_id, req.user.id]);
  if (!booking) return res.status(400).json({ error: 'Can only review completed bookings' });

  const existing = queryOne('SELECT id FROM reviews WHERE booking_id = ?', [booking_id]);
  if (existing) return res.status(400).json({ error: 'Already reviewed' });

  runSQL('INSERT INTO reviews (booking_id, reviewer_id, space_id, rating, comment) VALUES (?,?,?,?,?)', [booking_id, req.user.id, booking.space_id, rating, comment]);
  res.json({ message: 'Review submitted!' });
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard', auth, (req, res) => {
  const ownerStats = queryOne(`
    SELECT 
      COUNT(*) as total_bookings,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN owner_payout ELSE 0 END), 0) as total_earnings,
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) as active_bookings
    FROM bookings WHERE owner_id = ?
  `, [req.user.id]);

  const renterStats = queryOne(`
    SELECT 
      COUNT(*) as total_bookings,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as total_spent,
      COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) as active_bookings
    FROM bookings WHERE renter_id = ?
  `, [req.user.id]);

  const spaceCount = queryOne('SELECT COUNT(*) as count FROM parking_spaces WHERE owner_id = ?', [req.user.id]);

  res.json({ ownerStats, renterStats, spaceCount: spaceCount ? spaceCount.count : 0 });
});

// Admin analytics (Institutional Platform Clearing Ledger) — admin only
app.get('/api/admin/analytics', auth, (req, res) => {
  // Check admin role
  const user = queryOne('SELECT role, email FROM users WHERE id = ?', [req.user.id]);
  if (!user || (user.role !== 'admin' && user.email !== 'vishwajeet@aenrox.com')) {
    return res.status(403).json({ error: 'Admin access restricted' });
  }
  const totalUsers = queryOne('SELECT COUNT(*) as count FROM users');
  const totalSpaces = queryOne('SELECT COUNT(*) as count FROM parking_spaces WHERE is_active = 1');
  const totalBookings = queryOne('SELECT COUNT(*) as count FROM bookings');
  
  const revenue = queryOne(`
    SELECT 
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(owner_payout), 0) as total_payouts,
      COALESCE(AVG(total_amount), 0) as avg_booking_value
    FROM bookings WHERE status IN ('confirmed', 'completed')
  `);

  const areaBreakdown = queryAll(`
    SELECT ps.area, COUNT(b.id) as bookings, SUM(b.total_amount) as revenue
    FROM bookings b JOIN parking_spaces ps ON b.space_id = ps.id
    WHERE b.status IN ('confirmed', 'completed')
    GROUP BY ps.area ORDER BY revenue DESC
  `);

  const recentBookings = queryAll(`
    SELECT b.*, ps.title, ps.area, 
      renter.name as renter_name, owner.name as owner_name
    FROM bookings b
    JOIN parking_spaces ps ON b.space_id = ps.id
    JOIN users renter ON b.renter_id = renter.id
    JOIN users owner ON b.owner_id = owner.id
    ORDER BY b.created_at DESC LIMIT 10
  `);

  res.json({
    totalUsers: totalUsers ? totalUsers.count : 0,
    totalSpaces: totalSpaces ? totalSpaces.count : 0,
    totalBookings: totalBookings ? totalBookings.count : 0,
    revenue,
    areaBreakdown,
    recentBookings
  });
});

app.get('/api/areas', (req, res) => {
  const areas = queryAll(`
    SELECT area, COUNT(*) as space_count, MIN(price_per_hour) as min_price, MAX(price_per_hour) as max_price
    FROM parking_spaces WHERE is_active = 1
    GROUP BY area ORDER BY space_count DESC
  `).map(a => ({
    ...a,
    min_price: Math.ceil(a.min_price / 0.80),
    max_price: Math.ceil(a.max_price / 0.80)
  }));
  res.json(areas);
});

// Admin role check middleware
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const user = queryOne('SELECT role, email FROM users WHERE id = ?', [req.user.id]);
  if (!user || (user.role !== 'admin' && user.email !== 'vishwajeet@aenrox.com')) {
    return res.status(403).json({ error: 'Admin access restricted' });
  }
  next();
}

// Admin: Flush all test data and reset to clean demo state
app.post('/api/admin/flush-data', auth, requireAdmin, (req, res) => {
  try {
    // Delete all bookings
    runSQL('DELETE FROM bookings');
    // Delete all reviews
    runSQL('DELETE FROM reviews');
    // Delete all user-created spaces (keep demo seed spaces by deleting all)
    runSQL('DELETE FROM parking_spaces');
    // Delete all users except the admin
    runSQL("DELETE FROM users WHERE email != 'vishwajeet@aenrox.com'");

    // Re-seed clean demo data
    const bcrypt = require('bcryptjs');
    const hashedPass = bcrypt.hashSync('demo123', 10);

    // Clean demo users with fictional names and dummy phone numbers
    runSQL('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Aditya Kulkarni', 'aditya@demo.com', '9822000001', hashedPass, 'both']);
    runSQL('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Neha Deshmukh', 'neha@demo.com', '9822000002', hashedPass, 'both']);
    runSQL('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Rohan Patil', 'rohan@demo.com', '9822000003', hashedPass, 'both']);
    runSQL('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Meera Joshi', 'meera@demo.com', '9822000004', hashedPass, 'both']);
    runSQL('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Siddharth Bhosale', 'siddharth@demo.com', '9822000005', hashedPass, 'both']);

    // Re-seed parking spaces with clean data (using new user IDs)
    const adminUser = queryOne("SELECT id FROM users WHERE email = 'vishwajeet@aenrox.com'");
    const demoUsers = queryAll("SELECT id FROM users WHERE email != 'vishwajeet@aenrox.com' ORDER BY id");

    if (demoUsers.length >= 5) {
      const u1 = demoUsers[0].id, u2 = demoUsers[1].id, u3 = demoUsers[2].id, u4 = demoUsers[3].id, u5 = demoUsers[4].id;

      const spaces = [
        [u1, 'Covered Car Parking - Koregaon Park', 'Lane 5, Koregaon Park, Near Osho Ashram', 'Koregaon Park', 'Osho Ashram', 18.5362, 73.8946, 'car', 64, '09:00', '19:00', 'Mon,Tue,Wed,Thu,Fri', 'Secure covered parking in a gated society. 24/7 CCTV surveillance.', 1, 1, 1],
        [u2, 'Open Parking - FC Road', 'Near Fergusson College, FC Road', 'FC Road', 'Fergusson College', 18.5236, 73.8403, 'car', 48, '08:30', '18:30', 'Mon,Tue,Wed,Thu,Fri,Sat', 'Open parking space in residential society. 5 min walk to FC Road.', 0, 1, 0],
        [u3, 'Bike Parking - Hinjewadi Phase 1', 'Near Rajiv Gandhi Infotech Park', 'Hinjewadi', 'Infosys Gate', 18.5912, 73.7389, 'bike', 24, '09:00', '20:00', 'Mon,Tue,Wed,Thu,Fri', 'Covered bike parking in IT Park area. Perfect for daily commuters.', 1, 0, 1],
        [u4, 'Premium Parking - Viman Nagar', 'Near Phoenix Mall, Viman Nagar', 'Viman Nagar', 'Phoenix Mall', 18.5679, 73.9143, 'car', 80, '08:00', '22:00', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 'Premium covered parking with security guard. Walking distance to Phoenix Mall.', 1, 1, 1],
        [u5, 'Society Parking - Kothrud', 'Near MIT College, Kothrud', 'Kothrud', 'MIT College', 18.5074, 73.8077, 'car', 40, '09:00', '18:00', 'Mon,Tue,Wed,Thu,Fri', 'Affordable parking in family society. Well-lit area with watchman.', 0, 0, 1],
        [u1, 'Two-Wheeler Spot - MG Road', 'Near MG Road Metro Station', 'MG Road', 'Metro Station', 18.5169, 73.8554, 'bike', 24, '07:00', '21:00', 'Mon,Tue,Wed,Thu,Fri,Sat', 'Convenient bike parking near metro station.', 0, 1, 0],
        [u3, 'Covered Parking - Baner', 'Near Westend Mall, Baner', 'Baner', 'Westend Mall', 18.5590, 73.7868, 'car', 56, '08:00', '20:00', 'Mon,Tue,Wed,Thu,Fri,Sat', 'Spacious covered parking in premium society.', 1, 1, 0],
        [u4, 'Basement Parking - Shivajinagar', 'Near Shivajinagar Bus Stand', 'Shivajinagar', 'Bus Stand', 18.5308, 73.8474, 'car', 72, '07:00', '22:00', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 'Basement parking with 24/7 access. CCTV monitored.', 1, 1, 1],
      ];

      for (const s of spaces) {
        runSQL('INSERT INTO parking_spaces (owner_id, title, address, area, landmark, lat, lng, vehicle_type, price_per_hour, available_from, available_to, available_days, description, is_covered, has_cctv, has_guard) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', s);
      }
    }

    res.json({ message: 'All test data flushed. Clean demo data re-seeded successfully.', ok: true });
  } catch (err) {
    console.error('Flush data error:', err);
    res.status(500).json({ error: 'Failed to flush data' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🅿️  ParkEase Pune - Server running at http://localhost:${PORT}\n`);
    console.log('Demo logins:');
    console.log('  📧 rahul@demo.com / demo123');
    console.log('  📧 priya@demo.com / demo123');
    console.log('  📧 amit@demo.com  / demo123\n');
  });
});
