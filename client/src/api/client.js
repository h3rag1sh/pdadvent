import axios from 'axios';

const BASE_URL = import.meta.env.BASE_URL || '/';
const STATIC = import.meta.env.VITE_STATIC === '1' || (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io'));
const DB_KEY = 'playday_demo_db_v1';
const DEFAULT_ADMIN_PHONE = '+3751234567';
const LEGACY_ADMIN_PHONE = '+70000000000';

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.hash !== '#/login') window.location.href = `${BASE_URL}#/login`;
    }
    return Promise.reject(err);
  }
);

function fail(status, error) {
  const err = new Error(error);
  err.response = { status, data: { error } };
  if (status === 401 && STATIC) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (window.location.hash !== '#/login') window.location.href = `${BASE_URL}#/login`;
  }
  return err;
}

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

const validPhone = (v) => Boolean(v && /^\+\d{10,15}$/.test(v));

function phoneDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function findUserByPhone(db, phone) {
  const exact = db.users.find((u) => u.phone === phone);
  if (exact) return exact;
  const digits = phoneDigits(phone);
  if (!digits) return null;
  const byDigits = db.users.find((u) => phoneDigits(u.phone) === digits);
  if (byDigits) return byDigits;
  const tail = digits.slice(-10);
  return db.users.find((u) => phoneDigits(u.phone).slice(-10) === tail) || null;
}

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function seedDb() {
  const users = [{
    id: 1,
    username: 'superadmin',
    email: 'superadmin@club.local',
    phone: DEFAULT_ADMIN_PHONE,
    password: 'superadmin',
    role: 'superadmin',
    bonus_balance: 0,
    created_at: todayISO()
  }];
  const days = [];
  const items = [];
  let itemId = 1;
  const templates = [
    ['50 бонусов', 'Немного бонусов на счет', 'common', 'points', '50', 60],
    ['100 бонусов', 'Бонусы на игровой баланс', 'rare', 'points', '100', 25],
    ['Энергетик', 'Банка энергетика на баре', 'mythical', 'physical_item', 'Энергетик 0.5л', 12],
    ['1 час игры', 'Промокод на 1 час ПК', 'covert', 'promo_code', 'HOUR-1', 3]
  ];
  for (let d = 1; d <= 31; d++) {
    days.push({ id: d, day_number: d, case_name: `Кейс #${d}`, is_active: 1 });
    for (const [title, description, rarity, reward_type, reward_value, drop_chance] of templates) {
      items.push({ id: itemId++, day_id: d, title, description, rarity, reward_type, reward_value, drop_chance });
    }
  }
  return {
    users,
    days,
    items,
    claims: [],
    resets: [],
    tokens: {},
    settings: { event_start: '2026-11-19', event_end: '2026-12-19' },
    nextUserId: 2,
    nextClaimId: 1,
    nextResetId: 1
  };
}

function loadDb() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      const db = JSON.parse(raw);
      const broken = !Array.isArray(db.users) || !Array.isArray(db.days) || !Array.isArray(db.items) || !Array.isArray(db.claims) || !Array.isArray(db.resets) || !db.tokens || typeof db.tokens !== 'object' || !db.settings || typeof db.settings !== 'object' || !Number.isFinite(db.nextUserId) || !Number.isFinite(db.nextClaimId) || !Number.isFinite(db.nextResetId);
      if (broken) {
        const fresh = seedDb();
        saveDb(fresh);
        return fresh;
      }
      const admin = db.users.find((u) => u.role === 'superadmin');
      if (admin && admin.phone !== DEFAULT_ADMIN_PHONE) {
        const conflict = db.users.some((u) => u.id !== admin.id && u.phone === DEFAULT_ADMIN_PHONE);
        if (!conflict) {
          admin.phone = DEFAULT_ADMIN_PHONE;
          saveDb(db);
        }
      }
      return db;
    } catch {}
  }
  const db = seedDb();
  saveDb(db);
  return db;
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function publicUser(user) {
  if (!user) return null;
  const { password: _password, ...rest } = user;
  return rest;
}

function eventInfo(db) {
  const t = todayISO();
  const s = db.settings;
  const active = (!s.event_start || t >= s.event_start) && (!s.event_end || t <= s.event_end);
  const currentDay = s.event_start ? Math.floor((new Date(t) - new Date(s.event_start)) / 86400000) + 1 : null;
  return { ...s, active, currentDay };
}

function currentUser(db) {
  const token = localStorage.getItem('token');
  const id = db.tokens[token];
  return id ? db.users.find((u) => u.id === id) || null : null;
}

function requireUser(db) {
  const user = currentUser(db);
  if (!user) throw fail(401, 'Не авторизован');
  return user;
}

function requireRole(db, ...roles) {
  const user = requireUser(db);
  if (!roles.includes(user.role)) throw fail(403, 'Недостаточно прав');
  return user;
}

function makeToken(db, userId) {
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  db.tokens[token] = userId;
  return token;
}

function claimCode() {
  return 'PLD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + Number(item.drop_chance || 0), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Number(item.drop_chance || 0);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function syncUser(user) {
  const raw = localStorage.getItem('user');
  if (!raw) return;
  try {
    const stored = JSON.parse(raw);
    if (stored.id === user.id) {
      stored.bonus_balance = user.bonus_balance;
      localStorage.setItem('user', JSON.stringify(stored));
    }
  } catch {}
}

function handleMock(method, path, data, params, db) {
  if (method === 'get' && path === '/settings') return eventInfo(db);

  if (method === 'post' && path === '/auth/register') {
    if (!data.username || !data.phone || !data.password) throw fail(400, 'Заполните все поля');
    if (String(data.password).length < 4) throw fail(400, 'Пароль слишком короткий');
    const phone = normalizePhone(data.phone);
    if (!validPhone(phone)) throw fail(400, 'Укажите полный номер телефона');
    const duplicate = db.users.find((u) => u.username.toLowerCase() === String(data.username).trim().toLowerCase()) || findUserByPhone(db, phone);
    if (duplicate) throw fail(400, 'Имя или номер телефона уже заняты');
    const user = {
      id: db.nextUserId++,
      username: String(data.username).trim(),
      email: null,
      phone,
      password: String(data.password),
      role: 'user',
      bonus_balance: 0,
      created_at: todayISO()
    };
    db.users.push(user);
    const token = makeToken(db, user.id);
    saveDb(db);
    return { token, user: publicUser(user) };
  }

  if (method === 'post' && path === '/auth/login') {
    const raw = String(data.phone || data.login || '').trim();
    if (!raw || !data.password) throw fail(400, 'Введите номер телефона и пароль');
    const phone = normalizePhone(raw);
    if (!validPhone(phone)) throw fail(400, 'Укажите полный номер телефона');
    let user = findUserByPhone(db, phone);
    if (!user && phone === LEGACY_ADMIN_PHONE) user = db.users.find((u) => u.role === 'superadmin');
    if (!user || user.password !== String(data.password)) throw fail(401, 'Неверный номер телефона или пароль');
    const token = makeToken(db, user.id);
    saveDb(db);
    return { token, user: publicUser(user) };
  }

  if (method === 'get' && path === '/me') {
    const user = requireUser(db);
    return { user: publicUser(user), event: eventInfo(db) };
  }

  if (method === 'post' && path === '/auth/forgot') {
    if (!data.phone) throw fail(400, 'Укажите номер телефона');
    const phone = normalizePhone(data.phone);
    if (!validPhone(phone)) throw fail(400, 'Укажите полный номер телефона');
    const user = findUserByPhone(db, phone);
    if (!user) return { ok: true, message: 'Если аккаунт существует, инструкция отправлена' };
    const token = Math.random().toString(36).slice(2);
    db.resets.push({ id: db.nextResetId++, user_id: user.id, token, used: false, expires: new Date(Date.now() + 3600000).toISOString() });
    saveDb(db);
    return { ok: true, reset_token: token, message: 'Токен восстановления (демо)' };
  }

  if (method === 'post' && path === '/auth/reset') {
    if (!data.token || !data.password) throw fail(400, 'Токен и новый пароль обязательны');
    const row = db.resets.find((r) => r.token === data.token && !r.used);
    if (!row) throw fail(400, 'Неверный токен');
    if (new Date(row.expires) < new Date()) throw fail(400, 'Токен истек');
    const user = db.users.find((u) => u.id === row.user_id);
    if (user) user.password = String(data.password);
    row.used = true;
    saveDb(db);
    return { ok: true };
  }

  if (method === 'get' && path === '/calendar') {
    const user = requireUser(db);
    const event = eventInfo(db);
    const claimed = new Set(db.claims.filter((c) => c.user_id === user.id).map((c) => c.day_id));
    const days = db.days.map((d) => ({
      ...d,
      claimed: claimed.has(d.id),
      can_open: d.is_active === 1 && !claimed.has(d.id) && event.active && event.currentDay === d.day_number
    }));
    return { days, event };
  }

  let match;
  if (method === 'get' && (match = path.match(/^\/cases\/(\d+)$/))) {
    requireUser(db);
    const day = db.days.find((d) => d.day_number === Number(match[1]));
    if (!day) throw fail(404, 'День не найден');
    const items = db.items.filter((i) => i.day_id === day.id).map(({ id, title, description, rarity, reward_type, reward_value }) => ({ id, title, description, rarity, reward_type, reward_value }));
    return { day, items };
  }

  if (method === 'post' && (match = path.match(/^\/cases\/(\d+)\/open$/))) {
    const user = requireUser(db);
    const dayNumber = Number(match[1]);
    const day = db.days.find((d) => d.day_number === dayNumber);
    if (!day) throw fail(404, 'День не найден');
    if (!day.is_active) throw fail(400, 'Кейс недоступен');
    const event = eventInfo(db);
    if (!event.active) throw fail(400, 'Акция сейчас не активна');
    if (event.currentDay !== dayNumber) throw fail(400, 'Этот кейс можно открыть только в свой день');
    if (db.claims.some((c) => c.user_id === user.id && c.day_id === day.id)) throw fail(400, 'Кейс уже открыт');
    const items = db.items.filter((i) => i.day_id === day.id);
    if (!items.length) throw fail(400, 'Кейс пуст');
    const win = weightedPick(items);
    const claim = {
      id: db.nextClaimId++,
      user_id: user.id,
      day_id: day.id,
      item_id: win.id,
      claim_code: claimCode(),
      status: 'active',
      claimed_at: new Date().toISOString()
    };
    db.claims.push(claim);
    if (win.reward_type === 'points') user.bonus_balance += Number(win.reward_value) || 0;
    const reel = Array.from({ length: 60 }, () => {
      const item = items[Math.floor(Math.random() * items.length)];
      return { id: item.id, title: item.title, rarity: item.rarity };
    });
    const targetIndex = 50;
    reel[targetIndex] = { id: win.id, title: win.title, rarity: win.rarity };
    saveDb(db);
    syncUser(user);
    return {
      claim: { ...claim, title: win.title, description: win.description, rarity: win.rarity, reward_type: win.reward_type, reward_value: win.reward_value },
      winningItem: { id: win.id, title: win.title, description: win.description, rarity: win.rarity, reward_type: win.reward_type, reward_value: win.reward_value },
      reel,
      targetIndex,
      bonus_balance: user.bonus_balance
    };
  }

  if (method === 'get' && path === '/inventory') {
    const user = requireUser(db);
    let rows = db.claims.filter((c) => c.user_id === user.id).map((c) => {
      const day = db.days.find((d) => d.id === c.day_id);
      const item = db.items.find((i) => i.id === c.item_id);
      return {
        id: c.id,
        claim_code: c.claim_code,
        status: c.status,
        claimed_at: c.claimed_at,
        day_id: c.day_id,
        day_number: day?.day_number,
        case_name: day?.case_name,
        title: item?.title,
        description: item?.description,
        rarity: item?.rarity,
        reward_type: item?.reward_type,
        reward_value: item?.reward_value
      };
    });
    if (params.status === 'active' || params.status === 'redeemed') rows = rows.filter((r) => r.status === params.status);
    if (['common', 'rare', 'mythical', 'covert'].includes(params.rarity)) rows = rows.filter((r) => r.rarity === params.rarity);
    rows.sort((a, b) => params.sort === 'date_asc' ? new Date(a.claimed_at) - new Date(b.claimed_at) : new Date(b.claimed_at) - new Date(a.claimed_at));
    return { items: rows, bonus_balance: user.bonus_balance };
  }

  if (method === 'get' && path === '/mod/claims') {
    requireRole(db, 'moderator', 'admin', 'superadmin');
    let rows = db.claims.map((c) => {
      const user = db.users.find((u) => u.id === c.user_id);
      const day = db.days.find((d) => d.id === c.day_id);
      const item = db.items.find((i) => i.id === c.item_id);
      return {
        id: c.id,
        claim_code: c.claim_code,
        status: c.status,
        claimed_at: c.claimed_at,
        username: user?.username,
        email: user?.email,
        title: item?.title,
        rarity: item?.rarity,
        reward_type: item?.reward_type,
        reward_value: item?.reward_value,
        day_number: day?.day_number
      };
    });
    if (params.q) {
      const q = String(params.q).toLowerCase();
      rows = rows.filter((r) => String(r.claim_code).toLowerCase().includes(q) || String(r.username).toLowerCase().includes(q));
    }
    if (params.status === 'active' || params.status === 'redeemed') rows = rows.filter((r) => r.status === params.status);
    rows.sort((a, b) => new Date(b.claimed_at) - new Date(a.claimed_at));
    return { claims: rows.slice(0, 200) };
  }

  if (method === 'post' && (match = path.match(/^\/mod\/claims\/(\d+)\/redeem$/))) {
    requireRole(db, 'moderator', 'admin', 'superadmin');
    const claim = db.claims.find((c) => c.id === Number(match[1]));
    if (!claim) throw fail(404, 'Не найдено');
    if (claim.status === 'redeemed') throw fail(400, 'Уже выдано');
    claim.status = 'redeemed';
    saveDb(db);
    return { ok: true };
  }

  if (method === 'get' && path === '/admin/days') {
    requireRole(db, 'admin', 'superadmin');
    const days = db.days.map((d) => ({ ...d, items_count: db.items.filter((i) => i.day_id === d.id).length }));
    return { days };
  }

  if (method === 'put' && (match = path.match(/^\/admin\/days\/(\d+)$/))) {
    requireRole(db, 'admin', 'superadmin');
    const day = db.days.find((d) => d.id === Number(match[1]));
    if (!day) throw fail(404, 'Не найдено');
    if (data.case_name != null) day.case_name = data.case_name;
    day.is_active = data.is_active ? 1 : 0;
    saveDb(db);
    return { ok: true };
  }

  if (method === 'get' && (match = path.match(/^\/admin\/days\/(\d+)\/items$/))) {
    requireRole(db, 'admin', 'superadmin');
    return { items: db.items.filter((i) => i.day_id === Number(match[1])) };
  }

  if (method === 'post' && (match = path.match(/^\/admin\/days\/(\d+)\/items$/))) {
    requireRole(db, 'admin', 'superadmin');
    if (!data.title || !data.rarity || !data.reward_type || data.reward_value == null || !data.drop_chance) throw fail(400, 'Заполните все поля');
    const item = {
      id: Math.max(0, ...db.items.map((i) => i.id)) + 1,
      day_id: Number(match[1]),
      title: data.title,
      description: data.description || '',
      rarity: data.rarity,
      reward_type: data.reward_type,
      reward_value: String(data.reward_value),
      drop_chance: Number(data.drop_chance)
    };
    db.items.push(item);
    saveDb(db);
    return { id: item.id };
  }

  if (method === 'put' && (match = path.match(/^\/admin\/items\/(\d+)$/))) {
    requireRole(db, 'admin', 'superadmin');
    const item = db.items.find((i) => i.id === Number(match[1]));
    if (!item) throw fail(404, 'Не найдено');
    Object.assign(item, {
      title: data.title ?? item.title,
      description: data.description ?? item.description,
      rarity: data.rarity ?? item.rarity,
      reward_type: data.reward_type ?? item.reward_type,
      reward_value: String(data.reward_value ?? item.reward_value),
      drop_chance: Number(data.drop_chance ?? item.drop_chance)
    });
    saveDb(db);
    return { ok: true };
  }

  if (method === 'delete' && (match = path.match(/^\/admin\/items\/(\d+)$/))) {
    requireRole(db, 'admin', 'superadmin');
    const id = Number(match[1]);
    if (db.claims.some((c) => c.item_id === id)) throw fail(400, 'Нельзя удалить: предмет уже выпадал игрокам');
    db.items = db.items.filter((i) => i.id !== id);
    saveDb(db);
    return { ok: true };
  }

  if (method === 'get' && path === '/admin/stats') {
    requireRole(db, 'admin', 'superadmin');
    const byDay = db.days.map((d) => ({ day_number: d.day_number, case_name: d.case_name, opens: db.claims.filter((c) => c.day_id === d.id).length }));
    const rarityCount = {};
    const itemCount = {};
    for (const c of db.claims) {
      const item = db.items.find((i) => i.id === c.item_id);
      if (!item) continue;
      rarityCount[item.rarity] = (rarityCount[item.rarity] || 0) + 1;
      if (!itemCount[item.id]) itemCount[item.id] = { title: item.title, rarity: item.rarity, cnt: 0 };
      itemCount[item.id].cnt++;
    }
    const byRarity = Object.entries(rarityCount).map(([rarity, cnt]) => ({ rarity, cnt }));
    const topItems = Object.values(itemCount).sort((a, b) => b.cnt - a.cnt).slice(0, 10);
    return { totalOpens: db.claims.length, byDay, byRarity, topItems };
  }

  if (method === 'get' && path === '/super/users') {
    requireRole(db, 'superadmin');
    return { users: db.users.map(publicUser) };
  }

  if (method === 'put' && (match = path.match(/^\/super\/users\/(\d+)\/role$/))) {
    const admin = requireRole(db, 'superadmin');
    if (!['user', 'moderator', 'admin', 'superadmin'].includes(data.role)) throw fail(400, 'Неверная роль');
    const id = Number(match[1]);
    if (id === admin.id) throw fail(400, 'Нельзя менять свою роль');
    const user = db.users.find((u) => u.id === id);
    if (!user) throw fail(404, 'Не найдено');
    user.role = data.role;
    saveDb(db);
    return { ok: true };
  }

  if (method === 'get' && path === '/super/settings') {
    requireRole(db, 'superadmin');
    return { ...db.settings };
  }

  if (method === 'put' && path === '/super/settings') {
    requireRole(db, 'superadmin');
    if (data.event_start) db.settings.event_start = data.event_start;
    if (data.event_end) db.settings.event_end = data.event_end;
    saveDb(db);
    return { ...db.settings };
  }

  throw fail(404, `Неизвестный запрос: ${method} ${path}`);
}

function mockRequest(method, url, data = {}, params = {}) {
  try {
    const path = String(url || '').replace(/^\/api/, '') || '/';
    const db = loadDb();
    return Promise.resolve(handleMock(method, path, data || {}, params || {}, db));
  } catch (err) {
    if (err?.response) return Promise.reject(err);
    return Promise.reject(fail(500, err?.message || 'Ошибка демо-базы'));
  }
}

function request(method, url, data, params) {
  if (STATIC) return mockRequest(method, url, data, params);
  const config = { params };
  if (method === 'get' || method === 'delete') return http[method](url, config);
  return http[method](url, data, config);
}

const api = {
  get: (url, config = {}) => request('get', url, undefined, config.params),
  post: (url, data, config = {}) => request('post', url, data, config.params),
  put: (url, data, config = {}) => request('put', url, data, config.params),
  delete: (url, config = {}) => request('delete', url, undefined, config.params),
  resetDemo: () => {
    if (!STATIC) return Promise.resolve({ ok: false });
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    loadDb();
    return Promise.resolve({ ok: true });
  }
};

export default api;
