import { useEffect, useState } from 'react';
import api from '../api/client';

const rName = { common: 'Обычный', rare: 'Редкий', mythical: 'Мистический', covert: 'Тайный' };
const rarities = ['common', 'rare', 'mythical', 'covert'];
const emptyItem = { title: '', description: '', rarity: 'common', reward_type: 'points', reward_value: '', drop_chance: '10' };

export default function Admin() {
  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayForm, setDayForm] = useState({ case_name: '', is_active: true });
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyItem);
  const [editId, setEditId] = useState(null);
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('days');

  const loadDays = async (keepId) => {
    const r = await api.get('/admin/days');
    setDays(r.data.days);
    if (keepId) {
      const upd = r.data.days.find(x => x.id === keepId);
      if (upd) { setSelectedDay(upd); setDayForm({ case_name: upd.case_name, is_active: !!upd.is_active }); }
    }
    return r.data.days;
  };
  const loadItems = async (id) => { const r = await api.get(`/admin/days/${id}/items`); setItems(r.data.items); };
  const loadStats = async () => { const r = await api.get('/admin/stats'); setStats(r.data); };

  useEffect(() => { loadDays(); loadStats(); }, []);
  useEffect(() => { if (selectedDay) loadItems(selectedDay.id); else setItems([]); }, [selectedDay?.id]);

  const selectDay = (d) => {
    setSelectedDay(d);
    setDayForm({ case_name: d.case_name, is_active: !!d.is_active });
    setEditId(null);
    setForm(emptyItem);
    setMsg('');
  };

  const saveDay = async () => {
    if (!selectedDay) return;
    try {
      await api.put(`/admin/days/${selectedDay.id}`, { case_name: dayForm.case_name, is_active: dayForm.is_active ? 1 : 0 });
      setMsg('День сохранен');
      await loadDays(selectedDay.id);
    } catch (e) { setMsg(e.response?.data?.error || 'Ошибка'); }
  };

  const saveItem = async (e) => {
    e.preventDefault(); if (!selectedDay) return; setMsg('');
    try {
      if (editId) await api.put(`/admin/items/${editId}`, form);
      else await api.post(`/admin/days/${selectedDay.id}/items`, form);
      setForm(emptyItem); setEditId(null);
      await loadItems(selectedDay.id);
      await loadDays(selectedDay.id);
      setMsg('Сохранено');
    } catch (e) { setMsg(e.response?.data?.error || 'Ошибка'); }
  };
  const delItem = async (id) => {
    if (!window.confirm('Удалить предмет?')) return;
    try {
      await api.delete(`/admin/items/${id}`);
      await loadItems(selectedDay.id);
      await loadDays(selectedDay.id);
    } catch (e) { setMsg(e.response?.data?.error || 'Ошибка'); }
  };
  const startEdit = (it) => { setEditId(it.id); setForm({ title: it.title, description: it.description || '', rarity: it.rarity, reward_type: it.reward_type, reward_value: it.reward_value, drop_chance: it.drop_chance }); };

  return (
    <div>
      <h1 className="page-title">Панель администратора</h1>
      <p className="page-sub">Управление 31 днем календаря, наполнением кейсов (призы, редкость, шансы) и статистика открытий.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn ${tab === 'days' ? 'primary' : ''}`} onClick={() => setTab('days')}>Дни и кейсы</button>
        <button className={`btn ${tab === 'stats' ? 'primary' : ''}`} onClick={() => { setTab('stats'); loadStats(); }}>Статистика</button>
      </div>
      {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}

      {tab === 'days' && (
        <div className="admin-days-layout">
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Календарь (31 день)</h3>
            <div className="admin-cal-grid">
              {days.map(d => (
                <button
                  key={d.id}
                  type="button"
                  className={`admin-day-tile ${selectedDay?.id === d.id ? 'selected' : ''} ${!d.is_active ? 'inactive' : ''}`}
                  onClick={() => selectDay(d)}
                  title={d.case_name}
                >
                  <span className="n">{d.day_number}</span>
                  <span className="c">{d.items_count} пр.</span>
                  <span className={`dot ${d.is_active ? '' : 'off'}`} />
                </button>
              ))}
            </div>
            {selectedDay ? (
              <div className="admin-day-edit">
                <div className="muted">Редактирование: <b style={{ color: 'var(--text)' }}>День {selectedDay.day_number}</b></div>
                <div className="field">
                  <label>Название кейса</label>
                  <input value={dayForm.case_name} onChange={e => setDayForm({ ...dayForm, case_name: e.target.value })} />
                </div>
                <div className="rowline">
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={!!dayForm.is_active} onChange={e => setDayForm({ ...dayForm, is_active: e.target.checked })} /> Активен
                  </label>
                  <button className="btn small primary" type="button" onClick={saveDay}>Сохранить день</button>
                </div>
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 8 }}>Выберите день в календаре для редактирования.</div>
            )}
          </div>

          <div className="card">
            {!selectedDay ? <div className="muted">Выберите день слева для управления кейсом.</div> : (
              <>
                <h3 style={{ marginTop: 0 }}>Кейс дня {selectedDay.day_number}: {selectedDay.case_name}</h3>
                <div className="table-wrap" style={{ marginBottom: 14 }}>
                  <table>
                    <thead><tr><th>Название</th><th>Редкость</th><th>Тип</th><th>Значение</th><th>Шанс</th><th></th></tr></thead>
                    <tbody>
                      {items.length === 0 ? <tr><td colSpan="6">Нет предметов</td></tr> : items.map(it => (
                        <tr key={it.id}>
                          <td>{it.title}<div className="muted">{it.description}</div></td>
                          <td className={`rarity-text rarity-${it.rarity}`}>{rName[it.rarity]}</td>
                          <td>{it.reward_type}</td><td>{it.reward_value}</td><td>{it.drop_chance}</td>
                          <td><div className="row"><button className="btn small" onClick={() => startEdit(it)}>Изм.</button><button className="btn small danger" onClick={() => delItem(it.id)}>X</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h4 style={{ margin: '6px 0' }}>{editId ? 'Редактирование приза' : 'Добавить приз'}</h4>
                <form className="grid admin-item-form" style={{ gap: 10 }} onSubmit={saveItem}>
                  <div className="field"><label>Название</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                  <div className="field"><label>Редкость</label><select value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}>{rarities.map(r => <option key={r} value={r}>{rName[r]}</option>)}</select></div>
                  <div className="field" style={{ gridColumn: '1/-1' }}><label>Описание</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="field"><label>Тип награды</label><select value={form.reward_type} onChange={e => setForm({ ...form, reward_type: e.target.value })}><option value="points">points (баллы)</option><option value="promo_code">promo_code</option><option value="physical_item">physical_item</option></select></div>
                  <div className="field"><label>Значение (очки/код/предмет)</label><input value={form.reward_value} onChange={e => setForm({ ...form, reward_value: e.target.value })} required /></div>
                  <div className="field"><label>Шанс выпадения (вес)</label><input type="number" step="0.01" min="0.01" value={form.drop_chance} onChange={e => setForm({ ...form, drop_chance: e.target.value })} required /></div>
                  <div className="row" style={{ gridColumn: '1/-1' }}>
                    <button className="btn primary" type="submit">{editId ? 'Сохранить' : 'Добавить'}</button>
                    {editId && <button type="button" className="btn" onClick={() => { setEditId(null); setForm(emptyItem); }}>Отмена</button>}
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div>
          {!stats ? <div>Загрузка...</div> : (
            <>
              <div className="stat-cards">
                <div className="stat"><div className="v">{stats.totalOpens}</div><div className="k">Всего открытий</div></div>
                {stats.byRarity.map(r => <div key={r.rarity} className="stat"><div className={`v rarity-text rarity-${r.rarity}`}>{r.cnt}</div><div className="k">Выпало: {rName[r.rarity] || r.rarity}</div></div>)}
              </div>
              <div className="grid stats-grid-2">
                <div className="card"><h3 style={{ marginTop: 0 }}>Открытия по дням</h3>
                  <div className="table-wrap"><table><thead><tr><th>День</th><th>Кейс</th><th>Открытий</th></tr></thead>
                    <tbody>{stats.byDay.map(d => <tr key={d.day_number}><td>{d.day_number}</td><td>{d.case_name}</td><td>{d.opens}</td></tr>)}</tbody></table></div>
                </div>
                <div className="card"><h3 style={{ marginTop: 0 }}>Топ предметов</h3>
                  <div className="table-wrap"><table><thead><tr><th>Предмет</th><th>Редкость</th><th>Кол-во</th></tr></thead>
                    <tbody>{stats.topItems.map((t, i) => <tr key={i}><td>{t.title}</td><td className={`rarity-text rarity-${t.rarity}`}>{rName[t.rarity]}</td><td>{t.cnt}</td></tr>)}</tbody></table></div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}