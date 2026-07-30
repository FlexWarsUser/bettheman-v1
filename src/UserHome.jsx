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
          fontSize: 14,
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

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  marginBottom: 0,        // was 10
  borderRadius: 0,
  border: '1px solid #3a3a5c',  
  background: '#252540',
  color: '#e8e8e8',
  boxSizing: 'border-box',
  fontSize: 14,
};

export default function UserHome() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

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
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
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
      setError(err.message);
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('btm_user');
    setUser(null);
  };

  if (user) {
    return <UserDashboard user={user} onLogout={logout} onUserUpdate={setUser} />;
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20, color: '#e8e8e8' }}>
      <h1 style={{ textAlign: 'center', margin: 0 }}>
        <img src="/logo2.png" alt="BetTheMan" style={{ maxWidth: '280px', height: 'auto' }} />
      </h1>
      <div style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 6, color: '#b0b0b0' }}>Email</div>
        <input type="text" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <div style={{ marginBottom: 6, color: '#b0b0b0' }}>Password</div>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
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
  const [bets, setBets] = useState([]);
  const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '' });
  const [message, setMessage] = useState('');
  const [bidAmount, setBidAmount] = useState({});
  const [layerMessage, setLayerMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');
  const [customerTab, setCustomerTab] = useState('slip');

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

  const calcLiability = (amount, oddsStr) => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return 0;
    const str = String(oddsStr).trim();
    if (str.includes('/')) {
      const [n, d] = str.split('/').map(Number);
      return amt * (n / (d || 1));
    }
    const o = parseFloat(str);
    return o > 1 ? amt * (o - 1) : 0;
  };

  const openLaysExposure = (() => {
    if (!user.canLay) return 0;
    return bets.reduce((total, b) => {
      if (b.settledAt || b.phase === 'settled') return total;
      const myBid = (b.layerBids || []).find(
        l => Number(l.layerId) === Number(user.id) && !l.rejected
      );
      if (!myBid) return total;
      const laid = parseFloat(myBid.actualLaid ?? myBid.amount) || 0;
      return total + calcLiability(laid, b.odds);
    }, 0);
  })();

  const placeBet = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API}/api/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bet, punterId: user.id, punterName: user.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to place bet');
        return;
      }
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
        body: JSON.stringify({ userId: user.id, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPwMessage(data.error || 'Failed');
        return;
      }
      setPwMessage('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      const updatedUser = { ...user, mustChangePassword: false };
      localStorage.setItem('btm_user', JSON.stringify(updatedUser));
      onUserUpdate(updatedUser);
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

  // ----- bet lists -----
  const myBets = bets
    .filter(b => Number(b.punterId) === Number(user.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const getMatched = (b) =>
    (Number(b.houseAmount) || 0) +
    (b.layerBids || []).reduce((s, l) => s + (Number(l.actualLaid) || 0), 0);

  const inProcess = myBets.filter(
    b => !b.settledAt && b.status !== 'rejected' && b.phase !== 'finalized' && b.phase !== 'settled'
  );

  const activeBets = myBets.filter(b => {
    if (b.settledAt || b.phase === 'settled' || b.status === 'rejected') return false;
    return getMatched(b) > 0.01;
  });

  const settledBets = myBets.filter(b => {
    const matched = getMatched(b);
    return (b.settledAt || b.phase === 'settled') && matched > 0.01;
  });

  const rejectedBets = myBets.filter(b => {
    const matched = getMatched(b);
    return matched <= 0.01 && (b.status === 'rejected' || b.phase === 'finalized' || b.phase === 'settled' || b.settledAt);
  });

  // ----- lay lists -----
  const myLays = bets.filter(b =>
    (b.layerBids || []).some(l => Number(l.layerId) === Number(user.id) && !l.rejected)
  );
  const openLays = myLays.filter(b => !b.settledAt && b.phase !== 'settled');
  const settledLays = myLays
    .filter(b => b.settledAt || b.phase === 'settled')
    .sort((a, b) => new Date(b.settledAt || b.createdAt) - new Date(a.settledAt || a.createdAt));

  return (
    <div style={{ maxWidth: 520, margin: '10px auto', padding: 20, color: '#e8e8e8' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ textAlign: 'left', margin: 0 }}>
          <img src="/logo2.png" alt="BetTheMan" style={{ maxWidth: '240px', height: 'auto' }} />
        </h1>
        <button type="button" onClick={onLogout} style={{ padding: '8px 12px', background: '#3a3a5c', color: '#e8e8e8', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Log out 
        </button>
      </div>

      <p style={{ color: '#b0b0b0' }}>{user.name}</p>

      <div style={{ marginTop: 4, marginBottom: 8 }}>
        <span style={{ color: '#00ff88', fontWeight: 600 }}>
          Balance: £{Number(user.balance || 0).toFixed(2)}
        </span>
        {user.canLay && (
          <span style={{ color: '#ff6b6b', fontWeight: 600, marginLeft: 16 }}>
            Open Lays Exposure: £{openLaysExposure.toFixed(2)}
          </span>
        )}
      </div>

      {/* Forced password change */}
      {user.mustChangePassword && (
        <div style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginTop: 16, marginBottom: 16 }}>
          <div style={{ color: '#00ff88', fontWeight: 600, marginBottom: 8 }}>You must change your password</div>
          <input type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} />
          <button type="button" onClick={changePassword} style={{ padding: '8px 14px', background: '#3a3a5c', color: '#e8e8e8', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Update password
          </button>
          {pwMessage && <p style={{ color: '#00ff88', marginTop: 8 }}>{pwMessage}</p>}
        </div>
      )}

     {/* Tabs */}
<div style={{ display: 'flex', gap: 6, marginBottom: 16, marginTop: 10 }}>
  <button
    type="button"
    onClick={() => setCustomerTab('slip')}
    style={{
      flex: 1,
      padding: '8px 10px',
      borderRadius: 7,
      border: '1px solid #3a3a5c',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 14,
      background: customerTab === 'slip' ? '#00ff88' : '#252540',
      color: customerTab === 'slip' ? '#0f0c29' : '#e8e8e8',
    }}
  >
    Betting Slip
  </button>
  <button
    type="button"
    onClick={() => setCustomerTab('bets')}
    style={{
      flex: 1,
      padding: '8px 10px',
      borderRadius: 7,
      border: '1px solid #3a3a5c',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 14,
      background: customerTab === 'bets' ? '#00ff88' : '#252540',
      color: customerTab === 'bets' ? '#0f0c29' : '#e8e8e8',
    }}
  >
    My Bets
  </button>
  {user.canLay && (
    <button
      type="button"
      onClick={() => setCustomerTab('lays')}
      style={{
        flex: 1,
        padding: '8px 10px',
        borderRadius: 7,
        border: '1px solid #3a3a5c',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: 14,
        background: customerTab === 'lays' ? '#00ff88' : '#252540',
        color: customerTab === 'lays' ? '#0f0c29' : '#e8e8e8',
      }}
    >
      My Lays
    </button>
  )}
</div>

      {/* ===== TAB: Betting Slip ===== */}
      {customerTab === 'slip' && (
        <>
          <CollapsibleSection title="Show/Hide Betting Slip" defaultOpen={false}>
            <form onSubmit={placeBet}>
              <p style={{ color: '#00ff88', margin: '0 0 0 0', fontSize: 14 }}>Enter bet details</p>
              <input placeholder="Event" value={bet.event} onChange={e => setBet({ ...bet, event: e.target.value })} required style={inputStyle} />
              <input placeholder="Selection" value={bet.selection} onChange={e => setBet({ ...bet, selection: e.target.value })} required style={inputStyle} />
              <input placeholder="Odds e.g. 3/1" value={bet.odds} onChange={e => setBet({ ...bet, odds: e.target.value })} required style={inputStyle} />
              <input placeholder="Stake" type="number" value={bet.stake} onChange={e => setBet({ ...bet, stake: e.target.value })} required style={inputStyle} />
<button
  type="submit"
  style={{
    width: '33%',
    padding: '10px 12px',
    marginTop: 4,
    background: '#00ff88',
    color: '#0f0c29',
    border: 'none',
    borderRadius: 7,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    letterSpacing: '0.3px',
  }}
>
  Submit bet
</button>
            </form>
            {message && <p style={{ color: '#00ff88' }}>{message}</p>}
          </CollapsibleSection>
          {/* Pending bets shown under the slip */}
{inProcess.length > 0 && (
  <div style={{ marginTop: 10 }}>
    <div style={{ color: '#ffb347', fontWeight: 600, marginBottom: 10 }}>
      In Process ({inProcess.length})
    </div>
    {inProcess.map(b => (
      <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 600 }}>{b.event}</div>
        <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
        <div style={{ marginTop: 6, color: '#ffb347' }}>Pending</div>
      </div>
    ))}
  </div>
)}

          {user.canLay && availableToLay.length > 0 && (
            <>
              <h2 style={{ color: '#00ff88', marginTop: 24 }}>Available to lay</h2>
              {layerMessage && <p style={{ color: '#00ff88' }}>{layerMessage}</p>}
              {availableToLay.map(b => {
                const remaining = getLayable(b);
                const currentBid = parseFloat(bidAmount[b.id] || 0);
                const liability = currentBid > 0 ? calcLiability(currentBid, b.odds).toFixed(2) : '0.00';
                return (
                  <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontWeight: 600 }}>{b.event}</div>
                    <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — stake £{b.stake}</div>
                    <div style={{ color: '#ffb347', marginTop: 4 }}>Available to lay: £{remaining.toFixed(2)}</div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (remaining * 0.1).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: 5, cursor: 'pointer' }}>10%</button>
                      <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (remaining * 0.25).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: 5, cursor: 'pointer' }}>25%</button>
                      <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (remaining * 0.5).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: 5, cursor: 'pointer' }}>50%</button>
                      <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: remaining.toFixed(2) }))} style={{ background: '#2d6a4f', color: 'white', padding: '6px 10px', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Full</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <input type="number" placeholder="Your lay amount" value={bidAmount[b.id] || ''} onChange={e => setBidAmount(prev => ({ ...prev, [b.id]: e.target.value }))} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                      <button type="button" onClick={() => submitLay(b)} style={{ padding: '10px 14px', background: '#0066cc', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Lay</button>
                    </div>
                    {currentBid > 0 && <div style={{ marginTop: 8, color: '#ff6b6b', fontWeight: 600 }}>Liability: £{liability}</div>}
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm('Reject this bet?')) return;
                        fetch(`${API}/api/bets/${b.id}/layer-bid`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ layerId: user.id, layerName: user.name, amount: 0, action: 'reject' }),
                        }).then(async res => {
                          const data = await res.json();
                          if (!res.ok || !data.success) setLayerMessage(data.error || 'Reject failed');
                          else { setLayerMessage('Bet rejected'); fetchBets(); }
                        }).catch(e => setLayerMessage(e.message));
                      }}
                      style={{ marginTop: 10, width: '100%', padding: 10, background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Reject Bet
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* ===== TAB: My Bets ===== */}
      {customerTab === 'bets' && (
        <>
  
          <CollapsibleSection title={`Active Bets (${activeBets.length})`} defaultOpen={false}>
            {activeBets.length === 0 && <p style={{ color: '#b0b0b0' }}>No active bets.</p>}
            {activeBets.map(b => {
              const matched = getMatched(b);
              return (
                <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                  <div style={{ marginTop: 6, color: '#00ff88' }}>Matched £{matched.toFixed(2)} of £{b.stake}</div>
                </div>
              );
            })}
          </CollapsibleSection>

          <CollapsibleSection title={`Settled Bets (${settledBets.length})`} defaultOpen={false}>
            {settledBets.length === 0 && <p style={{ color: '#b0b0b0' }}>No settled bets.</p>}
            {settledBets.map(b => {
              const matched = getMatched(b);
              const originalStake = Number(b.stake) || 0;
              const isPartial = matched > 0.01 && matched < originalStake - 0.01;
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
              let resultLabel = 'LOST';
              let resultColor = '#ff6b6b';
              if (isWon) { resultLabel = 'WON'; resultColor = '#00ff88'; }
              else if (isManual) { resultLabel = 'SETTLED (Manual)'; resultColor = '#ffb347'; }

              return (
                <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds}</div>
                  <div style={{ marginTop: 6, fontSize: 14, color: '#b0b0b0' }}>
                    Original stake: £{originalStake.toFixed(2)}
                    {isPartial && <span style={{ color: '#ffb347' }}> — Partially matched £{matched.toFixed(2)}</span>}
                    {!isPartial && matched > 0.01 && <span> — Fully matched £{matched.toFixed(2)}</span>}
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 600, color: resultColor }}>
                    {resultLabel}{isWon && returns > 0 ? ` — Returns £${returns.toFixed(2)}` : ''}
                  </div>
                  {b.settlementNotes && <div style={{ fontSize: 14, color: '#ffb347', marginTop: 4 }}>Note: {b.settlementNotes}</div>}
                  <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>
                    Settled: {b.settledAt ? new Date(b.settledAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}
                  </div>
                </div>
              );
            })}
          </CollapsibleSection>

          <CollapsibleSection title={`Not Accepted (${rejectedBets.length})`} defaultOpen={false}>
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
      )}

      {/* ===== TAB: My Lays ===== */}
      {customerTab === 'lays' && user.canLay && (
        <>
          <CollapsibleSection title={`Open Lays (${openLays.length})`} defaultOpen={openLays.length > 0}>
            {openLays.length === 0 && <p style={{ color: '#b0b0b0' }}>No open lays.</p>}
            {openLays.map(b => {
              const myBid = (b.layerBids || []).find(l => Number(l.layerId) === Number(user.id));
              const laid = parseFloat(myBid?.actualLaid ?? myBid?.amount) || 0;
              const liability = calcLiability(laid, b.odds);
              const hasApportioned = myBid?.actualLaid != null;
              return (
                <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — stake £{b.stake}</div>
                  <div style={{ marginTop: 6, color: '#00ff88' }}>
                    Your lay: £{laid.toFixed(2)}{hasApportioned ? ' (apportioned)' : ' (awaiting apportioning)'}
                  </div>
                  <div style={{ marginTop: 4, color: '#ff6b6b', fontWeight: 600 }}>Liability: £{liability.toFixed(2)}</div>
                </div>
              );
            })}
          </CollapsibleSection>

          <CollapsibleSection title={`Settled Lays (${settledLays.length})`} defaultOpen={false}>
            {settledLays.length === 0 && <p style={{ color: '#b0b0b0' }}>No settled lays yet.</p>}
            {settledLays.map(b => {
              const myBid = (b.layerBids || []).find(l => Number(l.layerId) === Number(user.id));
              const laid = parseFloat(myBid?.actualLaid ?? myBid?.amount) || 0;
              const liability = calcLiability(laid, b.odds);
              const isWon = b.result === 'won';
              const isManual = b.result === 'manual';
              let resultLabel = 'YOU WON';
              let resultColor = '#00ff88';
              if (isWon) { resultLabel = 'YOU LOST'; resultColor = '#ff6b6b'; }
              else if (isManual) { resultLabel = 'SETTLED (Manual)'; resultColor = '#ffb347'; }
              return (
                <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>{b.selection} @ {b.odds} — stake £{b.stake}</div>
                  <div style={{ marginTop: 6 }}>Your lay: £{laid.toFixed(2)}</div>
                  <div style={{ marginTop: 4, fontWeight: 600, color: resultColor }}>
                    {resultLabel}
                    {!isManual && isWon && ` — Lost £${liability.toFixed(2)}`}
                    {!isManual && !isWon && ` — Won £${laid.toFixed(2)}`}
                  </div>
                  {b.settlementNotes && <div style={{ fontSize: 14, color: '#ffb347', marginTop: 4 }}>Note: {b.settlementNotes}</div>}
                  <div style={{ fontSize: 14, color: '#999', marginTop: 4 }}>
                    Settled: {b.settledAt ? new Date(b.settledAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}
                  </div>
                </div>
              );
            })}
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}