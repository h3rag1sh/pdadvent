const jwt = require('jsonwebtoken');
const { db } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'cyber-advent-secret-change-me';

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, email, phone, role, bonus_balance, created_at FROM Users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Неверный или истекший токен' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Недостаточно прав' });
    next();
  };
}

module.exports = { sign, authRequired, requireRole, JWT_SECRET };