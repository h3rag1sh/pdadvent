const crypto = require('crypto');

function generateClaimCode() {
  return 'CC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function weightedPick(items) {
  const total = items.reduce((s, it) => s + Number(it.drop_chance), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= Number(it.drop_chance);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { generateClaimCode, weightedPick, shuffle, todayISO };