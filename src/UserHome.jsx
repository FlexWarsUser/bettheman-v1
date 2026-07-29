import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          background: '#252540',
          padding: '12px 16px',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 600,
          fontSize: 15,
          color: '#e8e8e8',
          border: '1px solid #3a3a5c',
        }}
      >
        {title} <span>{open ? '−' : '+'}</span>
      </div>
      {open && <div style={{ padding: '10px 0' }}>{children}</div>}
    </div>
  );
}
export default function UserHome() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
    const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('btm_user');
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem('btm_user');
      }
    }
  }, []);

  const login = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setLoading(true);
    console.log('Login attempt', email);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      console.log('Login response', res.status, data);
      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      localStorage.setItem('btm_user', JSON.stringify(data.user));
      setUser(data.user);
      if (data.user.role === 'admin' || data.user.role === 'house') {
        navigate('/ops');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('btm_user');
    setUser(null);
  };

  if (user) {
    return (
      <UserDashboard user={user} onLogout={logout} onUserUpdate={setUser} />
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20, color: '#e8e8e8' }}>
      <h1 style={{ color: '#00ff88', textAlign: 'center' }}>BetTheMan</h1>
      <div>
        <div style={{ marginBottom: 6, color: '#b0b0b0' }}>Email</div>
        <input
          type="text"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 14, borderRadius: 6, border: '1px solid #3a3a5c', background: '#252540', color: '#e8e8e8', boxSizing: 'border-box' }}
        />
        <div style={{ marginBottom: 6, color: '#b0b0b0' }}>Password</div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 14, borderRadius: 6, border: '1px solid #3a3a5c', background: '#252540', color: '#e8e8e8', boxSizing: 'border-box' }}
        />
        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
        <button
          type="button"
          onClick={login}
          disabled={loading}
          style={{ width: '100%', padding: 12, background: '#00ff88', color: '#0f0c29', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}
function UserDashboard({ user, onLogout, onUserUpdate }) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [bets, setBets] = useState([]);
  const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '' });
  const [message, setMessage] = useState('');
    const [bidAmount, setBidAmount] = useState({});
  const [layerMessage, setLayerMessage] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');

  const fetchBets = async () => {
    try {
      const res = await fetch(`${API}/api/bets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setBets(data);
      }
    } catch (e) {}
  };

const refreshUser = async () => {
  try {
    const res = await fetch(`${API}/api/users/${user.id}`);
    if (!res.ok) return;
    const data = await res.json();
    const newUser = {
      ...user,
      balance: data.balance,
      canLay: data.canLay,
      weight: data.weight,
      mustChangePassword: data.mustChangePassword,
    };
    if (JSON.stringify(newUser) !== JSON.stringify(user)) {
      localStorage.setItem('btm_user', JSON.stringify(newUser));
      onUserUpdate(newUser);
    }
  } catch (e) {}
};

useEffect(() => {
  fetchBets();
  refreshUser();

  const interval = setInterval(() => {
    fetchBets();
    refreshUser();
  }, 3000);

  return () => clearInterval(interval);
}, [user.id]);

  const placeBet = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API}/api/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bet,
          punterId: user.id,
          punterName: user.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to place bet');
        return;
      }
      setMessage('Bet submitted');
      setBet({ event: '', selection: '', odds: '', stake: '' });
      fetchBets();
      await refreshUser();
    } catch (err) {
      setMessage(err.message);
    }
  };
const changePassword = async () => {
  setPwMessage('');
  try {
    const res = await fetch(`${API}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        currentPassword,
        newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setPwMessage(data.error || 'Failed');
      return;
    }

    setPwMessage('Password updated');
    setCurrentPassword('');
    setNewPassword('');

    // clear the flag so the box disappears immediately
    const updatedUser = { ...user, mustChangePassword: false };
    localStorage.setItem('btm_user', JSON.stringify(updatedUser));
    onUserUpdate(updatedUser);          // this prop comes from UserHome
  } catch (e) {
    setPwMessage(e.message);
  }
};
  const getLayable = (b) => {
    const house = Number(b.houseAmount) || 0;
    return Math.max(0, Number(b.stake) - house);
  };

  const availableToLay = bets.filter(b => {
    if (b.phase !== 'layer_bidding') return false;
    if (Number(b.punterId) === Number(user.id)) return false;
    const bids = b.layerBids || [];
    if (bids.some(l => Number(l.layerId) === Number(user.id))) return false;
    return getLayable(b) > 0.01;
  });

  const submitLay = async (b) => {
    const amount = parseFloat(bidAmount[b.id]);
    if (!amount || amount <= 0) {
      setLayerMessage('Enter an amount');
      return;
    }
    setLayerMessage('');
    try {
      const res = await fetch(`${API}/api/bets/${b.id}/layer-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layerId: user.id,
          layerName: user.name,
          amount,
          action: 'bid',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLayerMessage(data.error || 'Lay failed');
        return;
      }
      setLayerMessage('Lay submitted');
      setBidAmount(prev => ({ ...prev, [b.id]: '' }));
      fetchBets();
      await refreshUser();
    } catch (e) {
      setLayerMessage(e.message);
    }
  };
  const myBets = bets
    .filter(b => Number(b.punterId) === Number(user.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 20, color: '#e8e8e8' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ color: '#00ff88', margin: 0 }}>BetTheMan</h1>
        <button type="button" onClick={onLogout} style={{ padding: '8px 12px', background: '#3a3a5c', color: '#e8e8e8', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Log out
        </button>
      </div>
      <p style={{ color: '#b0b0b0' }}>{user.name}</p>
      <p style={{ color: '#00ff88', fontWeight: 600 }}>Balance: £{Number(user.balance || 0).toFixed(2)}</p>
{user.mustChangePassword && (
  <div style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginTop: 16, marginBottom: 16, textAlign: 'left' }}>
    <div style={{ color: '#00ff88', fontWeight: 600, marginBottom: 8 }}>
      You must change your password
    </div>
    <input
      type="password"
      placeholder="Current password"
      value={currentPassword}
      onChange={e => setCurrentPassword(e.target.value)}
      style={inputStyle}
    />
    <input
      type="password"
      placeholder="New password"
      value={newPassword}
      onChange={e => setNewPassword(e.target.value)}
      style={inputStyle}
    />
    <button
      type="button"
      onClick={changePassword}
      style={{ padding: '8px 14px', background: '#3a3a5c', color: '#e8e8e8', border: 'none', borderRadius: 6, cursor: 'pointer' }}
    >
      Update password
    </button>
    {pwMessage && <p style={{ color: '#00ff88', marginTop: 8 }}>{pwMessage}</p>}
  </div>
)}
      <h2 style={{ color: '#00ff88', marginTop: 28 }}>Place a bet</h2>
      <form onSubmit={placeBet}>
        <input placeholder="Event" value={bet.event} onChange={e => setBet({ ...bet, event: e.target.value })} required style={inputStyle} />
        <input placeholder="Selection" value={bet.selection} onChange={e => setBet({ ...bet, selection: e.target.value })} required style={inputStyle} />
        <input placeholder="Odds e.g. 3/1" value={bet.odds} onChange={e => setBet({ ...bet, odds: e.target.value })} required style={inputStyle} />
        <input placeholder="Stake" type="number" value={bet.stake} onChange={e => setBet({ ...bet, stake: e.target.value })} required style={inputStyle} />
        <button type="submit" style={{ width: '100%', padding: 12, background: '#00ff88', color: '#0f0c29', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
          Submit bet
        </button>
      </form>
      {message && <p style={{ color: '#00ff88' }}>{message}</p>}

     {(() => {
  const myBets = bets
    .filter(b => Number(b.punterId) === Number(user.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const openBets = myBets.filter(b =>
    b.phase !== 'settled' &&
    !b.settledAt &&
    b.status !== 'rejected' &&
    (Number(b.houseAmount) || 0) + (b.layerBids || []).reduce((s, l) => s + (Number(l.actualLaid) || 0), 0) < 0.01
      ? true   // still in house/layer process
      : b.phase === 'finalized' && !b.settledAt
  );

  // still going through the matching process
  const inProcess = myBets.filter(b =>
    !b.settledAt &&
    b.status !== 'rejected' &&
    b.phase !== 'finalized' &&
    b.phase !== 'settled'
  );

  // matched / active (fully or partially laid, waiting for settlement)
  const activeBets = myBets.filter(b => {
    if (b.settledAt || b.phase === 'settled' || b.status === 'rejected') return false;
    const matched = (Number(b.houseAmount) || 0) +
      (b.layerBids || []).reduce((s, l) => s + (Number(l.actualLaid) || 0), 0);
    return matched > 0.01;
  });

  // settled
  const settledBets = myBets.filter(b => b.settledAt || b.phase === 'settled');

  // not accepted / rejected
  const rejectedBets = myBets.filter(b => {
    if (b.settledAt) return false;
    const matched = (Number(b.houseAmount) || 0) +
      (b.layerBids || []).reduce((s, l) => s + (Number(l.actualLaid) || 0), 0);
    return b.status === 'rejected' || (b.phase === 'finalized' && matched < 0.01);
  });

  const hasInProcess = inProcess.length > 0;

  return (
    <>
      <CollapsibleSection title={`In Process (${inProcess.length})`} defaultOpen={hasInProcess}>
        {inProcess.length === 0 && <p style={{ color: '#b0b0b0' }}>No bets currently being matched.</p>}
        {inProcess.map(b => (
          <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{b.event}</div>
            <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
            <div style={{ marginTop: 6, color: '#ffb347' }}>Pending</div>
          </div>
        ))}
      </CollapsibleSection>

      <CollapsibleSection title={`Active Bets (${activeBets.length})`} defaultOpen={false}>
        {activeBets.length === 0 && <p style={{ color: '#b0b0b0' }}>No active bets.</p>}
        {activeBets.map(b => {
          const house = Number(b.houseAmount) || 0;
          const layers = (b.layerBids || []).reduce((s, l) => s + (Number(l.actualLaid) || 0), 0);
          const matched = house + layers;
          return (
            <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 600 }}>{b.event}</div>
              <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
              <div style={{ marginTop: 6, color: '#00ff88' }}>
                Matched £{matched.toFixed(2)} of £{b.stake}
              </div>
            </div>
          );
        })}
      </CollapsibleSection>

      <CollapsibleSection title={`Settled Bets`} defaultOpen={false}>
     {settledBets.map(b => {
  const house = Number(b.houseAmount) || 0;
  const layers = (b.layerBids || []).reduce((s, l) => s + (Number(l.actualLaid) || 0), 0);
  const matched = house + layers;

  const isWon = b.result === 'won';
  const isManual = b.result === 'manual';

  let returns = 0;
  if (isWon && matched > 0) {
    const oddsStr = String(b.odds).trim();
    if (oddsStr.includes('/')) {
      const [n, d] = oddsStr.split('/').map(Number);
      returns = matched * (1 + n / (d || 1));
    } else {
      returns = matched * (parseFloat(oddsStr) || 1);
    }
  }

  // display label
  let resultLabel = 'LOST';
  let resultColor = '#ff6b6b';
  if (isWon) {
    resultLabel = 'WON';
    resultColor = '#00ff88';
  } else if (isManual) {
    resultLabel = 'SETTLED (Manual)';
    resultColor = '#ffb347';
  }

  return (
    <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div style={{ fontWeight: 600 }}>{b.event}</div>
      <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — Stake £{b.stake}</div>

      <div style={{ marginTop: 6, fontWeight: 600, color: resultColor }}>
        {resultLabel}
        {isWon && returns > 0 ? ` — Returns £${returns.toFixed(2)}` : ''}
      </div>

      {b.settlementNotes && (
        <div style={{ fontSize: 13, color: '#ffb347', marginTop: 4 }}>
          Note: {b.settlementNotes}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
        Settled: {b.settledAt ? new Date(b.settledAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}
      </div>
    </div>
  );
})}
          </CollapsibleSection>

      <CollapsibleSection title={`Not Accepted`} defaultOpen={false}>
        {rejectedBets.length === 0 && <p style={{ color: '#b0b0b0' }}>No rejected bets.</p>}
        {rejectedBets.map(b => (
          <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{b.event}</div>
            <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
            <div style={{ marginTop: 6, color: '#ff6b6b' }}>Not Accepted / Rejected</div>
          </div>
        ))}
      </CollapsibleSection>
    </>
  );
})()}
            {user.canLay && (
        <>
          <h2 style={{ color: '#00ff88', marginTop: 32 }}>Available to lay</h2>
          {layerMessage && <p style={{ color: '#00ff88' }}>{layerMessage}</p>}
          {availableToLay.length === 0 && (
            <p style={{ color: '#b0b0b0' }}>No bets available to lay.</p>
          )}
          {availableToLay.map(b => (
            <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 600 }}>{b.event}</div>
              <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — stake £{b.stake}</div>
              <div style={{ color: '#ffb347', marginTop: 4 }}>Available: £{getLayable(b).toFixed(2)}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="number"
                  placeholder="Your lay"
                  value={bidAmount[b.id] || ''}
                  onChange={e => setBidAmount(prev => ({ ...prev, [b.id]: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => submitLay(b)}
                  style={{ padding: '10px 14px', background: '#0066cc', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  Lay
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: 10,
  marginBottom: 10,
  borderRadius: 6,
  border: '1px solid #3a3a5c',
  background: '#252540',
  color: '#e8e8e8',
  boxSizing: 'border-box',
};
function userFacingStatus(b) {
  if (b.phase !== 'finalized' && b.status !== 'rejected') return 'Pending';
  const house = Number(b.houseAmount) || 0;
  const layers = (b.layerBids || []).reduce((s, l) => s + (Number(l.actualLaid) || 0), 0);
  const total = house + layers;
  const stake = Number(b.stake) || 0;
  if (b.status === 'rejected' || total <= 0.01) return 'Rejected';
  if (total >= stake - 0.01) return 'Fully laid';
  return `Partially laid £${total.toFixed(2)}`;
}

function statusColor(b) {
  const s = userFacingStatus(b);
  if (s === 'Pending') return '#ffb347';
  if (s === 'Fully laid') return '#00ff88';
  if (s.startsWith('Partially')) return '#ffb347';
  return '#ff6b6b';
}