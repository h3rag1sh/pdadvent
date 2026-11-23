import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FxBackground from '../components/FxBackground';

export default function Register() {
  const [form, setForm] = useState({ username:'', phone:'', password:'' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const nav = useNavigate();
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));

  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const res = await api.post('/auth/register', form);
      login(res.data.token, res.data.user);
      nav('/');
    } catch (err) { setError(err.response?.data?.error || 'Ошибка регистрации'); }
  };

  return (
    <div className="auth-wrap">
      <FxBackground />
      <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="auth-brand"><img src="/playday-logo.png" alt="PlayDay" /></div>
        <h1>Регистрация</h1>
        <p>Создайте аккаунт игрока клуба PlayDay</p>
        <div className="warn">ВНИМАНИЕ: используйте номер и ФИО, указанные при регистрации в Langame.</div>
        <form className="form" onSubmit={submit}>
          <div className="field"><label>ФИО (как в Langame)</label><input value={form.username} onChange={e=>set('username',e.target.value)} required /></div>
          <div className="field"><label>Полный номер телефона (как в Langame)</label><input type="tel" placeholder="+7 999 123-45-67" value={form.phone} onChange={e=>set('phone',e.target.value)} required /></div>
          <div className="field"><label>Пароль</label><input type="password" value={form.password} onChange={e=>set('password',e.target.value)} required /></div>
          {error && <div className="error">{error}</div>}
          <button className="btn primary glow-pulse" type="submit">Создать аккаунт</button>
        </form>
        <div style={{marginTop:14, fontSize:14}}><Link to="/login">Уже есть аккаунт? Войти</Link></div>
      </div>
    </div>
  );
}