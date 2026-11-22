const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'parkease.db');

let db;

async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'both',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parking_spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      address TEXT NOT NULL,
      area TEXT NOT NULL,
      landmark TEXT,
      lat REAL,
      lng REAL,
      vehicle_type TEXT DEFAULT 'car',
      price_per_hour REAL NOT NULL,
      available_from TEXT NOT NULL,
      available_to TEXT NOT NULL,
      available_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      description TEXT,
      is_covered INTEGER DEFAULT 0,
      has_cctv INTEGER DEFAULT 0,
      has_guard INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      space_id INTEGER NOT NULL,
      renter_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      hours REAL NOT NULL,
      total_amount REAL NOT NULL,
      commission REAL NOT NULL,
      owner_payout REAL NOT NULL,
      status TEXT DEFAULT 'confirmed',
      vehicle_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (space_id) REFERENCES parking_spaces(id),
      FOREIGN KEY (renter_id) REFERENCES users(id),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      space_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      FOREIGN KEY (space_id) REFERENCES parking_spaces(id)
    )
  `);

  seedDemoData();
  saveDB();
  return db;
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function seedDemoData() {
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  if (result[0].values[0][0] > 0) return;

  const hashedPass = bcrypt.hashSync('demo123', 10);
  const founderPass = bcrypt.hashSync('aenroxadmin123', 10);

  // Demo users (IDs 1-5 — spaces/bookings reference these owner_ids)
  db.run('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Rahul Sharma', 'rahul@demo.com', '9876543210', hashedPass, 'both']);
  db.run('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Priya Deshmukh', 'priya@demo.com', '9876543211', hashedPass, 'both']);
  db.run('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Amit Kulkarni', 'amit@demo.com', '9876543212', hashedPass, 'both']);
  db.run('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Sneha Patil', 'sneha@demo.com', '9876543213', hashedPass, 'both']);
  db.run('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Vikram Joshi', 'vikram@demo.com', '9876543214', hashedPass, 'both']);

  // Executive Admin & Founder — ID 6 (inserted after demo users to preserve owner_id mappings)
  db.run('INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Vishwajeet More', 'vishwajeet@aenrox.com', '9822012345', founderPass, 'admin']);

  // Demo parking spaces (Host rate; commuter pays host_rate / 0.90 with 10% commission included)
  const spaces = [
    [1, 'Covered Car Parking - Koregaon Park', 'Lane 5, Koregaon Park, Near Osho Ashram', 'Koregaon Park', 'Osho Ashram', 18.5362, 73.8946, 'car', 72, '09:00', '19:00', 'Mon,Tue,Wed,Thu,Fri', 'Secure covered parking in a gated society. 24/7 CCTV surveillance. Easy access from main road.', 1, 1, 1],
    [2, 'Open Parking - FC Road', 'Near Fergusson College, FC Road', 'FC Road', 'Fergusson College', 18.5236, 73.8403, 'car', 54, '08:30', '18:30', 'Mon,Tue,Wed,Thu,Fri,Sat', 'Open parking space in residential society. 5 min walk to FC Road shops and restaurants.', 0, 1, 0],
    [3, 'Bike Parking - Hinjewadi Phase 1', 'Near Rajiv Gandhi Infotech Park', 'Hinjewadi', 'Infosys Gate', 18.5912, 73.7389, 'bike', 27, '09:00', '20:00', 'Mon,Tue,Wed,Thu,Fri', 'Covered bike parking in IT Park area. Perfect for daily office goers.', 1, 0, 1],
    [4, 'Premium Parking - Viman Nagar', 'Near Phoenix Mall, Viman Nagar', 'Viman Nagar', 'Phoenix Mall', 18.5679, 73.9143, 'car', 90, '08:00', '22:00', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 'Premium covered parking with security guard. Walking distance to Phoenix Mall.', 1, 1, 1],
    [5, 'Society Parking - Kothrud', 'Near MIT College, Kothrud', 'Kothrud', 'MIT College', 18.5074, 73.8077, 'car', 45, '09:00', '18:00', 'Mon,Tue,Wed,Thu,Fri', 'Affordable parking in family society. Well-lit area with watchman.', 0, 0, 1],
    [1, 'Two-Wheeler Spot - MG Road', 'Near MG Road Metro Station', 'MG Road', 'Metro Station', 18.5169, 73.8554, 'bike', 27, '07:00', '21:00', 'Mon,Tue,Wed,Thu,Fri,Sat', 'Convenient bike parking near metro station. Great for daily commuters.', 0, 1, 0],
    [3, 'Covered Parking - Baner', 'Near Westend Mall, Baner', 'Baner', 'Westend Mall', 18.5590, 73.7868, 'car', 63, '08:00', '20:00', 'Mon,Tue,Wed,Thu,Fri,Sat', 'Spacious covered parking in premium society. Direct access from Baner Road.', 1, 1, 0],
    [4, 'Basement Parking - Shivajinagar', 'Near Shivajinagar Bus Stand', 'Shivajinagar', 'Bus Stand', 18.5308, 73.8474, 'car', 81, '07:00', '22:00', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 'Basement parking with 24/7 access. CCTV monitored. Heart of Pune.', 1, 1, 1],
  ];

  for (const s of spaces) {
    db.run('INSERT INTO parking_spaces (owner_id, title, address, area, landmark, lat, lng, vehicle_type, price_per_hour, available_from, available_to, available_days, description, is_covered, has_cctv, has_guard) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', s);
  }

  // Demo bookings (10% platform commission, 90% net host payout)
  const bookings = [
    [1, 3, 1, '2026-11-22', '09:00', '17:00', 8, 640, 64, 576, 'confirmed', 'MH12AB1234'],
    [2, 4, 2, '2026-11-22', '10:00', '15:00', 5, 300, 30, 270, 'confirmed', 'MH14CD5678'],
    [4, 5, 4, '2026-11-21', '09:00', '18:00', 9, 900, 90, 810, 'completed', 'MH12EF9012'],
    [1, 2, 1, '2026-11-20', '10:00', '16:00', 6, 480, 48, 432, 'completed', 'MH12GH3456'],
    [3, 1, 3, '2026-11-22', '09:30', '17:30', 8, 240, 24, 216, 'confirmed', 'MH12JK7890'],
  ];

  for (const b of bookings) {
    db.run('INSERT INTO bookings (space_id, renter_id, owner_id, booking_date, start_time, end_time, hours, total_amount, commission, owner_payout, status, vehicle_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', b);
  }

  // Demo reviews
  db.run('INSERT INTO reviews (booking_id, reviewer_id, space_id, rating, comment) VALUES (?, ?, ?, ?, ?)', [3, 5, 4, 5, 'Excellent parking spot! Very secure and close to Phoenix Mall.']);
  db.run('INSERT INTO reviews (booking_id, reviewer_id, space_id, rating, comment) VALUES (?, ?, ?, ?, ?)', [4, 2, 1, 4, 'Good covered parking. Easy to find. Slightly narrow entrance.']);

  console.log('✅ Demo data seeded successfully');
}

// Helper to run queries and return results as array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSQL(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return { lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0].values[0][0], changes: db.getRowsModified() };
}

module.exports = { initDB, queryAll, queryOne, runSQL, saveDB };
