import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/me').then(res => {
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    }).catch(() => { setUser(null); localStorage.removeItem('token'); localStorage.removeItem('user'); })
      .finally(() => setLoading(false));
  }, []);

  const login = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  };
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };
  const refreshMe = async () => {
    const res = await api.get('/me');
    setUser(res.data.user);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    return res.data;
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout, refreshMe, setUser }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);