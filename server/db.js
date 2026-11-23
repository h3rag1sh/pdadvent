const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'data.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  migrate();

  // default settings (event window) - start today for demo
  const insSet = db.prepare('INSERT OR IGNORE INTO Settings(key,value) VALUES (?,?)');
  insSet.run('event_start', '2026-11-19');
  insSet.run('event_end', '2026-12-19');

  // seed 31 days if empty
  const dayCount = db.prepare('SELECT COUNT(*) as c FROM CalendarDays').get().c;
  if (dayCount === 0) {
    const insDay = db.prepare('INSERT INTO CalendarDays(day_number, case_name, is_active) VALUES (?,?,1)');
    const insItem = db.prepare(
      'INSERT INTO CaseItems(day_id,title,description,rarity,reward_type,reward_value,drop_chance) VALUES (?,?,?,?,?,?,?)'
    );
    const seedTx = db.transaction(() => {
      for (let d = 1; d <= 31; d++) {
        const info = insDay.run(d, `Кейс #${d}`);
        const dayId = info.lastInsertRowid;
        insItem.run(dayId, '50 бонусов', 'Немного бонусов на счет', 'common', 'points', '50', 60);
        insItem.run(dayId, '100 бонусов', 'Бонусы на игровой баланс', 'rare', 'points', '100', 25);
        insItem.run(dayId, 'Энергетик', 'Банка энергетика на баре', 'mythical', 'physical_item', 'Энергетик 0.5л', 12);
        insItem.run(dayId, '1 час игры', 'Промокод на 1 час ПК', 'covert', 'promo_code', 'HOUR-1', 3);
      }
    });
    seedTx();
  }

  // seed superadmin if no users
  const userCount = db.prepare('SELECT COUNT(*) as c FROM Users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('superadmin', 10);
    db.prepare(
      'INSERT INTO Users(username,email,phone,password_hash,role,bonus_balance) VALUES (?,?,?,?,?,?)'
    ).run('superadmin', 'superadmin@club.local', '+70000000000', hash, 'superadmin', 0);
    console.log('Seeded default superadmin: superadmin / superadmin');
  }
}

function migrate() {
  const cols = db.prepare("PRAGMA table_info(Users)").all().map(c => c.name);
  if (!cols.includes('phone')) {
    db.exec('ALTER TABLE Users ADD COLUMN phone TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON Users(phone)');
  }
  // Migrate old schema where email was NOT NULL to allow nullable email
  const emailCol = db.prepare("PRAGMA table_info(Users)").all().find(c => c.name === 'email');
  if (emailCol && emailCol.notnull === 1) {
    const migrateTx = db.transaction(() => {
      db.exec(`CREATE TABLE Users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT UNIQUE COLLATE NOCASE,
        phone TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin','superadmin')),
        bonus_balance INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.exec(`INSERT INTO Users_new(id,username,email,phone,password_hash,role,bonus_balance,created_at)
        SELECT id,username,email,phone,password_hash,role,bonus_balance,created_at FROM Users`);
      db.exec('DROP TABLE Users');
      db.exec('ALTER TABLE Users_new RENAME TO Users');
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_phone ON Users(phone)');
    });
    migrateTx();
  }
}

module.exports = { db, init };