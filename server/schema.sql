PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE COLLATE NOCASE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin','superadmin')),
  bonus_balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS CalendarDays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_number INTEGER NOT NULL UNIQUE CHECK (day_number BETWEEN 1 AND 31),
  case_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS CaseItems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER NOT NULL REFERENCES CalendarDays(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  rarity TEXT NOT NULL CHECK (rarity IN ('common','rare','mythical','covert')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('points','promo_code','physical_item')),
  reward_value TEXT NOT NULL,
  drop_chance REAL NOT NULL CHECK (drop_chance > 0)
);

CREATE TABLE IF NOT EXISTS UserClaims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  day_id INTEGER NOT NULL REFERENCES CalendarDays(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES CaseItems(id),
  claim_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','redeemed')),
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, day_id)
);

CREATE TABLE IF NOT EXISTS Settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS PasswordResets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_caseitems_day ON CaseItems(day_id);
CREATE INDEX IF NOT EXISTS idx_claims_user ON UserClaims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_code ON UserClaims(claim_code);
CREATE INDEX IF NOT EXISTS idx_claims_status ON UserClaims(status);