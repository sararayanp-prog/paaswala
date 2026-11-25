require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function priceForDelivery(km) {
  if (km <= 3) return 20;
  return 20 + Math.ceil(km - 3) * 5;
}

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, title TEXT, price INT, type TEXT, rent_type TEXT, area TEXT, phone TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, status TEXT DEFAULT 'LIVE', created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS workers (id SERIAL PRIMARY KEY, name TEXT, skill TEXT, charge INT, area TEXT, phone TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, paid_till DATE, created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS mazdoori (id SERIAL PRIMARY KEY, kya_karwana TEXT, kab DATE, paisa INT, kitne_aadmi INT, mile INT DEFAULT 0, baki INT, area TEXT, phone TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, status TEXT DEFAULT 'LIVE', created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS delivery (id SERIAL PRIMARY KEY, shop_name TEXT, kya_bhejna TEXT, kahan_bhejna TEXT, shop_phone TEXT, boy_phone TEXT, km DOUBLE PRECISION, price INT, shop_lat DOUBLE PRECISION, shop_lng DOUBLE PRECISION, status TEXT DEFAULT 'LIVE', hold_until TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reports (id SERIAL PRIMARY KEY, item_type TEXT, item_id INT, reported_by TEXT, reason TEXT, created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS strikes (phone TEXT PRIMARY KEY, total INT DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS subs (id SERIAL PRIMARY KEY, phone TEXT, plan TEXT, paid_till DATE, status TEXT DEFAULT 'LIVE')`);
  console.log('PaasWala Tables Ready');
}
init();

// ===== STEP 1 - SELL / BUY / RENT =====
app.post('/api/items', async (req, res) => {
  const { title, price, type, rent_type, area, phone, lat, lng } = req.body;
  const r = await pool.query(`INSERT INTO items (title, price, type, rent_type, area, phone, lat, lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [title, price, type, rent_type, area, phone, lat, lng]);
  res.json(r.rows[0]);
});

app.get('/api/items', async (req, res) => {
  const { lat, lng } = req.query;
  const r = await pool.query(`SELECT *, (6371 * acos(cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) + sin(radians($1)) * sin(radians(lat)))) AS distance FROM items WHERE status='LIVE' ORDER BY distance ASC`, [lat, lng]);
  res.json(r.rows.filter(x => x.distance <= 25));
});

app.post('/api/items/:id/sold', async (req, res) => {
  await pool.query(`UPDATE items SET status='SOLD' WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// ===== STEP 2 - WORKER =====
app.post('/api/workers', async (req, res) => {
  const { name, skill, charge, area, phone, lat, lng } = req.body;
  const r = await pool.query(`INSERT INTO workers (name, skill, charge, area, phone, lat, lng, paid_till) VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() + INTERVAL '7 days') RETURNING *`, [name, skill, charge, area, phone, lat, lng]);
  res.json(r.rows[0]);
});

app.get('/api/workers', async (req, res) => {
  const { lat, lng, skill } = req.query;
  const r = await pool.query(`SELECT *, (6371 * acos(cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) + sin(radians($1)) * sin(radians(lat)))) AS distance FROM workers WHERE skill=$3 ORDER BY distance ASC`, [lat, lng, skill]);
  res.json(r.rows.filter(x => x.distance <= 25));
});

// ===== STEP 3 - MAZDOORI =====
app.post('/api/mazdoori', async (req, res) => {
  const { kya_karwana, kab, paisa, kitne_aadmi, area, phone, lat, lng } = req.body;
  const r = await pool.query(`INSERT INTO mazdoori (kya_karwana, kab, paisa, kitne_aadmi, baki, area, phone, lat, lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [kya_karwana, kab, paisa, kitne_aadmi, kitne_aadmi, area, phone, lat, lng]);
  res.json(r.rows[0]);
});

app.get('/api/mazdoori', async (req, res) => {
  const { lat, lng } = req.query;
  const r = await pool.query(`SELECT *, (6371 * acos(cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) + sin(radians($1)) * sin(radians(lat)))) AS distance FROM mazdoori WHERE status='LIVE' ORDER BY distance ASC`, [lat, lng]);
  res.json(r.rows.filter(x => x.distance <= 25));
});

app.post('/api/mazdoori/:id/mila', async (req, res) => {
  const r = await pool.query(`SELECT * FROM mazdoori WHERE id=$1`, [req.params.id]);
  let job = r.rows[0];
  let mile = job.mile + 1;
  let baki = job.kitne_aadmi - mile;
  let status = baki <= 0 ? 'BOOKED' : 'LIVE';
  await pool.query(`UPDATE mazdoori SET mile=$1, baki=$2, status=$3 WHERE id=$4`, [mile, baki, status, req.params.id]);
  res.json({ mile, baki, status });
});

app.post('/api/mazdoori/:id/close', async (req, res) => {
  await pool.query(`UPDATE mazdoori SET status='CLOSED' WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// ===== STEP 4 - DELIVERY =====
app.post('/api/delivery', async (req, res) => {
  const { shop_name, kya_bhejna, kahan_bhejna, shop_phone, shop_lat, shop_lng, km } = req.body;
  const price = priceForDelivery(km);
  const r = await pool.query(`INSERT INTO delivery (shop_name, kya_bhejna, kahan_bhejna, shop_phone, shop_lat, shop_lng, km, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [shop_name, kya_bhejna, kahan_bhejna, shop_phone, shop_lat, shop_lng, km, price]);
  res.json(r.rows[0]);
});

app.get('/api/delivery', async (req, res) => {
  const { lat, lng } = req.query;
  const r = await pool.query(`SELECT *, (6371 * acos(cos(radians($1)) * cos(radians(shop_lat)) * cos(radians(shop_lng) - radians($2)) + sin(radians($1)) * sin(radians(shop_lat)))) AS distance FROM delivery WHERE status='LIVE' ORDER BY distance ASC`, [lat, lng]);
  res.json(r.rows.filter(x => x.distance <= 10));
});

app.post('/api/delivery/:id/hold', async (req, res) => {
  const { boy_phone } = req.body;
  await pool.query(`UPDATE delivery SET status='HOLD', boy_phone=$1, hold_until=NOW() + INTERVAL '10 minutes' WHERE id=$2`, [boy_phone, req.params.id]);
  res.json({ ok: true, msg: '10 Minute ke liye HOLD ho gaya' });
});

app.post('/api/delivery/:id/close', async (req, res) => {
  await pool.query(`UPDATE delivery SET status='CLOSED' WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// ===== STEP 5 - REPORT + PAYMENT =====
app.post('/api/report', async (req, res) => {
  const { item_type, item_id, reported_by, reason, owner_phone } = req.body;
  const check = await pool.query(`SELECT * FROM reports WHERE item_id=$1 AND reported_by=$2`, [item_id, reported_by]);
  if (check.rows.length > 0) return res.json({ msg: 'Tum already report kar chuke ho' });
  await pool.query(`INSERT INTO reports (item_type, item_id, reported_by, reason) VALUES ($1,$2,$3,$4)`, [item_type, item_id, reported_by, reason]);
  await pool.query(`INSERT INTO strikes (phone, total) VALUES ($1, 1) ON CONFLICT (phone) DO UPDATE SET total = strikes.total + 1`, [owner_phone]);
  const s = await pool.query(`SELECT total FROM strikes WHERE phone=$1`, [owner_phone]);
  let total = s.rows[0].total;
  if (total === 1) return res.json({ msg: 'STRIKE 1 - Notification gaya' });
  if (total === 2) {
    if (item_type === 'item') await pool.query(`UPDATE items SET status='HIDE' WHERE id=$1`, [item_id]);
    return res.json({ msg: 'STRIKE 2 - Warning' });
  }
  if (total >= 3) {
    if (item_type === 'item') await pool.query(`UPDATE items SET status='BLOCKED' WHERE id=$1`, [item_id]);
    return res.json({ msg: 'STRIKE 3 - Auto Block' });
  }
});

app.post('/api/pay', async (req, res) => {
  const { phone, plan, utr, name } = req.body;
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
  const msg = 'Naya Payment Aaya Hai\nNaam: ' + name + '\nPhone: ' + phone + '\nPlan: ' + plan + '\nUTR: ' + utr;
  await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: msg })
  });
  res.json({ ok: true, msg: 'Payment Admin ko bhej diya' });
});

app.post('/api/accept', async (req, res) => {
  const { phone, plan } = req.body;
  let days = 7;
  if (plan === 'ITEM') days = 30;
  if (plan === 'MAZDOORI_DAY') days = 1;
  await pool.query(`UPDATE subs SET paid_till = NOW() + ($1 * INTERVAL '1 day'), status='LIVE' WHERE phone=$2`, [days, phone]);
  await pool.query(`UPDATE items SET status='LIVE' WHERE phone=$1`, [phone]);
  res.json({ ok: true, msg: 'Accept ho gaya, Add Live' });
});

app.get('/', (req, res) => { res.send('PaasWala Live Hai'); });

app.listen(process.env.PORT || 10000, () => console.log('PaasWala Live'));

