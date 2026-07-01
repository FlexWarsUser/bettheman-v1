import { useState, useEffect } from 'react';

const MOCK_USERS = [
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
  return <span style={{ color: timeLeft === 'EXPIRED' ? '#dc3545' : '#ff8c00', fontWeight: '600' }}>{timeLeft}</span>;
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '25px' }}>
      <div 
        onClick={() => setOpen(!open)} 
        style={{ 
          background: '#f1f3f5', 
          padding: '12px 16px', 
          borderRadius: '8px', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontWeight: '600',
          fontSize: '15px'
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
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '' });
  const [message, setMessage] = useState('');
  const [allBets, setAllBets] = useState([]);
  const [partialAmount, setPartialAmount] = useState({});
  const [bidAmount, setBidAmount] = useState({});
  const [showBidConfirm, setShowBidConfirm] = useState(null);

  const fetchBets = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/bets');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAllBets(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchBets();
    const interval = setInterval(fetchBets, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bet, punterId: currentUser.id, punterName: currentUser.name }),
      });
      if (res.ok) {
        setMessage('Bet submitted');
        setBet({ event: '', selection: '', odds: '', stake: '' });
        fetchBets();
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
      await fetch(`http://localhost:3001/api/bets/${betId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      fetchBets();
    } catch (err) {
      alert('Action failed');
    }
  };

  const performLayerAction = async (betId, amount) => {
    try {
      const res = await fetch(`http://localhost:3001/api/bets/${betId}/layer-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layerId: currentUser.id,
          layerName: currentUser.name,
          amount: parseFloat(amount),
        }),
      });
      if (res.ok) {
        setAllBets(prev => prev.filter(b => b.id !== betId));
        setBidAmount(prev => { const n = {...prev}; delete n[betId]; return n; });
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
    await performLayerAction(showBidConfirm.betId, showBidConfirm.amount);
    setShowBidConfirm(null);
  };

  const handleLayerAcceptFull = async (betId) => {
    const bet = allBets.find(b => b.id === betId);
    if (!bet) return;
    const remaining = Math.max(0, parseFloat(bet.stake) - (parseFloat(bet.houseAmount) || 0));
    if (remaining <= 0) return;
    if (!window.confirm(`Accept full £${remaining}?`)) return;
    await performLayerAction(betId, remaining);
  };

  const getLayableAmount = (b) => Math.max(0, parseFloat(b.stake) - (parseFloat(b.houseAmount) || 0));

  const getExposure = (stake, oddsStr) => {
    const s = parseFloat(stake);
    if (!s) return '0.00';
    const str = String(oddsStr).trim();
    if (str.includes('/')) {
      const [n] = str.split('/');
      return (s * parseFloat(n)).toFixed(2);
    } else {
      const o = parseFloat(str);
      return o > 1 ? (s * (o - 1)).toFixed(2) : '0.00';
    }
  };

  const pendingReview = allBets.filter(b => b.phase === 'house_review').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const layerBidding = allBets.filter(b => b.phase === 'layer_bidding' && currentUser && b.punterId !== currentUser.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const activeBets = allBets.filter(b => b.houseAmount > 0 || b.phase === 'finalized' || b.status === 'active' || ['Accepted', 'Partial'].includes(b.houseAction)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const settledBets = allBets.filter(b => b.phase === 'settled').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const rejectedBets = allBets.filter(b => b.status === 'rejected' && b.punterId === currentUser.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '30px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>BetTheMan</h1>

      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <select value={currentUser.id} onChange={(e) => setCurrentUser(MOCK_USERS.find(u => u.id === parseInt(e.target.value)))}>
          {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.name} {u.canLay ? "★" : ""}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
        <button onClick={() => setActiveTab('punter')}>Punter</button>
        <button onClick={() => setActiveTab('house')}>House</button>
        <button onClick={() => setActiveTab('layer')}>Layer</button>
      </div>

      {activeTab === 'punter' && (
        <div>
          <h2>Place Bet</h2>
          <form onSubmit={handleSubmit} style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input placeholder="Event" value={bet.event} onChange={e => setBet({...bet, event: e.target.value})} required />
            <input placeholder="Selection" value={bet.selection} onChange={e => setBet({...bet, selection: e.target.value})} required />
            <input placeholder="Odds" value={bet.odds} onChange={e => setBet({...bet, odds: e.target.value})} required />
            <input type="number" placeholder="Stake" value={bet.stake} onChange={e => setBet({...bet, stake: e.target.value})} required />
            <button type="submit">Submit Bet</button>
          </form>
          {message && <p style={{ textAlign: 'center', marginTop: '15px', fontWeight: 'bold' }}>{message}</p>}

          <CollapsibleSection title="Pending Bets" defaultOpen={true}>
            {allBets.filter(b => b.punterId === currentUser.id && (b.status === 'pending' || b.phase === 'house_review' || b.phase === 'layer_bidding')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(b => (
              <div key={b.id} style={{ background: '#f8f9fa', border: '1px solid #e9ecef', padding: '14px', margin: '8px 0', borderRadius: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={{ color: '#555' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ fontSize: '12px', color: '#ff8c00', fontWeight: '600' }}>Pending</div>
                <div style={{ fontSize: '12px', color: '#555' }}>
                  Submitted: {b.createdAt ? new Date(b.createdAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Active Bets" defaultOpen={true}>
            {activeBets.filter(b => b.punterId === currentUser.id).map(b => (
              <div key={b.id} style={{ background: '#f8f9fa', border: '1px solid #28a745', padding: '14px', margin: '8px 0', borderRadius: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={{ color: '#555' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ marginTop: '5px', color: '#006400', fontWeight: '600' }}>
                  {b.houseAmount === parseFloat(b.stake) ? 'Accepted in Full' : `Partially Laid (£${b.houseAmount} of £${b.stake})`}
                </div>
                {b.acceptedAt && (
                  <div style={{ fontSize: '12px', color: '#006400' }}>
                    Accepted: {new Date(b.acceptedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' }) + ' UTC'}
                  </div>
                )}
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Settled Bets">
            {settledBets.filter(b => b.punterId === currentUser.id).map(b => (
              <div key={b.id} style={{ background: '#f8f9fa', border: '1px solid #6c757d', padding: '14px', margin: '8px 0', borderRadius: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={{ color: '#555' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ marginTop: '5px', color: '#555', fontWeight: '600' }}>Settled</div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Not Accepted / Rejected">
            {rejectedBets.map(b => (
              <div key={b.id} style={{ background: '#f8f9fa', border: '1px solid #dc3545', padding: '14px', margin: '8px 0', borderRadius: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={{ color: '#555' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ marginTop: '5px', color: '#dc3545', fontWeight: '600' }}>Not Accepted</div>
              </div>
            ))}
          </CollapsibleSection>
        </div>
      )}

      {activeTab === 'house' && (
        <div>
          <h2>Pending House Review</h2>
          {pendingReview.length === 0 && <p>No bets waiting.</p>}
          {pendingReview.map(b => {
            const exposure = getExposure(b.stake, b.odds);
            return (
              <div key={b.id} style={{ background: '#fff3cd', border: '1px solid #ffeaa7', padding: '16px', margin: '10px 0', borderRadius: '10px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={{ color: '#555' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ color: '#666' }}>by {b.punterName}</div>
                <div style={{ marginTop: '6px', color: '#c00', fontWeight: '600' }}>Exposure: £{exposure}</div>
                {b.houseTimerEnd && (
                  <div style={{ marginTop: '6px' }}>
                    Time left: <Countdown endTime={b.houseTimerEnd} />
                  </div>
                )}
                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleHouseAction(b.id, 'Accepted')} style={{ background: '#28a745', color: 'white', flex: 1, padding: '10px' }}>Accept Full</button>
                  <button onClick={() => handleHouseAction(b.id, 'Rejected')} style={{ background: '#dc3545', color: 'white', flex: 1, padding: '10px' }}>Reject</button>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleHouseAction(b.id, 'Partial', (parseFloat(b.stake) * 0.1).toFixed(2))} style={{ background: '#6c757d', color: 'white', padding: '6px 10px' }}>10%</button>
                  <button onClick={() => handleHouseAction(b.id, 'Partial', (parseFloat(b.stake) * 0.25).toFixed(2))} style={{ background: '#6c757d', color: 'white', padding: '6px 10px' }}>25%</button>
                  <button onClick={() => handleHouseAction(b.id, 'Partial', (parseFloat(b.stake) * 0.5).toFixed(2))} style={{ background: '#6c757d', color: 'white', padding: '6px 10px' }}>50%</button>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <input type="number" placeholder="Partial amount" value={partialAmount[b.id] || ''} onChange={e => setPartialAmount({...partialAmount, [b.id]: e.target.value})} style={{ flex: 1, padding: '9px' }} />
                  <button onClick={() => handleHouseAction(b.id, 'Partial', partialAmount[b.id])} style={{ background: '#ffc107', color: 'black', padding: '9px 14px' }}>Accept Partial</button>
                </div>
              </div>
            );
          })}

          <CollapsibleSection title="Active Lays" defaultOpen={true}>
            {activeBets.map(b => (
              <div key={b.id} style={{ background: '#f8f9fa', border: '1px solid #28a745', padding: '12px', margin: '8px 0', borderRadius: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={{ color: '#555' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ marginTop: '4px', color: '#006400', fontWeight: '600' }}>
                  {b.houseAmount === parseFloat(b.stake) ? 'Laid in Full' : `Partially Laid (£${b.houseAmount} of £${b.stake})`}
                </div>
                <div style={{ fontSize: '12px', color: '#555' }}>
                  Accepted: {b.acceptedAt ? new Date(b.acceptedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'N/A'}
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Resulted Lays">
            {settledBets.map(b => (
              <div key={b.id} style={{ background: '#f8f9fa', border: '1px solid #6c757d', padding: '12px', margin: '8px 0', borderRadius: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={{ color: '#555' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ marginTop: '4px', color: '#555', fontWeight: '600' }}>Resulted</div>
              </div>
            ))}
          </CollapsibleSection>
        </div>
      )}

      {activeTab === 'layer' && currentUser?.canLay && (
        <div>
          <h2>Bets Available to Lay</h2>
          {layerBidding.length === 0 && <p>No bets available for you to lay.</p>}
          {layerBidding.map(b => {
            const remaining = getLayableAmount(b);
            const currentBid = parseFloat(bidAmount[b.id] || 0);
            const liability = currentBid > 0 ? getExposure(currentBid, b.odds) : '0.00';
            return (
              <div key={b.id} style={{ background: '#f8f9fa', border: '1px solid #e9ecef', padding: '16px', margin: '10px 0', borderRadius: '10px' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
                <div style={{ color: '#555' }}>{b.selection} @ {b.odds} — £{b.stake}</div>
                <div style={{ marginTop: '8px', color: '#b36b00', fontWeight: '600' }}>Remaining: £{remaining}</div>

                {b.layerTimerEnd && (
                  <div style={{ marginTop: '6px' }}>
                    Time left: <Countdown endTime={b.layerTimerEnd} />
                  </div>
                )}

                <div style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                  <button onClick={() => setBidAmount(p => ({...p, [b.id]: (remaining*0.1).toFixed(2)}))} style={{background:'#6c757d',color:'white',padding:'6px 10px',borderRadius:'5px'}}>10%</button>
                  <button onClick={() => setBidAmount(p => ({...p, [b.id]: (remaining*0.25).toFixed(2)}))} style={{background:'#6c757d',color:'white',padding:'6px 10px',borderRadius:'5px'}}>25%</button>
                  <button onClick={() => setBidAmount(p => ({...p, [b.id]: (remaining*0.5).toFixed(2)}))} style={{background:'#6c757d',color:'white',padding:'6px 10px',borderRadius:'5px'}}>50%</button>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                  <input type="number" placeholder="Bid amount (£)" value={bidAmount[b.id] || ''} onChange={e => setBidAmount(p => ({...p, [b.id]: e.target.value}))} style={{flex:1, padding:'10px'}} />
                  <button onClick={() => openBidConfirm(b.id, bidAmount[b.id])} style={{background:'#0066cc',color:'white',padding:'10px 18px',borderRadius:'6px'}}>Place Bid</button>
                </div>

                <button onClick={() => handleLayerAcceptFull(b.id)} style={{marginTop:'10px', background:'#28a745', color:'white', width:'100%', padding:'10px', borderRadius:'6px', fontWeight:'600'}}>Accept Full Remaining Stake</button>

                {currentBid > 0 && <div style={{marginTop:'8px', color:'#c00', fontWeight:'600'}}>Liability: £{liability}</div>}
              </div>
            );
          })}
        </div>
      )}

      {showBidConfirm && (
        <div style={{position:'fixed', top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'white',padding:'25px',borderRadius:'10px',maxWidth:'380px',width:'90%'}}>
            <h3>Confirm Layer Bid</h3>
            <p>Lay £{showBidConfirm.amount}?</p>
            <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
              <button onClick={() => setShowBidConfirm(null)} style={{flex:1,padding:'10px'}}>Cancel</button>
              <button onClick={confirmLayerBid} style={{flex:1,padding:'10px',background:'#0066cc',color:'white'}}>Confirm Bid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;