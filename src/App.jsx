import { useState, useEffect } from 'react';
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
    const interval = setInterval(fetchBets, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bet, punterId: currentUser.id, punterName: currentUser.name })
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
    if (action === 'Partial') {
      const partialValue = parseFloat(amount);
      if (!partialValue || partialValue <= 0) {
        alert('Please enter a valid partial amount');
        return;
      }
    }

    try {
      await fetch(`/api/bets/${betId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount: amount ? parseFloat(amount) : null })
      });
      fetchBets();
    } catch (err) {
      alert('Action failed');
    }
  };

  const handleLayerBid = async (betId, amount) => {
    const bid = parseFloat(amount);
    if (!bid || bid <= 0) return alert('Enter a valid amount');

    const bet = allBets.find(b => b.id === betId);
    if (!bet) return;

    if (!bet.layerBids) bet.layerBids = [];
    bet.layerBids.push({
      layerId: currentUser.id,
      layerName: currentUser.name,
      amount: bid,
      timestamp: new Date()
    });

    alert(`Bid of £${bid} placed`);
    setBidAmount({ ...bidAmount, [betId]: '' });
    fetchBets();
  };

  // ==================== FILTERS & SORTING ====================
  const now = new Date();

  // Remove expired bets from Layer view (older than 2 hours for now)
  const isExpired = (bet) => {
    if (!bet.createdAt) return false;
    const created = new Date(bet.createdAt);
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    return hoursDiff > 2;
  };

  const pendingBets = allBets.filter(b => b.status === 'pending');
  const actionedBets = allBets.filter(b => b.status !== 'pending');

  const myPendingBets = allBets.filter(b => b.punterId === currentUser.id && b.status === 'pending');
  const myActiveBets = allBets.filter(b => b.punterId === currentUser.id && b.status === 'accepted');
  const mySettledBets = allBets.filter(b => b.punterId === currentUser.id && b.status === 'rejected');

  // Layers only see non-expired bets that are accepted or rejected
  const betsForLayers = allBets
    .filter(b => (b.status === 'accepted' || b.status === 'rejected') && !isExpired(b))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  };

  const getHouseStatusLabel = (b) => {
    if (b.status === 'accepted' && b.houseAction === 'Partial') {
      return `Partially Accepted (£${b.houseAmount})`;
    }
    if (b.status === 'accepted') return 'Fully Accepted';
    if (b.status === 'rejected') return 'Rejected';
    return b.status;
  };

  const getLayableAmount = (b) => {
    if (b.status === 'rejected') return b.stake;
    if (b.houseAmount && b.houseAmount > 0) return b.stake - b.houseAmount;
    return b.stake;
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
              <small style={{color: '#0f0'}}>{getHouseStatusLabel(b)} • {formatTime(b.actionedAt)}</small>
            </div>
          ))}

          <h2 style={{ marginTop: '30px' }}>Settled Bets</h2>
          {mySettledBets.length === 0 ? <p>No settled bets.</p> : mySettledBets.map(b => (
            <div key={b.id} style={{background:'rgba(255,0,0,0.1)', padding:'12px', margin:'8px 0', borderRadius:'8px', border: '1px solid #ff4444'}}>
              <strong>{b.event}</strong> — {b.selection} @ {b.odds} — £{b.stake}<br />
              <small style={{color: '#ff6666'}}>{getHouseStatusLabel(b)} • {formatTime(b.actionedAt)}</small>
            </div>
          ))}
        </>
      )}

      {/* ADMIN VIEW */}
      {activeTab === 'house' && (
        <>
          <h2>Pending Bets</h2>
          {pendingBets.length === 0 ? <p>No pending bets.</p> : pendingBets.map(b => (
            <div key={b.id} style={{background:'rgba(255,255,255,0.1)', padding:'15px', margin:'12px 0', borderRadius:'8px'}}>
              <strong>{b.event}</strong><br />
              {b.selection} @ {b.odds} — £{b.stake} (Punter: {b.punterName})<br /><br />
              <button onClick={() => handleHouseAction(b.id, 'Accepted')} style={{marginRight:'8px', background:'lime', color:'black', padding:'8px 16px'}}>Accept Full</button>
              <button onClick={() => handleHouseAction(b.id, 'Rejected')} style={{marginRight:'8px', padding:'8px 16px'}}>Reject</button>
              <div style={{marginTop: '12px'}}>
                <input type="number" placeholder="Partial £" value={partialAmount[b.id] || ''} onChange={(e) => setPartialAmount({ ...partialAmount, [b.id]: e.target.value })} style={{ width: '110px', marginRight: '8px' }} />
                <button onClick={() => handleHouseAction(b.id, 'Partial', partialAmount[b.id])} style={{ padding: '8px 16px', background: '#ffaa00', color: 'black' }}>Accept Partial</button>
              </div>
            </div>
          ))}

          <h2 style={{ marginTop: '40px' }}>Actioned Bets</h2>
          {actionedBets.length === 0 ? <p>No actioned bets.</p> : actionedBets.map(b => (
            <div key={b.id} style={{background:'rgba(255,255,255,0.05)', padding:'12px', margin:'8px 0', borderRadius:'8px'}}>
              <strong>{b.event}</strong> — {b.selection} @ {b.odds} — £{b.stake} (Punter: {b.punterName})<br />
              <small style={{color: b.status === 'accepted' ? '#0f0' : '#f66'}}>
                {getHouseStatusLabel(b)} • {formatTime(b.actionedAt)}
              </small>
            </div>
          ))}
        </>
      )}

      {/* LAYER VIEW - NEWEST FIRST + NO EXPIRED BETS */}
      {activeTab === 'layer' && currentUser.canLay && (
        <>
          <h2>Available Bets to Lay</h2>
          {betsForLayers.length === 0 ? <p>No bets available.</p> : betsForLayers.map(b => {
            const layableAmount = getLayableAmount(b);
            return (
              <div key={b.id} style={{background:'rgba(255,255,255,0.1)', padding:'15px', margin:'12px 0', borderRadius:'8px'}}>
                <strong>{b.event}</strong><br />
                {b.selection} @ {b.odds}<br />
                <small>Punter: <strong>{b.punterName}</strong></small><br />
                <small style={{color: '#ffaa00', fontWeight: 'bold'}}>Amount to Lay: £{layableAmount}</small><br /><br />

                {layableAmount > 0 && (
                  <>
                    <input type="number" placeholder={`Max £${layableAmount}`} value={bidAmount[b.id] || ''} onChange={(e) => setBidAmount({ ...bidAmount, [b.id]: e.target.value })} style={{ width: '130px', marginRight: '10px' }} />
                    <button onClick={() => handleLayerBid(b.id, bidAmount[b.id])} style={{ padding: '8px 16px', background: '#00aaff', color: 'white' }}>Place Bid</button>
                  </>
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

export default App;