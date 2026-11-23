import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import ConfettiBurst from './ConfettiBurst';

const rarityName = { common: 'Обычный', rare: 'Редкий', mythical: 'Мистический', covert: 'Тайный' };

function RarityCard({ item, compact, i = 0 }) {
  return (
    <div className={`item-card rarity-${item.rarity} rarity-strip stagger-in`} style={{ minHeight: compact ? 90 : undefined, '--i': i }}>
      <div className="rarity-text">{rarityName[item.rarity]}</div>
      <div className="title">{item.title}</div>
      {!compact && item.description ? <div className="desc">{item.description}</div> : null}
      {!compact && <div className="meta">{item.reward_type === 'points' ? `+${item.reward_value} бонусов` : item.reward_type === 'promo_code' ? `Промокод: ${item.reward_value}` : `Награда: ${item.reward_value}`}</div>}
    </div>
  );
}

export default function CaseModal({ day, onClose, onOpened }) {
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reel, setReel] = useState([]);
  const [offset, setOffset] = useState(0);
  const [noTransition, setNoTransition] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const windowRef = useRef(null);
  const cardW = 150 + 12;

  useEffect(() => {
    api.get(`/cases/${day.day_number}`).then(r => setPreview(r.data.items || []))
      .catch(e => setError(e.response?.data?.error || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [day.day_number]);

  const canOpen = day.can_open;

  const openCase = async () => {
    if (!canOpen || opening || spinning || result) return;
    setOpening(true); setError(''); setShowWin(false);
    try {
      const res = await api.post(`/cases/${day.day_number}/open`);
      const { reel: r, targetIndex, winningItem, claim, bonus_balance } = res.data;
      setReel(r);
      setResult({ winningItem, claim, bonus_balance });
      setNoTransition(true);
      setOffset(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const winW = windowRef.current ? windowRef.current.clientWidth : 800;
          const targetOffset = targetIndex * cardW - (winW / 2 - cardW / 2);
          setNoTransition(false);
          setSpinning(true);
          requestAnimationFrame(() => setOffset(targetOffset));
        });
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Не удалось открыть кейс');
      setOpening(false);
    }
  };

  const onSpinEnd = () => {
    if (!spinning) return;
    setSpinning(false);
    setOpening(false);
    setShowWin(true);
    if (onOpened) onOpened(result);
  };

  const reelCards = useMemo(() => reel.length ? reel : [], [reel]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !spinning) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h2>День {day.day_number}: {day.case_name}</h2>
          <button className="close" onClick={onClose} disabled={spinning}>×</button>
        </div>

        {error && <div className="error" style={{ marginBottom: 10 }}>{error}</div>}

        {!reelCards.length && !result && (
          <>
            <div className="muted" style={{ marginBottom: 8 }}>Возможный дроп из кейса:</div>
            {loading ? <div className="muted">Загрузка...</div> : (
              <div className="grid items">
                {preview.map((it, i) => <RarityCard key={it.id} item={it} i={i} />)}
              </div>
            )}
            <div style={{ marginTop: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn primary glow-pulse" onClick={openCase} disabled={!canOpen || opening || loading} style={{ fontSize: 16, padding: '12px 22px' }}>
                {opening && !spinning ? 'Синхронизация...' : 'ОТКРЫТЬ КЕЙС'}
              </button>
              {!canOpen && <span className="muted">{day.claimed ? 'Кейс уже открыт' : 'Кейс откроется в свой день акции'}</span>}
              {canOpen && <span className="muted">Результат рассчитывается на сервере до анимации</span>}
            </div>
          </>
        )}

        {reelCards.length > 0 && (
          <div className={`roulette-wrap ${spinning ? 'spinning' : ''}`}>
            <div className="muted" style={{ marginBottom: 8, textAlign: 'center', letterSpacing: 1 }}>
              {spinning ? 'ПРОКРУТКА...' : showWin ? 'РЕЗУЛЬТАТ' : 'ПОДГОТОВКА'}
            </div>
            <div className="roulette-window" ref={windowRef}>
              <div className="roulette-indicator" />
              <div
                className="roulette-track"
                style={{
                  transform: `translateX(-${offset}px)`,
                  transition: noTransition ? 'none' : 'transform 6.5s cubic-bezier(0.08, 0.82, 0.12, 1)'
                }}
                onTransitionEnd={onSpinEnd}
              >
                {reelCards.map((it, idx) => (
                  <div key={idx} className={`roulette-card rarity-${it.rarity} rarity-strip`}>
                    <div className="rarity-text">{rarityName[it.rarity]}</div>
                    <div className="t">{it.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {result && showWin && (
          <div className={`win-reveal rarity-${result.winningItem.rarity}`}>
            <ConfettiBurst rarity={result.winningItem.rarity} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="muted">Ваш выигрыш</div>
              <div className="big">{result.winningItem.title}</div>
              <div className="muted" style={{ marginTop: 4 }}>{result.winningItem.description}</div>
              <div style={{ marginTop: 8 }}>Код выдачи: <span className="mono">{result.claim.claim_code}</span> <span className="badge active">Активен</span></div>
            </div>
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 2 }}>
              <div className="muted">Редкость</div>
              <div className="rarity-text" style={{ fontSize: 14 }}>{rarityName[result.winningItem.rarity]}</div>
              {result.bonus_balance != null && <div className="muted" style={{ marginTop: 8 }}>Баланс: <b style={{ color: 'var(--rare)' }}>{result.bonus_balance}</b> бон.</div>}
              <button className="btn primary" style={{ marginTop: 12 }} onClick={onClose}>В инвентарь</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}