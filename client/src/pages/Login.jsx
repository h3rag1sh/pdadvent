import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FxBackground from '../components/FxBackground';

export default function Login() {
  const [login, setLoginVal] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login: doLogin } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const res = await api.post('/auth/login', { phone: login, password });
      doLogin(res.data.token, res.data.user);
      nav('/');
    } catch (err) { setError(err.response?.data?.error || 'Ошибка входа'); }
  };

  return (
    <div className="auth-wrap">
      <FxBackground />
      <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="auth-brand"><img src="/playday-logo.png" alt="PlayDay" /></div>
        <h1>Вход в PlayDay</h1>
        <p>Новогодний адвент и система лояльности клуба</p>
        <form className="form" onSubmit={submit}>
          <div className="field"><label>Номер телефона</label><input type="tel" placeholder="+7 999 123-45-67" value={login} onChange={e=>setLoginVal(e.target.value)} autoComplete="tel" required /></div>
          <div className="field"><label>Пароль</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></div>
          {error && <div className="error">{error}</div>}
          <button className="btn primary glow-pulse" type="submit">Войти</button>
        </form>
        <div style={{marginTop:14, display:'flex', justifyContent:'space-between', fontSize:14}}>
          <Link to="/register">Регистрация</Link>
          <Link to="/forgot">Забыли пароль?</Link>
        </div>
      </div>
    </div>
  );
}