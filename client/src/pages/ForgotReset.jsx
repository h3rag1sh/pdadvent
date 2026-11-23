import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import FxBackground from '../components/FxBackground';

export default function ForgotReset() {
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [demoToken, setDemoToken] = useState('');

  const forgot = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const payload = { phone };
      const res = await api.post('/auth/forgot', payload);
      setMsg(res.data.message || 'Готово');
      if (res.data.reset_token) setDemoToken(res.data.reset_token);
    } catch (e) { setErr(e.response?.data?.error || 'Ошибка'); }
  };
  const reset = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      await api.post('/auth/reset', { token, password });
      setMsg('Пароль изменен, теперь можно войти');
    } catch (e) { setErr(e.response?.data?.error || 'Ошибка'); }
  };

  return (
    <div className="auth-wrap">
      <FxBackground />
      <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="auth-brand"><img src="/playday-logo.png" alt="PlayDay" /></div>
        <h1>Восстановление</h1>
        <p>Запросите токен и установите новый пароль</p>
        <form className="form" onSubmit={forgot}>
          <div className="field"><label>Полный номер телефона</label><input type="tel" placeholder="+7 999 123-45-67" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel" required /></div>
          <button className="btn" type="submit">Получить токен</button>
        </form>
        {demoToken && <div className="success" style={{marginTop:8}}>Токен (демо): <code className="inline">{demoToken}</code></div>}
        <hr className="sep" />
        <form className="form" onSubmit={reset}>
          <div className="field"><label>Токен</label><input value={token} onChange={e=>setToken(e.target.value)} /></div>
          <div className="field"><label>Новый пароль</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
          <button className="btn primary" type="submit">Сменить пароль</button>
        </form>
        {msg && <div className="success" style={{marginTop:10}}>{msg}</div>}
        {err && <div className="error" style={{marginTop:10}}>{err}</div>}
        <div style={{marginTop:14, fontSize:14}}><Link to="/login">Назад ко входу</Link></div>
      </div>
    </div>
  );
}