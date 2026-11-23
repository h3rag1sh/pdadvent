import { useEffect, useState } from 'react';
import api from '../api/client';

const rName = { common: 'Обычный', rare: 'Редкий', mythical: 'Мистический', covert: 'Тайный' };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [balance, setBalance] = useState(0);
  const [status, setStatus] = useState('');
  const [rarity, setRarity] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (rarity) params.rarity = rarity;
      if (sort) params.sort = sort;
      const res = await api.get('/inventory', { params });
      setItems(res.data.items);
      setBalance(res.data.bonus_balance || 0);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status, rarity, sort]);

  return (
    <div>
      <h1 className="page-title">Инвентарь</h1>
      <p className="page-sub">Ваши призы и коды для выдачи в клубе PlayDay. Баланс бонусов: <b style={{ color: 'var(--rare)', fontSize: 20, textShadow: '0 0 12px rgba(0,245,212,.4)' }}>{balance}</b></p>
      <div className="toolbar card" style={{ marginBottom: 16 }}>
        <div className="field"><label>Статус</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Все</option><option value="active">Активные</option><option value="redeemed">Использованные</option>
          </select>
        </div>
        <div className="field"><label>Редкость</label>
          <select value={rarity} onChange={e => setRarity(e.target.value)}>
            <option value="">Все</option><option value="common">Обычный</option><option value="rare">Редкий</option>
            <option value="mythical">Мистический</option><option value="covert">Тайный</option>
          </select>
        </div>
        <div className="field"><label>Сортировка по дате</label>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="date_desc">Сначала новые</option><option value="date_asc">Сначала старые</option>
          </select>
        </div>
      </div>
      {loading ? <div className="muted">Загрузка...</div> : items.length === 0 ? <div className="card muted">Пока пусто. Откройте кейс в календаре.</div> : (
        <div className="grid items">
          {items.map((it, i) => (
            <div key={it.id} className={`item-card rarity-${it.rarity} rarity-strip stagger-in`} style={{ '--i': i }}>
              <div className="rarity-text">{rName[it.rarity]}</div>
              <div className="title">{it.title}</div>
              <div className="desc">{it.description}</div>
              <div className="meta">День {it.day_number} · {it.reward_type === 'points' ? `+${it.reward_value} баллов` : it.reward_value}</div>
              <div style={{ marginTop: 4 }}>Код: <span className="mono">{it.claim_code}</span></div>
              <div><span className={`badge ${it.status === 'active' ? 'active' : 'redeemed'}`}>{it.status === 'active' ? 'Активен' : 'Использован'}</span></div>
              <div className="muted">{new Date(it.claimed_at).toLocaleString('ru-RU')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}