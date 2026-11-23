import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FxBackground from './FxBackground';

const roleLabel = { user: 'Игрок', moderator: 'Модератор', admin: 'Админ', superadmin: 'Superadmin' };

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const onLogout = () => { logout(); nav('/login'); };
  return (
    <div className="app-shell">
      <FxBackground />
      <header className="topbar">
        <div className="brand">
          <img src="/playday-logo.png" alt="PlayDay" className="brand-logo" />
          <div className="brand-text">PLAY<span>DAY</span> <em>АДВЕНТ 2026</em></div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Календарь</NavLink>
          <NavLink to="/inventory">Инвентарь</NavLink>
          {['moderator','admin','superadmin'].includes(user.role) && <NavLink to="/moderator">Терминал</NavLink>}
          {['admin','superadmin'].includes(user.role) && <NavLink to="/admin">Админ</NavLink>}
          {user.role === 'superadmin' && <NavLink to="/superadmin">Superadmin</NavLink>}
          <span className="role">{user.username} · {roleLabel[user.role]}</span>
          <button onClick={onLogout}>Выход</button>
        </nav>
      </header>
      <main className="container page-enter">
        <Outlet />
      </main>
    </div>
  );
}