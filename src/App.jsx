import { useState, useEffect, useRef } from 'react';
import './App.css';

const MOCK_USERS = [
  { id: 1, name: "Alex Rivera", canLay: true },
  { id: 2, name: "Jordan Hale", canLay: false },
  { id: 3, name: "Sam Patel", canLay: true },
  { id: 4, name: "Taylor Quinn", canLay: false },
  { id: 5, name: "Morgan Lee", canLay: true },
  { id: 6, name: "Casey Brooks", canLay: false },
];

function App() {
  const [activeTab, setActiveTab] = useState('punter');
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);

  const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [allBets, setAllBets] = useState([]);

  const [partialAmount, setPartialAmount] = useState({});
  const [bidAmount, setBidAmount] = useState({});

  const betsRef = useRef([]);

  useEffect(() => {
    betsRef.current = allBets;
  }, [allBets]);

  const fetchBets = async () => {
    try {
      const res = await fetch('/api/bets');
      const data = await res.json();
      setAllBets(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBets();
    const interval = setInterval(fetchBets, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const houseTimerEnd = Date.now() + 30000;

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...bet, 
          punterId: currentUser.id, 
          punterName: currentUser.name,
          houseTimerEnd 
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Bet submitted!');
        setBet({ event: '', selection: '', odds: '', stake: '' });
      }
    } catch (err) {
      setMessage('Error');
    }
    setLoading(false);
  };

  const handleHouseAction = async (betId, action, amount = null) => {
    try {
      const res = await fetch(`/api/bets/${betId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount: amount ? parseFloat(amount) : null })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Action failed');
        return;
      }
      fetchBets();
    } catch (err) {
      alert('Action failed');
    }
  };

  const handleLayerBid = async (betId, amount) => {
    const bid = parseFloat(amount);
    if (!bid || bid <= 0) return alert('Enter a valid amount');

    try {
      await fetch(`/api/bets/${betId}/layer-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layerId: currentUser.id,
          layerName: currentUser.name,
          amount: bid
        })
      });
      setBidAmount({ ...bidAmount, [betId]: '' });
      fetchBets();
    } catch (err) {
      alert('Bid failed');
    }
  };

  const handleLayFullAmount = async (betId) => {
    const bet = allBets.find(b => b.id === betId);
    if (!bet) return;

    const remaining = Math.max(0, parseFloat(bet.stake) - (bet.houseAmount || 0));
    if (remaining <= 0) return alert('Nothing left to lay');

    try {
      await fetch(`/api/bets/${betId}/layer-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layerId: currentUser.id,
          layerName: currentUser.name,
          amount: remaining
        })
      });
      fetchBets();
    } catch (err) {
      alert('Bid failed');
    }
  };

  const handleLayerReject = async (betId) => {
    try {
      await fetch(`/api/bets/${betId}/layer-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layerId: currentUser.id,
          layerName: currentUser.name,
          amount: 0
        })
      });
      fetchBets();
    } catch (err) {
      alert('Reject failed');
    }
  };

  // ==================== HELPERS ====================
  const getHouseTimeLeft = (b) => {
    if (!b?.houseTimerEnd) return null;
    const remaining = Math.floor((b.houseTimerEnd - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  };

  const getLayerTimeLeft = (b) => {
    if (!b?.layerTimerEnd) return null;
    const remaining = Math.floor((b.layerTimerEnd - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  };

  const sortByNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

  const getEffectiveHouseAmount = (b) => parseFloat(b?.houseAmount) || 0;

  const getTotalMatched = (b) => {
    if (!b) return 0;
    const house = getEffectiveHouseAmount(b);
    const layers = Array.isArray(b.layerBids)
      ? b.layerBids.reduce((sum, bid) => sum + (bid.allocatedAmount || parseFloat(bid.amount) || 0), 0)
      : 0;
    return house + layers;
  };

  const getLayableAmountForLayers = (b) => {
    if (!b) return 0;
    const houseTaken = getEffectiveHouseAmount(b);
    return Math.max(0, parseFloat(b.stake) - houseTaken);
  };

  const isFullyLaid = (b) => getTotalMatched(b) >= parseFloat(b?.stake || 0);

  // ==================== FILTERS ====================
  const myPendingBets = allBets
    .filter(b => b && b.punterId === currentUser.id && !isFullyLaid(b))
    .sort(sortByNewest);

  const myActiveBets = allBets
    .filter(b => b && b.punterId === currentUser.id && isFullyLaid(b))
    .sort(sortByNewest);

  // FIXED: Only show bets where House has NOT acted yet
  const pendingBets = allBets
    .filter(b => b && !b.houseAction && b.status === 'pending' && !isFullyLaid(b))
    .sort(sortByNewest);

  const actionedBets = allBets
    .filter(b => b && b.houseAction)
    .sort(sortByNewest);

  const betsForLayers = allBets
    .filter(b => {
      if (!b || b.punterId === currentUser.id) return false;
      if (b.allocationComplete || isFullyLaid(b)) return false;

      const alreadyActed = b.layerBids?.some(bid => bid.layerId === currentUser.id);
      if (alreadyActed) return false;

      const hasHouseActed = !!b.houseAction;
      const remaining = getLayableAmountForLayers(b);
      const layerTimeLeft = getLayerTimeLeft(b);

      return hasHouseActed && remaining > 0 && layerTimeLeft !== null && layerTimeLeft > 0;
    })
    .sort(sortByNewest);

  const myActiveLays = allBets.filter(b =>
    b && Array.isArray(b.layerBids) && b.layerBids.some(bid => bid.layerId === currentUser.id)
  ).sort(sortByNewest);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  };

  const getHouseStatusLabel = (b) => {
    if (!b) return '';
    const houseTotal = getEffectiveHouseAmount(b);
    const stake = parseFloat(b.stake) || 0;

    if (activeTab === 'punter') {
      return isFullyLaid(b) ? 'Fully Laid' : (b.status || 'Pending');
    }

    if (b.houseAction === 'Rejected') return 'Rejected by House';
    if (b.houseAction === 'Partial' || b.houseAction === 'Accepted') {
      return `£${houseTotal} of £${stake} Laid by House`;
    }
    if (isFullyLaid(b)) return 'Fully Laid';
    return b.status || 'Pending';
  };

  return (
    <div className="app">
      <h1>💰 BetTheMan V1</h1>

      <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
        <strong>Current User:</strong> {currentUser.name} {currentUser.canLay && "★"}
        <select value={currentUser.id} onChange={(e) => setCurrentUser(MOCK_USERS.find(u => u.id === parseInt(e.target.value)))} style={{ marginLeft: '15px' }}>
          {MOCK_USERS.map(u => <option key={u.id} value={u.id}>{u.name} {u.canLay ? "★" : ""}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('punter')} style={{ marginRight: '10px', fontWeight: activeTab === 'punter' ? 'bold' : 'normal' }}>Punter View</button>
        <button onClick={() => setActiveTab('house')} style={{ marginRight: '10px', fontWeight: activeTab === 'house' ? 'bold' : 'normal' }}>Admin View</button>
        <button onClick={() => setActiveTab('layer')} style={{ fontWeight: activeTab === 'layer' ? 'bold' : 'normal' }}>Layer View</button>
      </div>

      {/* PUNTER VIEW */}
      {activeTab === 'punter' && (
        <>
          <p>Place Your Bet</p>
          <form onSubmit={handleSubmit}>
            <div><label>Event / Match:</label><input type="text" placeholder="e.g. Arsenal vs Chelsea" value={bet.event} onChange={(e) => setBet({...bet, event: e.target.value})} required /></div>
            <div><label>Selection:</label><input type="text" placeholder="e.g. Arsenal to win" value={bet.selection} onChange={(e) => setBet({...bet, selection: e.target.value})} required /></div>
            <div><label>Odds:</label><input type="text" placeholder="e.g. 1.85" value={bet.odds} onChange={(e) => setBet({...bet, odds: e.target.value})} required /></div>
            <div><label>Stake (£):</label><input type="number" placeholder="100" value={bet.stake} onChange={(e) => setBet({...bet, stake: e.target.value})} required /></div>
            <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Bet'}</button>
          </form>
          {message && <p style={{color: message.includes('✅') ? 'lime' : 'red', fontWeight: 'bold'}}>{message}</p>}

          <h2 style={{ marginTop: '30px' }}>Pending Bets</h2>
          {myPendingBets.length === 0 ? <p>No pending bets.</p> : myPendingBets.map(b => (
            <div key={b.id} style={{background:'rgba(255,255,255,0.1)', padding:'12px', margin:'8px 0', borderRadius:'8px'}}>
              <strong>{b.event}</strong> — {b.selection} @ {b.odds} — £{b.stake}<br />
              <small style={{color: '#aaa'}}>Submitted: {formatTime(b.createdAt)}</small>
            </div>
          ))}

          <h2 style={{ marginTop: '30px' }}>Active Bets</h2>
          {myActiveBets.length === 0 ? <p>No active bets.</p> : myActiveBets.map(b => (
            <div key={b.id} style={{background:'rgba(255,255,255,0.1)', padding:'12px', margin:'8px 0', borderRadius:'8px'}}>
              <strong>{b.event}</strong> — {b.selection} @ {b.odds} — £{b.stake}<br />
              <small style={{color: '#0f0'}}>{getHouseStatusLabel(b)}</small>
            </div>
          ))}
        </>
      )}

      {/* ADMIN VIEW */}
      {activeTab === 'house' && (
        <>
          <h2>Pending Bets</h2>
          {pendingBets.length === 0 ? <p>No pending bets.</p> : pendingBets.map(b => {
            const timeLeft = getHouseTimeLeft(b);
            return (
              <div key={b.id} style={{background:'rgba(255,255,255,0.1)', padding:'15px', margin:'12px 0', borderRadius:'8px'}}>
                <strong>{b.event}</strong><br />
                {b.selection} @ {b.odds} — £{b.stake} (Punter: {b.punterName})<br />
                {timeLeft !== null && timeLeft > 0 && <div style={{color: '#ffaa00', fontWeight: 'bold'}}>⏱ {timeLeft}s remaining</div>}

                <button onClick={() => handleHouseAction(b.id, 'Accepted')} style={{marginRight:'8px', background:'lime', color:'black', padding:'8px 16px'}}>Accept Full</button>
                <button onClick={() => handleHouseAction(b.id, 'Rejected')} style={{marginRight:'8px', padding:'8px 16px'}}>Reject</button>

                <div style={{marginTop: '12px'}}>
                  <input type="number" placeholder="Partial £" value={partialAmount[b.id] || ''} onChange={(e) => setPartialAmount({ ...partialAmount, [b.id]: e.target.value })} style={{ width: '110px', marginRight: '8px' }} />
                  <button onClick={() => handleHouseAction(b.id, 'Partial', partialAmount[b.id])} style={{ padding: '8px 16px', background: '#ffaa00', color: 'black' }}>Accept Partial</button>
                </div>
              </div>
            );
          })}

          <h2 style={{ marginTop: '40px' }}>Actioned Bets</h2>
          {actionedBets.length === 0 ? <p>No actioned bets.</p> : actionedBets.map(b => (
            <div key={b.id} style={{background:'rgba(255,255,255,0.05)', padding:'12px', margin:'8px 0', borderRadius:'8px'}}>
              <strong>{b.event} — {b.selection} @ {b.odds} — £{b.stake}</strong><br />
              <small style={{color: '#0f0', fontWeight: 'bold'}}>{getHouseStatusLabel(b)}</small>
            </div>
          ))}
        </>
      )}

      {/* LAYER VIEW */}
      {activeTab === 'layer' && currentUser.canLay && (
        <>
          <h2>Available Bets to Lay</h2>
          {betsForLayers.length === 0 ? <p>No bets available.</p> : betsForLayers.map(b => {
            const layableAmount = getLayableAmountForLayers(b);
            const layerTimeLeft = getLayerTimeLeft(b);

            return (
              <div key={b.id} style={{background:'rgba(255,255,255,0.1)', padding:'15px', margin:'12px 0', borderRadius:'8px'}}>
                <strong>{b.event}</strong><br />
                {b.selection} @ {b.odds}<br />
                <small>Punter: <strong>{b.punterName}</strong></small><br />
                <small style={{color: '#ffaa00', fontWeight: 'bold'}}>Amount to Lay: £{layableAmount}</small><br /><br />

                {layerTimeLeft !== null && layerTimeLeft > 0 && (
                  <div style={{ color: layerTimeLeft < 10 ? '#ff4444' : '#00aaff', fontWeight: 'bold', marginBottom: '12px' }}>
                    ⏱ Time left: {layerTimeLeft}s
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleLayFullAmount(b.id)} style={{ padding: '8px 16px', background: '#00cc66', color: 'white' }}>
                    Lay Full Amount
                  </button>
                  <div>
                    <input type="number" placeholder="Custom £" value={bidAmount[b.id] || ''} onChange={(e) => setBidAmount({ ...bidAmount, [b.id]: e.target.value })} style={{ width: '100px', marginRight: '8px' }} />
                    <button onClick={() => handleLayerBid(b.id, bidAmount[b.id])} style={{ padding: '8px 16px', background: '#00aaff', color: 'white' }}>
                      Place Bid
                    </button>
                  </div>
                  <button onClick={() => handleLayerReject(b.id)} style={{ padding: '8px 16px', background: '#cc0000', color: 'white' }}>
                    Reject
                  </button>
                </div>
              </div>
            );
          })}

          <h2 style={{ marginTop: '40px' }}>My Active Lays</h2>
          {myActiveLays.length === 0 ? <p>No active lays yet.</p> : myActiveLays.map(b => {
            const myBid = b.layerBids?.find(bid => bid.layerId === currentUser.id);
            const isFinalized = b.allocationComplete;

            let statusText = "Bid placed (waiting for finalization)";
            if (isFinalized && myBid) {
              statusText = `£${myBid.allocatedAmount || myBid.amount} CONFIRMED LAID`;
            }

            return (
              <div key={b.id} style={{background:'rgba(0,200,255,0.1)', padding:'12px', margin:'8px 0', borderRadius:'8px'}}>
                <strong>{b.event} — {b.selection} @ {b.odds} — £{b.stake}</strong><br />
                <small>Punter: <strong>{b.punterName}</strong></small><br />
                {myBid && (
                  <small style={{color: isFinalized ? '#0f0' : '#aaa', fontWeight: 'bold'}}>
                    {statusText}
                  </small>
                )}
              </div>
            );
          })}
        </>
      )}

      {activeTab === 'layer' && !currentUser.canLay && (
        <p style={{color: 'red', marginTop: '40px'}}>You do not have laying rights on this account.</p>
      )}
    </div>
  );
}

export default App