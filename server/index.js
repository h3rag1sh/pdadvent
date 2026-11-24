require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db, init } = require('./db');
const { sign, authRequired, requireRole } = require('./auth');
const { generateClaimCode, weightedPick, shuffle, todayISO } = require('./utils');

init();

const app = express();
app.use(cors());
app.use(express.json());

// ----- helpers -----
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM Settings').all();
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return s;
}
function eventActive() {
  const s = getSettings();
  const t = todayISO();
  return (!s.event_start || t >= s.event_start) && (!s.event_end || t <= s.event_end);
}
function currentEventDay() {
  const s = getSettings();
  const start = s.event_start;
  if (!start) return null;
  const t = new Date(todayISO());
  const st = new Date(start);
  const diff = Math.floor((t - st) / 86400000) + 1; // 1-based
  return diff;
}

// ----- auth -----
function normalizePhone(p) {
  const raw = String(p || '').trim();
  const d = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return d.length >= 10 && d.length <= 15 ? '+' + d : null;
  if (d.length === 11 && d.startsWith('8')) return '+7' + d.slice(1);
  if (d.length === 11 && d.startsWith('7')) return '+' + d;
  if (d.length === 10) return '+7' + d;
  if (d.length > 11 && d.length <= 15) return '+' + d;
  return null;
}

app.post('/api/auth/register', (req, res) => {
  const { username, phone, password } = req.body || {};
  if (!username || !phone || !password) return res.status(400).json({ error: 'Заполните все поля' });
  if (String(password).length < 4) return res.status(400).json({ error: 'Пароль слишком короткий' });
  const normPhone = normalizePhone(phone);
  if (!normPhone || !/^\+\d{10,15}$/.test(normPhone)) return res.status(400).json({ error: 'Укажите полный номер телефона' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO Users(username,email,phone,password_hash,role) VALUES (?,?,?,?,?)')
      .run(username.trim(), null, normPhone, hash, 'user');
    const user = db.prepare('SELECT id, username, email, phone, role, bonus_balance, created_at FROM Users WHERE id=?').get(info.lastInsertRowid);
    res.json({ token: sign(user), user });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(400).json({ error: 'Имя или номер телефона уже заняты' });
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { login, phone, password } = req.body || {};
  const raw = String(phone || login || '').trim();
  if (!raw || !password) return res.status(400).json({ error: 'Введите номер телефона и пароль' });
  const normPhone = normalizePhone(raw);
  if (!normPhone) return res.status(400).json({ error: 'Укажите полный номер телефона' });
  const user = db.prepare('SELECT * FROM Users WHERE phone = ?').get(normPhone);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
  }
  const safe = { id: user.id, username: user.username, email: user.email, phone: user.phone, role: user.role, bonus_balance: user.bonus_balance, created_at: user.created_at };
  res.json({ token: sign(safe), user: safe });
});

app.post('/api/auth/forgot', (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Укажите номер телефона' });
  const normPhone = normalizePhone(phone);
  if (!normPhone || !/^\+\d{10,15}$/.test(normPhone)) return res.status(400).json({ error: 'Укажите полный номер телефона' });
  const user = db.prepare('SELECT id FROM Users WHERE phone = ?').get(normPhone);
  if (user) {
    const token = crypto.randomBytes(16).toString('hex');
    const expires = new Date(Date.now() + 3600 * 1000).toISOString();
    db.prepare('INSERT INTO PasswordResets(user_id,token,expires_at) VALUES (?,?,?)').run(user.id, token, expires);
    return res.json({ ok: true, reset_token: token, message: 'Токен восстановления (демо)' });
  }
  res.json({ ok: true, message: 'Если аккаунт существует, инструкция отправлена' });
});

app.post('/api/auth/reset', (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
  const row = db.prepare('SELECT * FROM PasswordResets WHERE token = ? AND used = 0').get(token);
  if (!row) return res.status(400).json({ error: 'Неверный токен' });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Токен истек' });
  const hash = bcrypt.hashSync(password, 10);
  const tx = db.transaction(() => {
    db.prepare('UPDATE Users SET password_hash=? WHERE id=?').run(hash, row.user_id);
    db.prepare('UPDATE PasswordResets SET used=1 WHERE id=?').run(row.id);
  });
  tx();
  res.json({ ok: true });
});

app.get('/api/me', authRequired, (req, res) => {
  res.json({ user: req.user, event: { ...getSettings(), active: eventActive(), currentDay: currentEventDay() } });
});

// ----- calendar & cases -----
app.get('/api/calendar', authRequired, (req, res) => {
  const days = db.prepare('SELECT * FROM CalendarDays ORDER BY day_number').all();
  const claims = db.prepare('SELECT day_id FROM UserClaims WHERE user_id=?').all(req.user.id);
  const claimedSet = new Set(claims.map(c => c.day_id));
  const cur = currentEventDay();
  const activeEvent = eventActive();
  const result = days.map(d => ({
    ...d,
    claimed: claimedSet.has(d.id),
    can_open: d.is_active === 1 && !claimedSet.has(d.id) && activeEvent && cur === d.day_number
  }));
  res.json({ days: result, event: { ...getSettings(), active: activeEvent, currentDay: cur } });
});

app.get('/api/cases/:dayNumber', authRequired, (req, res) => {
  const day = db.prepare('SELECT * FROM CalendarDays WHERE day_number=?').get(Number(req.params.dayNumber));
  if (!day) return res.status(404).json({ error: 'День не найден' });
  const items = db.prepare('SELECT id, title, description, rarity, reward_type, reward_value FROM CaseItems WHERE day_id=?').all(day.id);
  res.json({ day, items });
});

app.post('/api/cases/:dayNumber/open', authRequired, (req, res) => {
  const dayNumber = Number(req.params.dayNumber);
  const day = db.prepare('SELECT * FROM CalendarDays WHERE day_number=?').get(dayNumber);
  if (!day) return res.status(404).json({ error: 'День не найден' });
  if (!day.is_active) return res.status(400).json({ error: 'Кейс недоступен' });
  if (!eventActive()) return res.status(400).json({ error: 'Акция сейчас не активна' });
  const cur = currentEventDay();
  if (cur !== dayNumber) return res.status(400).json({ error: 'Этот кейс можно открыть только в свой день' });

  const existing = db.prepare('SELECT 1 FROM UserClaims WHERE user_id=? AND day_id=?').get(req.user.id, day.id);
  if (existing) return res.status(400).json({ error: 'Кейс уже открыт' });

  const items = db.prepare('SELECT * FROM CaseItems WHERE day_id=?').all(day.id);
  if (!items.length) return res.status(400).json({ error: 'Кейс пуст' });

  // Server-side win calculation BEFORE animation
  const win = weightedPick(items);
  const claim_code = generateClaimCode();

  const tx = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO UserClaims(user_id,day_id,item_id,claim_code,status) VALUES (?,?,?,?,?)'
    ).run(req.user.id, day.id, win.id, claim_code, 'active');
    if (win.reward_type === 'points') {
      db.prepare('UPDATE Users SET bonus_balance = bonus_balance + ? WHERE id=?').run(Number(win.reward_value) || 0, req.user.id);
    }
    return info.lastInsertRowid;
  });
  let claimId;
  try {
    claimId = tx();
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(400).json({ error: 'Кейс уже открыт' });
    throw e;
  }

  // build reel for client animation; winning item will be placed at target index
  const reelItems = [];
  for (let i = 0; i < 60; i++) reelItems.push(items[Math.floor(Math.random() * items.length)]);
  const targetIndex = 50;
  reelItems[targetIndex] = win;
  const publicReel = reelItems.map(it => ({ id: it.id, title: it.title, rarity: it.rarity }));

  const claim = db.prepare(`SELECT uc.*, ci.title, ci.description, ci.rarity, ci.reward_type, ci.reward_value
    FROM UserClaims uc JOIN CaseItems ci ON ci.id=uc.item_id WHERE uc.id=?`).get(claimId);
  const balance = db.prepare('SELECT bonus_balance FROM Users WHERE id=?').get(req.user.id).bonus_balance;
  res.json({ claim, winningItem: { id: win.id, title: win.title, description: win.description, rarity: win.rarity, reward_type: win.reward_type, reward_value: win.reward_value }, reel: publicReel, targetIndex, bonus_balance: balance });
});

// ----- inventory -----
app.get('/api/inventory', authRequired, (req, res) => {
  const { status, rarity, sort } = req.query;
  let sql = `SELECT uc.id, uc.claim_code, uc.status, uc.claimed_at, uc.day_id,
      cd.day_number, cd.case_name,
      ci.title, ci.description, ci.rarity, ci.reward_type, ci.reward_value
    FROM UserClaims uc
    JOIN CaseItems ci ON ci.id = uc.item_id
    JOIN CalendarDays cd ON cd.id = uc.day_id
    WHERE uc.user_id = ?`;
  const params = [req.user.id];
  if (status === 'active' || status === 'redeemed') { sql += ' AND uc.status = ?'; params.push(status); }
  if (['common','rare','mythical','covert'].includes(rarity)) { sql += ' AND ci.rarity = ?'; params.push(rarity); }
  sql += sort === 'date_asc' ? ' ORDER BY uc.claimed_at ASC' : ' ORDER BY uc.claimed_at DESC';
  const items = db.prepare(sql).all(...params);
  res.json({ items, bonus_balance: req.user.id ? db.prepare('SELECT bonus_balance FROM Users WHERE id=?').get(req.user.id).bonus_balance : 0 });
});

// ----- moderator terminal -----
app.get('/api/mod/claims', authRequired, requireRole('moderator','admin','superadmin'), (req, res) => {
  const { q, status } = req.query;
  let sql = `SELECT uc.id, uc.claim_code, uc.status, uc.claimed_at,
      u.username, u.email,
      ci.title, ci.rarity, ci.reward_type, ci.reward_value,
      cd.day_number
    FROM UserClaims uc
    JOIN Users u ON u.id = uc.user_id
    JOIN CaseItems ci ON ci.id = uc.item_id
    JOIN CalendarDays cd ON cd.id = uc.day_id
    WHERE 1=1`;
  const params = [];
  if (q) { sql += ' AND (uc.claim_code LIKE ? OR u.username LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (status === 'active' || status === 'redeemed') { sql += ' AND uc.status = ?'; params.push(status); }
  sql += ' ORDER BY uc.claimed_at DESC LIMIT 200';
  res.json({ claims: db.prepare(sql).all(...params) });
});

app.post('/api/mod/claims/:id/redeem', authRequired, requireRole('moderator','admin','superadmin'), (req, res) => {
  const id = Number(req.params.id);
  const claim = db.prepare('SELECT * FROM UserClaims WHERE id=?').get(id);
  if (!claim) return res.status(404).json({ error: 'Не найдено' });
  if (claim.status === 'redeemed') return res.status(400).json({ error: 'Уже выдано' });
  db.prepare('UPDATE UserClaims SET status=? WHERE id=?').run('redeemed', id);
  res.json({ ok: true });
});

// ----- admin: days & items CRUD, stats -----
app.get('/api/admin/days', authRequired, requireRole('admin','superadmin'), (req, res) => {
  const days = db.prepare('SELECT * FROM CalendarDays ORDER BY day_number').all();
  const counts = db.prepare('SELECT day_id, COUNT(*) as cnt FROM CaseItems GROUP BY day_id').all();
  const map = Object.fromEntries(counts.map(c => [c.day_id, c.cnt]));
  res.json({ days: days.map(d => ({ ...d, items_count: map[d.id] || 0 })) });
});

app.put('/api/admin/days/:id', authRequired, requireRole('admin','superadmin'), (req, res) => {
  const { case_name, is_active } = req.body || {};
  const day = db.prepare('SELECT * FROM CalendarDays WHERE id=?').get(Number(req.params.id));
  if (!day) return res.status(404).json({ error: 'Не найдено' });
  db.prepare('UPDATE CalendarDays SET case_name=?, is_active=? WHERE id=?')
    .run(case_name ?? day.case_name, is_active ? 1 : 0, day.id);
  res.json({ ok: true });
});

app.get('/api/admin/days/:id/items', authRequired, requireRole('admin','superadmin'), (req, res) => {
  const items = db.prepare('SELECT * FROM CaseItems WHERE day_id=? ORDER BY id').all(Number(req.params.id));
  res.json({ items });
});

app.post('/api/admin/days/:id/items', authRequired, requireRole('admin','superadmin'), (req, res) => {
  const dayId = Number(req.params.id);
  const { title, description, rarity, reward_type, reward_value, drop_chance } = req.body || {};
  if (!title || !rarity || !reward_type || reward_value == null || !drop_chance)
    return res.status(400).json({ error: 'Заполните все поля' });
  const info = db.prepare('INSERT INTO CaseItems(day_id,title,description,rarity,reward_type,reward_value,drop_chance) VALUES (?,?,?,?,?,?,?)')
    .run(dayId, title, description || '', rarity, reward_type, String(reward_value), Number(drop_chance));
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/admin/items/:id', authRequired, requireRole('admin','superadmin'), (req, res) => {
  const item = db.prepare('SELECT * FROM CaseItems WHERE id=?').get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Не найдено' });
  const b = req.body || {};
  db.prepare('UPDATE CaseItems SET title=?,description=?,rarity=?,reward_type=?,reward_value=?,drop_chance=? WHERE id=?')
    .run(b.title ?? item.title, b.description ?? item.description, b.rarity ?? item.rarity, b.reward_type ?? item.reward_type,
      String(b.reward_value ?? item.reward_value), Number(b.drop_chance ?? item.drop_chance), item.id);
  res.json({ ok: true });
});

app.delete('/api/admin/items/:id', authRequired, requireRole('admin','superadmin'), (req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare('SELECT 1 FROM UserClaims WHERE item_id=?').get(id);
  if (used) return res.status(400).json({ error: 'Нельзя удалить: предмет уже выпадал игрокам' });
  db.prepare('DELETE FROM CaseItems WHERE id=?').run(id);
  res.json({ ok: true });
});

app.get('/api/admin/stats', authRequired, requireRole('admin','superadmin'), (req, res) => {
  const totalOpens = db.prepare('SELECT COUNT(*) as c FROM UserClaims').get().c;
  const byDay = db.prepare(`SELECT cd.day_number, cd.case_name, COUNT(uc.id) as opens
    FROM CalendarDays cd LEFT JOIN UserClaims uc ON uc.day_id=cd.id
    GROUP BY cd.id ORDER BY cd.day_number`).all();
  const byRarity = db.prepare(`SELECT ci.rarity, COUNT(uc.id) as cnt
    FROM UserClaims uc JOIN CaseItems ci ON ci.id=uc.item_id
    GROUP BY ci.rarity`).all();
  const topItems = db.prepare(`SELECT ci.title, ci.rarity, COUNT(uc.id) as cnt
    FROM UserClaims uc JOIN CaseItems ci ON ci.id=uc.item_id
    GROUP BY ci.id ORDER BY cnt DESC LIMIT 10`).all();
  res.json({ totalOpens, byDay, byRarity, topItems });
});

// ----- superadmin: users & settings -----
app.get('/api/super/users', authRequired, requireRole('superadmin'), (req, res) => {
  const users = db.prepare('SELECT id, username, email, phone, role, bonus_balance, created_at FROM Users ORDER BY id').all();
  res.json({ users });
});

app.put('/api/super/users/:id/role', authRequired, requireRole('superadmin'), (req, res) => {
  const { role } = req.body || {};
  if (!['user','moderator','admin','superadmin'].includes(role)) return res.status(400).json({ error: 'Неверная роль' });
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Нельзя менять свою роль' });
  db.prepare('UPDATE Users SET role=? WHERE id=?').run(role, id);
  res.json({ ok: true });
});

app.get('/api/super/settings', authRequired, requireRole('superadmin'), (req, res) => {
  res.json(getSettings());
});

app.put('/api/super/settings', authRequired, requireRole('superadmin'), (req, res) => {
  const { event_start, event_end } = req.body || {};
  const up = db.prepare('INSERT INTO Settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const tx = db.transaction(() => {
    if (event_start) up.run('event_start', event_start);
    if (event_end) up.run('event_end', event_end);
  });
  tx();
  res.json(getSettings());
});

// Public settings for login page info
app.get('/api/settings', (req, res) => {
  res.json({ ...getSettings(), active: eventActive(), currentDay: currentEventDay() });
});

// Serve client build (for single-service deploy)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));