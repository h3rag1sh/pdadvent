import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const roles = ['user', 'moderator', 'admin', 'superadmin'];

export default function Superadmin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({ event_start: '', event_end: '' });
  const [msg, setMsg] = useState('');

  const loadUsers = async () => { const r = await api.get('/super/users'); setUsers(r.data.users); };
  const loadSettings = async () => { const r = await api.get('/super/settings'); setSettings({ event_start: r.data.event_start || '', event_end: r.data.event_end || '' }); };

  useEffect(() => { loadUsers(); loadSettings(); }, []);

  const changeRole = async (id, role) => {
    setMsg('');
    try { await api.put(`/super/users/${id}/role`, { role }); setMsg('Роль обновлена'); loadUsers(); }
    catch (e) { setMsg(e.response?.data?.error || 'Ошибка'); }
  };
  const saveSettings = async (e) => {
    e.preventDefault(); setMsg('');
    try { await api.put('/super/settings', settings); setMsg('Даты акции сохранены'); }
    catch (e) { setMsg(e.response?.data?.error || 'Ошибка'); }
  };

  return (
    <div>
      <h1 className="page-title">Superadmin</h1>
      <p className="page-sub">Полный доступ: управление ролями пользователей и настройка дат проведения новогодней акции.</p>
      {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Даты проведения акции</h3>
        <form className="row" onSubmit={saveSettings} style={{ alignItems: 'end' }}>
          <div className="field"><label>Начало (YYYY-MM-DD)</label><input value={settings.event_start} onChange={e => setSettings({ ...settings, event_start: e.target.value })} placeholder="2026-12-01" /></div>
          <div className="field"><label>Конец (YYYY-MM-DD)</label><input value={settings.event_end} onChange={e => setSettings({ ...settings, event_end: e.target.value })} placeholder="2026-12-31" /></div>
          <button className="btn primary" type="submit">Сохранить</button>
        </form>
        <div className="muted" style={{ marginTop: 8 }}>Кейс дня N доступен, когда акция активна и сегодня = N-й день от даты начала.</div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Пользователи и роли</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Никнейм</th><th>Телефон</th><th>Email</th><th>Роль</th><th>Баланс</th><th>Создан</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}{u.id === user.id ? ' (вы)' : ''}</td>
                  <td className="mono">{u.phone || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td>
                    <select value={u.role} disabled={u.id === user.id} onChange={e => changeRole(u.id, e.target.value)}>
                      {roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>{u.bonus_balance}</td>
                  <td>{new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}