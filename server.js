const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initDB, queryAll, queryOne, runSQL } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'parkease-pune-secret-2026';
const COMMISSION_RATE = 0.15; // 15% commission

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

  const spaces = queryAll(query, params);
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

  res.json({ ...space, reviews });
});

app.post('/api/spaces', auth, (req, res) => {
  const { title, address, area, landmark, lat, lng, vehicle_type, price_per_hour, available_from, available_to, available_days, description, is_covered, has_cctv, has_guard } = req.body;
  try {
    const result = runSQL(
      'INSERT INTO parking_spaces (owner_id, title, address, area, landmark, lat, lng, vehicle_type, price_per_hour, available_from, available_to, available_days, description, is_covered, has_cctv, has_guard) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.user.id, title, address, area, landmark, lat || null, lng || null, vehicle_type || 'car', price_per_hour, available_from, available_to, available_days || 'Mon,Tue,Wed,Thu,Fri', description, is_covered ? 1 : 0, has_cctv ? 1 : 0, has_guard ? 1 : 0]
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
  `, [req.user.id]);
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
  const { space_id, booking_date, start_time, end_time, vehicle_number } = req.body;
  const space = queryOne('SELECT * FROM parking_spaces WHERE id = ? AND is_active = 1', [space_id]);
  if (!space) return res.status(404).json({ error: 'Space not available' });
  if (space.owner_id === req.user.id) return res.status(400).json({ error: 'Cannot book your own space' });

  // Calculate hours
  const start = new Date(`2026-01-01T${start_time}`);
  const end = new Date(`2026-01-01T${end_time}`);
  const hours = (end - start) / (1000 * 60 * 60);
  if (hours <= 0) return res.status(400).json({ error: 'Invalid time range' });

  const total_amount = Math.round(hours * space.price_per_hour);
  const commission = Math.round(total_amount * COMMISSION_RATE);
  const owner_payout = total_amount - commission;

  // Check for conflicting bookings
  const conflict = queryOne(`
    SELECT id FROM bookings 
    WHERE space_id = ? AND booking_date = ? AND status IN ('confirmed', 'active')
    AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))
  `, [space_id, booking_date, end_time, start_time, end_time, start_time]);

  if (conflict) return res.status(400).json({ error: 'Time slot already booked' });

  try {
    const result = runSQL(
      'INSERT INTO bookings (space_id, renter_id, owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, vehicle_number) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [space_id, req.user.id, space.owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, vehicle_number]
    );
    res.json({
      id: result.lastInsertRowid,
      total_amount, commission, owner_payout,
      message: 'Booking confirmed!'
    });
  } catch (e) {
    res.status(500).json({ error: 'Booking failed' });
  }
});

app.get('/api/my-bookings', auth, (req, res) => {
  const bookings = queryAll(`
    SELECT b.*, ps.title, ps.address, ps.area, ps.vehicle_type,
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

// Admin analytics
app.get('/api/admin/analytics', (req, res) => {
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
  `);
  res.json(areas);
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
