import { useEffect, useState } from 'react';
import api from '../api/client';

const rName = { common: 'Обычный', rare: 'Редкий', mythical: 'Мистический', covert: 'Тайный' };

export default function Moderator() {
  const [claims, setClaims] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (status) params.status = status;
      const res = await api.get('/mod/claims', { params });
      setClaims(res.data.claims);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const redeem = async (id) => {
    setMsg('');
    try {
      await api.post(`/mod/claims/${id}/redeem`);
      setMsg('Статус изменен: Выдан');
      load();
    } catch (e) { setMsg(e.response?.data?.error || 'Ошибка'); }
  };

  return (
    <div>
      <h1 className="page-title">Терминал выдачи призов</h1>
      <p className="page-sub">Поиск выигрыша по коду или нику игрока и смена статуса «Активен» → «Выдан».</p>
      <div className="toolbar card">
        <div className="field grow"><label>Поиск (код приза / никнейм)</label><input value={q} onChange={e => setQ(e.target.value)} placeholder="CC-XXXX или username" /></div>
        <div className="field"><label>Статус</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Все</option><option value="active">Активные</option><option value="redeemed">Выданные</option>
          </select>
        </div>
        <button className="btn primary" onClick={load}>Найти</button>
      </div>
      {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Код</th><th>Игрок</th><th>Приз</th><th>Редкость</th><th>День</th><th>Статус</th><th>Дата</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="8">Загрузка...</td></tr> : claims.length === 0 ? <tr><td colSpan="8">Ничего не найдено</td></tr> : claims.map(c => (
              <tr key={c.id}>
                <td className="mono">{c.claim_code}</td>
                <td>{c.username}<div className="muted">{c.email}</div></td>
                <td>{c.title}<div className="muted">{c.reward_type === 'points' ? `+${c.reward_value}` : c.reward_value}</div></td>
                <td className={`rarity-text rarity-${c.rarity}`}>{rName[c.rarity]}</td>
                <td>{c.day_number}</td>
                <td><span className={`badge ${c.status === 'active' ? 'active' : 'redeemed'}`}>{c.status === 'active' ? 'Активен' : 'Выдан'}</span></td>
                <td>{new Date(c.claimed_at).toLocaleString('ru-RU')}</td>
                <td>{c.status === 'active' && <button className="btn small primary" onClick={() => redeem(c.id)}>Выдать</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}