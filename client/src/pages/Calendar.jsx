import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import CaseModal from '../components/CaseModal';

export default function Calendar() {
  const [days, setDays] = useState([]);
  const [event, setEvent] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const { refreshMe } = useAuth();

  const load = async () => {
    try {
      const res = await api.get('/calendar');
      setDays(res.data.days);
      setEvent(res.data.event);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onOpened = async () => {
    await load();
    try { await refreshMe(); } catch {}
  };

  return (
    <div>
      <h1 className="page-title">PlayDay: Новогодний Адвент</h1>
      <p className="page-sub">
        Открывайте кейс каждый день акции в клубе PlayDay. Результат определяется на сервере до анимации.
        {event && <> Период: <b>{event.event_start}</b> — <b>{event.event_end}</b> · {event.active ? <span style={{color:'var(--rare)'}}>акция активна</span> : <span style={{color:'var(--covert)'}}>акция не активна</span>} · текущий день: <b>{event.currentDay ?? '—'}</b></>}
      </p>
      {loading ? <div className="muted">Загрузка календаря...</div> : (
        <div className="grid days">
          {days.map((d, i) => {
            const cls = d.claimed ? 'claimed' : d.can_open ? 'openable glow-pulse' : 'locked';
            return (
              <div key={d.id} className={`day-cell ${cls} stagger-in`} style={{ '--i': i }} onClick={() => d.can_open && setSelected(d)}>
                <div className="num">{d.day_number}</div>
                <div className="name">{d.case_name}</div>
                {d.claimed ? <span className="badge claimed">Открыт</span> : d.can_open ? <span className="badge active">Доступен</span> : <span className="badge">{d.is_active ? 'Закрыт' : 'Выкл'}</span>}
              </div>
            );
          })}
        </div>
      )}
      {selected && <CaseModal day={selected} onClose={() => setSelected(null)} onOpened={onOpened} />}
    </div>
  );
}