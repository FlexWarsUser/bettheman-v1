import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const MOCK_USERS = [
  { id: 0, name: "House", canLay: true },
  { id: 1, name: "Alex Rivera", canLay: true },
  { id: 2, name: "Jordan Hale", canLay: false },
  { id: 3, name: "Sam Patel", canLay: true },
  { id: 4, name: "Taylor Quinn", canLay: false },
  { id: 5, name: "Morgan Lee", canLay: true },
  { id: 6, name: "Casey Brooks", canLay: false },
];

function Countdown({ endTime, onExpire }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!endTime) return;
    const interval = setInterval(() => {
      const remaining = new Date(endTime).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft('EXPIRED');
        clearInterval(interval);
        if (onExpire) onExpire();
      } else {
        setTimeLeft(`${Math.floor(remaining / 1000)}s left`);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [endTime, onExpire]);
  return <span style={{ color: timeLeft === 'EXPIRED' ? '#ff6b6b' : '#ffb347', fontWeight: '600' }}>{timeLeft}</span>;
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '25px' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          background: '#252540',
          padding: '12px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: '600',
          fontSize: '15px',
          color: '#e8e8e8',
          border: '1px solid #3a3a5c'
        }}
      >
        {title} <span>{open ? '−' : '+'}</span>
      </div>
      {open && <div style={{ padding: '10px 0' }}>{children}</div>}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('punter');
const [currentUser, setCurrentUser] = useState(MOCK_USERS.find(u => u.id === 1) || MOCK_USERS[0]);
  const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '' });
  const [message, setMessage] = useState('');
  const [layerMessage, setLayerMessage] = useState('');
  const [allBets, setAllBets] = useState([]);
  const [partialAmount, setPartialAmount] = useState({});
  const [bidAmount, setBidAmount] = useState({});
  const [showBidConfirm, setShowBidConfirm] = useState(null);
    const [users, setUsers] = useState([]);
  const [balanceUserId, setBalanceUserId] = useState(1);
  const [balanceAmount, setBalanceAmount] = useState('');

  const fetchBets = async () => {
    try {
      const res = await fetch(`${API}/api/bets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAllBets(data);
      }
    } catch (e) {}
  };

   useEffect(() => {
    fetchBets();
    fetchUsers();
    const interval = setInterval(fetchBets, 1500);
    return () => clearInterval(interval);
  }, []);

    const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/api/users`);
      console.log('USERS status', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('USERS FROM API', data);
        if (Array.isArray(data)) setUsers(data);
      }
    } catch (e) {
      console.log('USERS ERROR', e);
    }
  };

  const adjustBalance = async (mode) => {
    if (!balanceAmount || parseFloat(balanceAmount) < 0) return alert('Enter a valid amount');
    try {
      const res = await fetch(`${API}/api/users/${balanceUserId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, amount: parseFloat(balanceAmount) })
      });
      if (!res.ok) {
        const t = await res.text();
        return alert('Failed: ' + t);
      }
      setBalanceAmount('');
      fetchUsers();
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };


  const handleSubmit = async (e) => {
  e.preventDefault();
  setMessage('');

  // Validate odds format
  const odds = String(bet.odds).trim();
  const isDecimal = /^\d+(\.\d+)?$/.test(odds);          // 5, 5.5, 2.75
  const isFractional = /^\d+\s*\/\s*\d+$/.test(odds);    // 5/1, 6/4, 7/2

  if (!isDecimal && !isFractional) {
    setMessage('Odds must be numerical (e.g. 5, 5.5, 2.75) or fractional (e.g. 5/1, 6/4, 7/2)');
    return;
  }

  try {
    const res = await fetch(`${API}/api/bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...bet, punterId: currentUser.id, punterName: currentUser.name }),
    });
    if (res.ok) {
      setMessage('Bet submitted');
      setBet({ event: '', selection: '', odds: '', stake: '' });
      fetchBets();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || 'Error submitting bet');
    }
  } catch (err) {
    setMessage('Error');
  }
};

  const handleHouseAction = async (betId, action, amount = null) => {
    let confirmMessage = '';
    if (action === 'Accepted') confirmMessage = 'Confirm ACCEPT full?';
    if (action === 'Partial') confirmMessage = `Confirm accept £${amount}?`;
    if (action === 'Rejected') confirmMessage = 'Confirm REJECT?';
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    try {
      const body = { action };
      if (amount) body.amount = parseFloat(amount);
      await fetch(`${API}/api/bets/${betId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      fetchBets();
    } catch (err) {
      alert('Action failed');
    }
  };
const handleSettle = async (betId, result) => {
  const label = result === 'won' ? 'WON' : 'LOST';
  if (!window.confirm(`Mark this bet as ${label}? Balances will be updated.`)) return;
  try {
    const res = await fetch(`${API}/api/bets/${betId}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return alert(data.error || 'Settlement failed');
    }
    fetchBets();
    fetchUsers();
  } catch (err) {
    alert('Settlement failed');
  }
};

const openManualSettle = (bet) => {
  const notes = window.prompt('Settlement notes (e.g. Dead heat, Rule 4, Void):', '');
  if (notes === null) return;

  const punterDeltaStr = window.prompt('Punter balance change (e.g. 50 to credit, -20 to debit, 0 for none):', '0');
  if (punterDeltaStr === null) return;
  const punterDelta = parseFloat(punterDeltaStr) || 0;

  const houseDeltaStr = window.prompt('House balance change:', '0');
  if (houseDeltaStr === null) return;
  const houseDelta = parseFloat(houseDeltaStr) || 0;

  // Simple version: one combined note; layer adjustments can be done later via Admin if needed
  handleManualSettle(bet.id, notes, { punterDelta, houseDelta, layers: [] });
};

const handleManualSettle = async (betId, notes, manualPayouts) => {
  try {
    const res = await fetch(`${API}/api/bets/${betId}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: 'manual', notes, manualPayouts }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return alert(data.error || 'Manual settlement failed');
    }
    fetchBets();
    fetchUsers();
  } catch (err) {
    alert('Manual settlement failed');
  }
};
  const performLayerAction = async (betId, amount, action = 'bid') => {
    try {
      const res = await fetch(`${API}/api/bets/${betId}/layer-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layerId: currentUser.id,
          layerName: currentUser.name,
          amount: parseFloat(amount),
          action
        }),
      });
      if (res.ok) {
        setLayerMessage(action === 'reject' ? 'Bet rejected' : 'Bid submitted - awaiting apportioning');
        setTimeout(() => setLayerMessage(''), 4000);
        fetchBets();
      } else {
        alert('Layer action failed');
      }
    } catch (err) {
      alert('Layer action failed');
    }
  };

  const openBidConfirm = (betId, amount) => {
    if (!amount || parseFloat(amount) <= 0) return alert('Enter valid amount');
    setShowBidConfirm({ betId, amount: parseFloat(amount) });
  };

  const confirmLayerBid = async () => {
    if (!showBidConfirm) return;
    await performLayerAction(showBidConfirm.betId, showBidConfirm.amount, 'bid');
    setShowBidConfirm(null);
  };

  const handleLayerReject = async (betId) => {
    if (!window.confirm('Reject this bet?')) return;
    await performLayerAction(betId, 0, 'reject');
  };

  const handleLayerAcceptFull = async (betId) => {
    const b = allBets.find(x => x.id === betId);
    if (!b) return;
    const remaining = Math.max(0, parseFloat(b.stake) - (parseFloat(b.houseAmount) || 0));
    if (remaining <= 0) return;
    if (!window.confirm(`Accept full remaining £${remaining}?`)) return;
    await performLayerAction(betId, remaining);
  };

  const getLayableAmount = (b) => Math.max(0, parseFloat(b.stake) - (parseFloat(b.houseAmount) || 0));

  const getExposure = (stake, oddsStr) => {
    const s = parseFloat(stake);
    if (!s) return '0.00';
    const str = String(oddsStr).trim();
    if (str.includes('/')) {
      const [n, d] = str.split('/');
      const num = parseFloat(n);
      const den = parseFloat(d) || 1;
      return (s * (num / den)).toFixed(2);
    }
    const o = parseFloat(str);
    return o > 1 ? (s * (o - 1)).toFixed(2) : '0.00';
  };
const getMyExposure = (userId) => {
  let total = 0;
  for (const b of allBets) {
    if (b.status === 'rejected') continue;
    if (b.phase === 'settled' || b.settledAt) continue;
    const bid = (b.layerBids || []).find(l => Number(l.layerId) === Number(userId) && !l.rejected);
    if (!bid) continue;
    const amt = parseFloat(bid.actualLaid != null ? bid.actualLaid : bid.amount) || 0;
    if (amt <= 0) continue;
    total += parseFloat(getExposure(amt, b.odds)) || 0;
  }
  return total;
};
const getHouseExposure = () => {
  let total = 0;
  for (const b of allBets) {
    if (b.status === 'rejected') continue;
    if (b.phase === 'settled' || b.settledAt) continue;   // only skip settled
    const houseAmt = parseFloat(b.houseAmount) || 0;
    if (houseAmt <= 0) continue;
    total += parseFloat(getExposure(houseAmt, b.odds)) || 0;
  }
  return total;
};
  const pendingReview = allBets.filter(b => b.phase === 'house_review').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const layerBidding = allBets.filter(b =>
    b.phase === 'layer_bidding' &&
    currentUser &&
    Number(b.punterId) !== Number(currentUser.id) &&
    !(b.layerBids || []).some(l => Number(l.layerId) === Number(currentUser.id))
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

const activeBets = allBets.filter(b => {
  if (b.phase !== 'finalized') return false;   // only show when fully finished
  const houseLaid = parseFloat(b.houseAmount) || 0;
  const layersLaid = (b.layerBids || []).reduce((sum, l) => sum + (parseFloat(l.actualLaid) || 0), 0);
  return (houseLaid + layersLaid) > 0.01;
}).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const settledBets = allBets.filter(b => b.phase === 'settled').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const rejectedBets = allBets.filter(b => {
    if (b.punterId !== currentUser.id) return false;
    const houseLaid = parseFloat(b.houseAmount) || 0;
    const layersLaid = (b.layerBids || []).reduce((sum, l) => sum + (parseFloat(l.actualLaid) || 0), 0);
    if (houseLaid + layersLaid > 0) return false;
    return b.status === 'rejected' || (b.phase === 'finalized' && houseLaid + layersLaid === 0);
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const residualBets = allBets.filter(b => {
    if (b.phase !== 'house_residual') return false;
    const houseLaid = parseFloat(b.houseAmount) || 0;
    const layerTotal = (b.layerBids || []).reduce((sum, bid) => sum + (parseFloat(bid.actualLaid) || parseFloat(bid.amount) || 0), 0);
    const residual = Math.max(0, Math.round((parseFloat(b.residualStake) || (parseFloat(b.stake) - houseLaid - layerTotal)) * 100) / 100);
    return residual >= 0.01;
  });

const card = { 
  background: '#181b21', 
  border: '1px solid #2a2e36', 
  padding: '12px 14px', 
  margin: '6px 0', 
  borderRadius: '6px',
  fontSize: '13px'
};
const cardGreen = { ...card, borderLeft: '3px solid #22c55e' };
const cardYellow = { ...card, borderLeft: '3px solid #f59e0b', background: '#1c1a16' };
const cardRed = { ...card, borderLeft: '3px solid #ef4444' };
const muted = { color: '#94a3b8', fontSize: '12px' };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '30px 20px', fontFamily: 'system-ui, sans-serif', color: '#e8e8e8' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#00ff88' }}>BetTheMan</h1>

      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
      {activeTab !== 'admin' && (
  <select
    value={currentUser.id}
    onChange={(e) => setCurrentUser(MOCK_USERS.find(u => u.id === parseInt(e.target.value)))}
    style={{ background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', padding: '8px 12px', borderRadius: '6px' }}
  >
{MOCK_USERS
  .filter(u => u.id !== 0)
  .map(u => (
        <option key={u.id} value={u.id}>
          {u.name} {u.canLay ? "★" : ""}
        </option>
      ))}
  </select>
)}
        <div style={{ marginTop: '8px', color: '#00ff88', fontWeight: '600' }}>
                  <div style={{ marginTop: '8px', fontWeight: '600' }}>
<span style={{ color: '#00ff88' }}>
  Balance: £{Number(
    users.find(u => Number(u.id) === Number(activeTab === 'house' ? 0 : currentUser.id))?.balance ?? 0
  ).toFixed(2)}
</span>
{(activeTab === 'house' || currentUser.canLay) && (
  <span style={{ color: '#ff6b6b', marginLeft: '16px' }}>
    Open Lays Exposure: £{(
      activeTab === 'house' 
        ? getHouseExposure() 
        : getMyExposure(currentUser.id)
    ).toFixed(2)}
  </span>
)}

        </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
  {['punter', 'house', 'layer', 'admin'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? '#00ff88' : '#252540',
              color: activeTab === tab ? '#0f0c29' : '#e8e8e8',
              border: '1px solid #3a3a5c',
              padding: '10px 18px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'punter' && (
        <div>
          <h2 style={{ color: '#00ff88' }}>Place Bet</h2>
          <form onSubmit={handleSubmit} style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {['event', 'selection', 'odds', 'stake'].map(field => (
  <input
    key={field}
    type="text"
    placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
    value={bet[field]}
    onChange={e => setBet({ ...bet, [field]: e.target.value })}
    required
    style={{ background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', padding: '12px', borderRadius: '8px' }}
  />
))}
            <button type="submit" style={{ background: '#00ff88', color: '#0f0c29', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
              Submit Bet
            </button>
          </form>
         {message && (
  <p style={{ 
    textAlign: 'center', 
    marginTop: '15px', 
    fontWeight: 'bold', 
    color: message.includes('Odds must') || message.includes('Error') ? '#ff6b6b' : '#00ff88' 
  }}>
    {message}
  </p>
)}

<CollapsibleSection title="Pending Bets" defaultOpen={true}>
{allBets.filter(b =>
  b.punterId === currentUser.id &&
  b.phase !== 'finalized' &&
  b.phase !== 'settled' &&
  !b.settledAt &&
  b.status !== 'rejected'
).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(b => (
              <div key={b.id} style={card}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ fontSize: '12px', color: '#ffb347', fontWeight: '600' }}>Pending</div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  Submitted: {b.createdAt ? new Date(b.createdAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Active Bets" defaultOpen={true}>
            {activeBets.filter(b => b.punterId === currentUser.id).map(b => {
              const houseLaid = parseFloat(b.houseAmount) || 0;
              const layersLaid = (b.layerBids || []).reduce((sum, l) => sum + (parseFloat(l.actualLaid) || 0), 0);
              const totalLaid = houseLaid + layersLaid;
              const isFull = totalLaid >= parseFloat(b.stake) - 0.01;
              return (
                <div key={b.id} style={cardGreen}>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                  <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                  <div style={{ marginTop: '5px', color: '#00ff88', fontWeight: '600' }}>
                    {isFull ? 'Accepted in Full' : totalLaid > 0 ? `Partially Laid (£${totalLaid.toFixed(2)} of £${b.stake})` : `£0 of £${b.stake}`}
                  </div>
                  {(houseLaid > 0 || layersLaid > 0) && (
                    <div style={{ fontSize: '12px', color: '#b0b0b0', marginTop: '4px' }}>
                      House: £{houseLaid.toFixed(2)} | Layers: £{layersLaid.toFixed(2)}
                    </div>
                  )}
                  {b.acceptedAt && (
                    <div style={{ fontSize: '12px', color: '#00ff88' }}>
                      Accepted: {new Date(b.acceptedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' }) + ' UTC'}
                    </div>
                  )}
                </div>
              );
            })}
          </CollapsibleSection>

<CollapsibleSection title="Settled Bets" defaultOpen={true}>
  {allBets
    .filter(b => b.punterId === currentUser.id && (b.phase === 'settled' || b.settledAt))
    .sort((a, b) => new Date(b.settledAt || b.createdAt) - new Date(a.settledAt || a.createdAt))
    .map(b => {
      const houseLaid = parseFloat(b.houseAmount) || 0;
      const layersLaid = (b.layerBids || []).reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
      const matched = houseLaid + layersLaid;
      return (
        <div key={b.id} style={card}>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
          <div style={muted}>{b.selection} @ {b.odds} — Stake £{b.stake}</div>
          <div style={{ marginTop: '6px', fontSize: '13px' }}>
            Matched: £{matched.toFixed(2)} (House £{houseLaid.toFixed(2)} | Layers £{layersLaid.toFixed(2)})
          </div>
          <div style={{ marginTop: '6px', fontWeight: '600', color: b.result === 'won' ? '#00ff88' : b.result === 'lost' ? '#ff6b6b' : '#ffb347' }}>
            Result: {(b.result || 'settled').toUpperCase()}
          </div>
          {b.settlementNotes && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Notes: {b.settlementNotes}</div>
          )}
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            Placed: {b.createdAt ? new Date(b.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
            Settled: {b.settledAt ? new Date(b.settledAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
          </div>
        </div>
      );
    })}
</CollapsibleSection>

          <CollapsibleSection title="Not Accepted / Rejected" defaultOpen={true}>
            {rejectedBets.map(b => {
              const houseLaid = parseFloat(b.houseAmount) || 0;
              return (
                <div key={b.id} style={cardRed}>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                  <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                  <div style={{ marginTop: '5px', color: '#ff6b6b', fontWeight: '600' }}>Not Accepted / Rejected</div>
                  <div style={{ fontSize: '13px', color: '#b0b0b0', marginTop: '8px' }}>
                    House: £{houseLaid.toFixed(2)}{b.houseAction && ` (${b.houseAction})`}
                  </div>
                </div>
              );
            })}
          </CollapsibleSection>
        </div>
      )}
            {activeTab === 'house' && (
        <div>
          {/* RESIDUAL ALWAYS AT THE TOP */}
          <CollapsibleSection title="🔄 Residual Bets (House Second Look)" defaultOpen={true}>
            {residualBets.length === 0 && <p style={muted}>No residual bets waiting.</p>}
            {residualBets.map(b => {
              const houseLaid = parseFloat(b.houseAmount) || 0;
              const layerTotal = (b.layerBids || []).reduce((sum, bid) => sum + (parseFloat(bid.actualLaid) || parseFloat(bid.amount) || 0), 0);
              const residual = Math.max(0, Math.round((parseFloat(b.residualStake) || (parseFloat(b.stake) - houseLaid - layerTotal)) * 100) / 100);
              return (
                <div key={b.id} style={{ ...cardYellow, border: '2px solid #ff9800' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event} — RESIDUAL</div>
                  <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                  <div style={{ marginTop: '8px', fontSize: '13px' }}>
                    <strong>Already Laid:</strong> House £{houseLaid.toFixed(2)} + Layers £{layerTotal.toFixed(2)} = £{(houseLaid + layerTotal).toFixed(2)}
                  </div>
                  <div style={{ color: '#ff6b6b', fontWeight: '700', marginTop: '4px' }}>
                    Residual to decide: £{residual.toFixed(2)}
                  </div>
                  {b.layerBids && b.layerBids.length > 0 && (
                    <div style={{ fontSize: '12px', background: '#1a1a2e', padding: '8px', marginTop: '8px', borderRadius: '6px', border: '1px solid #3a3a5c' }}>
                      <strong>Layer Bids so far:</strong><br />
                      {(b.layerBids || []).map((l, i) => (
                        <div key={i}>• {l.layerName}: £{l.amount} (apportioned £{(l.actualLaid || 0).toFixed(2)})</div>
                      ))}
                    </div>
                  )}
                  {b.houseTimerEnd && (
                    <div style={{ marginTop: '8px', color: '#ffb347' }}>
                      Time left for residual: <Countdown endTime={b.houseTimerEnd} />
                    </div>
                  )}
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleHouseAction(b.id, 'Accepted', residual)} style={{ background: '#2d6a4f', color: 'white', flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      Accept Residual Full
                    </button>
                    <button onClick={() => handleHouseAction(b.id, 'Rejected')} style={{ background: '#7f1d1d', color: 'white', flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                      Reject Residual
                    </button>
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <input type="number" placeholder="Partial residual amount" value={partialAmount[b.id] || ''} onChange={e => setPartialAmount({ ...partialAmount, [b.id]: e.target.value })} style={{ flex: 1, padding: '9px', background: '#1a1a2e', color: '#e8e8e8', border: '1px solid #3a3a5c', borderRadius: '6px' }} />
                    <button onClick={() => handleHouseAction(b.id, 'Partial', partialAmount[b.id])} style={{ background: '#d4a017', color: '#0f0c29', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                      Accept Partial Residual
                    </button>
                  </div>
                </div>
              );
            })}
          </CollapsibleSection>

          <h2 style={{ color: '#00ff88' }}>Pending House Review</h2>
         
          {pendingReview.length === 0 && <p style={muted}>No bets waiting.</p>}
          {pendingReview.map(b => {
            const exposure = getExposure(b.stake, b.odds);
            return (
              <div key={b.id} style={cardYellow}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ color: '#999' }}>by {b.punterName}</div>
                <div style={{ marginTop: '6px', color: '#ff6b6b', fontWeight: '600' }}>Exposure: £{exposure}</div>
                {b.houseTimerEnd && (
                  <div style={{ marginTop: '6px' }}>Time left: <Countdown endTime={b.houseTimerEnd} /></div>
                )}
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleHouseAction(b.id, 'Accepted')} style={{ background: '#2d6a4f', color: 'white', flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Accept Full</button>
                  <button onClick={() => handleHouseAction(b.id, 'Rejected')} style={{ background: '#7f1d1d', color: 'white', flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Reject</button>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleHouseAction(b.id, 'Partial', (parseFloat(b.stake) * 0.1).toFixed(2))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>10%</button>
                  <button onClick={() => handleHouseAction(b.id, 'Partial', (parseFloat(b.stake) * 0.25).toFixed(2))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>25%</button>
                  <button onClick={() => handleHouseAction(b.id, 'Partial', (parseFloat(b.stake) * 0.5).toFixed(2))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>50%</button>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <input type="number" placeholder="Partial amount" value={partialAmount[b.id] || ''} onChange={e => setPartialAmount({ ...partialAmount, [b.id]: e.target.value })} style={{ flex: 1, padding: '9px', background: '#1a1a2e', color: '#e8e8e8', border: '1px solid #3a3a5c', borderRadius: '6px' }} />
                  <button onClick={() => handleHouseAction(b.id, 'Partial', partialAmount[b.id])} style={{ background: '#d4a017', color: '#0f0c29', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Accept Partial</button>
                </div>
              </div>
            );
          })}

          <CollapsibleSection title="Active Lays" defaultOpen={true}>
            {activeBets.filter(b => parseFloat(b.houseAmount) > 0).map(b => (
              <div key={b.id} style={cardGreen}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ marginTop: '4px', color: '#00ff88', fontWeight: '600' }}>
                  {parseFloat(b.houseAmount) === parseFloat(b.stake)
                    ? 'Laid in Full'
                    : `Partially Laid (£${b.houseAmount} of £${b.stake})`}
                </div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  Accepted: {(b.houseActedAt || b.acceptedAt)
                    ? new Date(b.houseActedAt || b.acceptedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' }) + ' UTC'
                    : 'N/A'}
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Rejected / Not Accepted Bets" defaultOpen={true}>
            {allBets
              .filter(b => {
                const houseLaid = parseFloat(b.houseAmount) || 0;
                const layersLaid = (b.layerBids || []).reduce((sum, l) => sum + (parseFloat(l.actualLaid) || 0), 0);
                const totalLaid = houseLaid + layersLaid;
                if (totalLaid > 0.01) return false;
                if (b.status === 'rejected') return true;
                if (b.phase === 'finalized' && totalLaid <= 0.01) return true;
                return false;
              })
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map(b => {
                const houseLaid = parseFloat(b.houseAmount) || 0;
                const layersLaid = (b.layerBids || []).reduce((sum, l) => sum + (parseFloat(l.actualLaid) || 0), 0);
                return (
                  <div key={b.id} style={cardRed}>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                    <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                    <div style={{ color: '#999', fontSize: '13px' }}>by {b.punterName}</div>
                    <div style={{ marginTop: '6px', color: '#ff6b6b', fontWeight: '600' }}>
                      Rejected by House
                      {layersLaid > 0 ? ' (later covered by Layers)' : ''}
                    </div>
                    <div style={{ fontSize: '13px', color: '#b0b0b0', marginTop: '4px' }}>
                      House laid: £{houseLaid.toFixed(2)}
                    </div>
                    {layersLaid > 0 && (
                      <div style={{ fontSize: '13px', color: '#00ff88', marginTop: '4px' }}>
                        Layers laid: £{layersLaid.toFixed(2)}
                      </div>
                    )}
                    {b.layerBids && b.layerBids.filter(l => !l.rejected).length > 0 && (
                      <div style={{ fontSize: '12px', marginTop: '4px', color: '#999' }}>
                        Layers: {b.layerBids.filter(l => !l.rejected).map(l =>
                          `${l.layerName} £${l.amount}${l.actualLaid !== undefined ? ` → £${parseFloat(l.actualLaid).toFixed(2)}` : ''}`
                        ).join(', ')}
                      </div>
                    )}
                    {(houseLaid + layersLaid) === 0 && (
                      <div style={{ fontSize: '12px', color: '#777' }}>Nothing was laid</div>
                    )}
                  </div>
                );
              })}
            {allBets.filter(b => b.status === 'rejected' || (b.houseAction === 'Rejected' && b.phase === 'finalized')).length === 0 && (
              <p style={muted}>No rejected bets yet.</p>
            )}
          </CollapsibleSection>

<CollapsibleSection title="Resulted Lays" defaultOpen={false}>
  {allBets
    .filter(b => (b.phase === 'settled' || b.settledAt) && parseFloat(b.houseAmount) > 0)
    .sort((a, b) => new Date(b.settledAt || b.createdAt) - new Date(a.settledAt || a.createdAt))
    .map(b => {
      const houseLaid = parseFloat(b.houseAmount) || 0;
      const layersLaid = (b.layerBids || []).reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
      return (
        <div key={b.id} style={card}>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
          <div style={muted}>{b.selection} @ {b.odds} — Stake £{b.stake}</div>
          <div style={{ marginTop: '6px', fontSize: '13px' }}>
            House laid: £{houseLaid.toFixed(2)} | Layers: £{layersLaid.toFixed(2)}
          </div>
          <div style={{ marginTop: '6px', fontWeight: '600', color: b.result === 'won' ? '#ff6b6b' : b.result === 'lost' ? '#00ff88' : '#ffb347' }}>
            {/* From House view: punter won = house lost */}
            Result: {b.result === 'won' ? 'PUNTER WON (House lost)' : b.result === 'lost' ? 'PUNTER LOST (House won)' : (b.result || 'SETTLED').toUpperCase()}
          </div>
          {b.settlementNotes && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Notes: {b.settlementNotes}</div>
          )}
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            Placed: {b.createdAt ? new Date(b.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
            Settled: {b.settledAt ? new Date(b.settledAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
          </div>
        </div>
      );
    })}
</CollapsibleSection>
        </div>
      )}
    {activeTab === 'admin' && (
  <div>
 

<h2 style={{ color: '#00ff88' }}>Settlement</h2>

    <CollapsibleSection title="Awaiting Settlement" defaultOpen={true}>
      {allBets.filter(b => b.phase === 'finalized' && !b.settledAt).length === 0 && (
        <p style={muted}>No bets waiting to be settled.</p>
      )}
      {allBets
        .filter(b => b.phase === 'finalized' && !b.settledAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(b => {
          const houseLaid = parseFloat(b.houseAmount) || 0;
          const layersLaid = (b.layerBids || []).reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
          const matched = houseLaid + layersLaid;
          return (
            <div key={b.id} style={cardYellow}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
              <div style={muted}>{b.selection} @ {b.odds} — Stake £{b.stake}</div>
              <div style={{ marginTop: '6px', fontSize: '13px' }}>
                Matched: £{matched.toFixed(2)} (House £{houseLaid.toFixed(2)} + Layers £{layersLaid.toFixed(2)})
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Punter: {b.punterName}
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleSettle(b.id, 'won')}
                  style={{ background: '#2d6a4f', color: 'white', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Won
                </button>
                <button
                  onClick={() => handleSettle(b.id, 'lost')}
                  style={{ background: '#7f1d1d', color: 'white', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Lost
                </button>
                <button
                  onClick={() => openManualSettle(b)}
                  style={{ background: '#3a3a5c', color: 'white', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Manual
                </button>
              </div>
            </div>
          );
        })}
    </CollapsibleSection>

    <CollapsibleSection title="Already Settled" defaultOpen={false}>
      {allBets.filter(b => b.settledAt).length === 0 && (
        <p style={muted}>No settled bets yet.</p>
      )}
      {allBets
        .filter(b => b.settledAt)
        .sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt))
        .map(b => (
          <div key={b.id} style={card}>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
            <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
            <div style={{ marginTop: '6px', fontWeight: '600', color: b.result === 'won' ? '#00ff88' : b.result === 'lost' ? '#ff6b6b' : '#ffb347' }}>
              Result: {(b.result || '').toUpperCase()}
            </div>
            {b.settlementNotes && (
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Notes: {b.settlementNotes}</div>
            )}
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              Settled: {new Date(b.settledAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
            </div>
          </div>
        ))}
    </CollapsibleSection>
    <CollapsibleSection title="Adjust Balances" defaultOpen={false}>
  <p style={{ color: '#b0b0b0', marginBottom: '12px', fontSize: '13px' }}>
    Offline payments only. Credit / debit / set balances here.
  </p>
  <div style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', padding: '16px', borderRadius: '8px', maxWidth: '420px' }}>
    <select
      value={balanceUserId}
      onChange={e => setBalanceUserId(parseInt(e.target.value))}
      style={{ background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', padding: '8px', borderRadius: '6px', width: '100%', marginBottom: '8px' }}
    >
      {users.map(u => (
        <option key={u.id} value={u.id}>{u.name} — £{Number(u.balance || 0).toFixed(2)}</option>
      ))}
    </select>
    <input
      type="number"
      placeholder="Amount"
      value={balanceAmount}
      onChange={e => setBalanceAmount(e.target.value)}
      style={{ background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', padding: '8px', borderRadius: '6px', width: '100%', marginBottom: '8px' }}
    />
    <div style={{ display: 'flex', gap: '8px' }}>
      <button type="button" onClick={() => adjustBalance('credit')} style={{ flex: 1, padding: '10px', background: '#2d6a4f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Credit</button>
      <button type="button" onClick={() => adjustBalance('debit')} style={{ flex: 1, padding: '10px', background: '#7f1d1d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Debit</button>
      <button type="button" onClick={() => adjustBalance('set')} style={{ flex: 1, padding: '10px', background: '#3a3a5c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Set</button>
    </div>
  </div>
</CollapsibleSection>
  </div>
)}

      {activeTab === 'layer' && currentUser?.canLay && (
        <div>
          <h2 style={{ color: '#00ff88' }}>Bets Available to Lay</h2>
          {layerMessage && <p style={{ color: '#00ff88', fontWeight: 'bold', textAlign: 'center', marginBottom: '15px' }}>{layerMessage}</p>}
          {layerBidding.length === 0 && <p style={muted}>No bets available for you to lay.</p>}
          {layerBidding.map(b => {
            const remaining = getLayableAmount(b);
            const currentBid = parseFloat(bidAmount[b.id] || 0);
            const liability = currentBid > 0 ? getExposure(currentBid, b.odds) : '0.00';
            return (
              <div key={b.id} style={card}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ marginTop: '8px', color: '#ffb347', fontWeight: '600' }}>
                  {b.phase === 'house_residual' ? 'RESIDUAL (House second look)' : 'Remaining'}: £{remaining}
                </div>
                {b.layerBids && b.layerBids.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    Current Layer bids: {(b.layerBids || []).filter(l => !l.rejected).map(l => `${l.layerName}: £${l.amount}`).join(', ')}
                  </div>
                )}
                {b.layerTimerEnd && (
                  <div style={{ marginTop: '6px' }}>Time left: <Countdown endTime={b.layerTimerEnd} /></div>
                )}
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                  <button onClick={() => setBidAmount(p => ({ ...p, [b.id]: (remaining * 0.1).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>10%</button>
                  <button onClick={() => setBidAmount(p => ({ ...p, [b.id]: (remaining * 0.25).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>25%</button>
                  <button onClick={() => setBidAmount(p => ({ ...p, [b.id]: (remaining * 0.5).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>50%</button>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                  <input type="number" placeholder="Bid amount (£)" value={bidAmount[b.id] || ''} onChange={e => setBidAmount(p => ({ ...p, [b.id]: e.target.value }))} style={{ flex: 1, padding: '10px', background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', borderRadius: '6px' }} />
                  <button onClick={() => openBidConfirm(b.id, bidAmount[b.id])} style={{ background: '#0066cc', color: 'white', padding: '10px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Place Bid</button>
                </div>
                <button onClick={() => handleLayerAcceptFull(b.id)} style={{ marginTop: '10px', background: '#2d6a4f', color: 'white', width: '100%', padding: '10px', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Accept Full Remaining Stake</button>
                <button onClick={() => handleLayerReject(b.id)} style={{ marginTop: '8px', background: '#7f1d1d', color: 'white', width: '100%', padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Reject Bet</button>
                {currentBid > 0 && <div style={{ marginTop: '8px', color: '#ff6b6b', fontWeight: '600' }}>Liability: £{liability}</div>}
              </div>
            );
          })}

          <CollapsibleSection title="Lays in Process" defaultOpen={true}>
            {allBets.filter(b => b.layerBids && b.layerBids.some(l => l.layerId === currentUser.id && !l.rejected)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(b => {
              const myBid = b.layerBids.find(l => l.layerId === currentUser.id);
              const hasApportioned = myBid && myBid.actualLaid !== undefined && myBid.actualLaid !== null;
              return (
                <div key={b.id} style={cardGreen}>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                  <div style={muted}>{b.selection} @ {b.odds} — £{b.stake}</div>
                  <div style={{ marginTop: '8px', color: '#00ff88', fontWeight: '600' }}>
                    {hasApportioned ? 'Apportioned' : 'Bid Submitted - Awaiting Apportioning'}
                  </div>
                  {hasApportioned && (
                    <div style={{ marginTop: '8px', color: '#00ff88', fontSize: '14px' }}>
                      <strong>Your Apportioned Amount: £{parseFloat(myBid.actualLaid).toFixed(2)}</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </CollapsibleSection>
          <CollapsibleSection title="Resulted Lays" defaultOpen={false}>
  {allBets
    .filter(b =>
      (b.phase === 'settled' || b.settledAt) &&
      (b.layerBids || []).some(l => Number(l.layerId) === Number(currentUser.id) && !l.rejected)
    )
    .sort((a, b) => new Date(b.settledAt || b.createdAt) - new Date(a.settledAt || a.createdAt))
    .map(b => {
      const myBid = (b.layerBids || []).find(l => Number(l.layerId) === Number(currentUser.id));
      const myLaid = parseFloat(myBid?.actualLaid ?? myBid?.amount) || 0;
      return (
        <div key={b.id} style={card}>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
          <div style={muted}>{b.selection} @ {b.odds} — Stake £{b.stake}</div>
          <div style={{ marginTop: '6px', fontSize: '13px' }}>
            Your lay: £{myLaid.toFixed(2)}
          </div>
          <div style={{ marginTop: '6px', fontWeight: '600', color: b.result === 'won' ? '#ff6b6b' : b.result === 'lost' ? '#00ff88' : '#ffb347' }}>
            Result: {b.result === 'won' ? 'PUNTER WON (You lost)' : b.result === 'lost' ? 'PUNTER LOST (You won)' : (b.result || 'SETTLED').toUpperCase()}
          </div>
          {b.settlementNotes && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Notes: {b.settlementNotes}</div>
          )}
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            Placed: {b.createdAt ? new Date(b.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
            Settled: {b.settledAt ? new Date(b.settledAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
          </div>
        </div>
      );
    })}
</CollapsibleSection>
        </div>
      )}

      {showBidConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a2e', padding: '25px', borderRadius: '10px', maxWidth: '380px', width: '90%', border: '1px solid #3a3a5c', color: '#e8e8e8' }}>
            <h3 style={{ color: '#00ff88' }}>Confirm Layer Bid</h3>
            <p>Lay £{showBidConfirm.amount}?</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowBidConfirm(null)} style={{ flex: 1, padding: '10px', background: '#3a3a5c', color: '#e8e8e8', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmLayerBid} style={{ flex: 1, padding: '10px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Confirm Bid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;