import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotReset from './pages/ForgotReset';
import Calendar from './pages/Calendar';
import Inventory from './pages/Inventory';
import Moderator from './pages/Moderator';
import Admin from './pages/Admin';
import Superadmin from './pages/Superadmin';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<ForgotReset />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Calendar />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="moderator" element={<Protected roles={['moderator','admin','superadmin']}><Moderator /></Protected>} />
        <Route path="admin" element={<Protected roles={['admin','superadmin']}><Admin /></Protected>} />
        <Route path="superadmin" element={<Protected roles={['superadmin']}><Superadmin /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}