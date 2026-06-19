import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('punter');

  // Punter State
  const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [punterBets, setPunterBets] = useState([]);

  // House State
  const [allBets, setAllBets] = useState([]);
  const [partialAmount, setPartialAmount] = useState({});

  const fetchBets = async () => {
    try {
      const res = await fetch('/api/bets');
      const data = await res.json();
      setPunterBets(data);
      setAllBets(data);
    } catch (e) {
      console.error('Failed to fetch bets:', e);
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

    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bet)
      });
      const data = await res.json();

      if (data.success) {
        setMessage('✅ Bet submitted to House!');
        setBet({ event: '', selection: '', odds: '', stake: '' });
      } else {
        setMessage('❌ Submit failed');
      }
    } catch (err) {
      setMessage('❌ Cannot connect to server');
    }
    setLoading(false);
  };

  const handleHouseAction = async (betId, action, amount = null) => {
    try {
      const res = await fetch(`/api/bets/${betId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount })
      });
      const data = await res.json();

      if (data.success) {
        alert(`✅ House ${action} bet #${betId}`);
      } else {
        alert('Action failed');
      }
      fetchBets();
    } catch (err) {
      alert('❌ Cannot connect to server');
    }
  };

  return (
    <div className="app">
      <h1>💰 BetTheMan V1</h1>

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('punter')} 
          style={{ marginRight: '10px', fontWeight: activeTab === 'punter' ? 'bold' : 'normal' }}
        >
          Punter View
        </button>
        <button 
          onClick={() => setActiveTab('house')} 
          style={{ fontWeight: activeTab === 'house' ? 'bold' : 'normal' }}
        >
          House View
        </button>
      </div>

      {/* PUNTER VIEW */}
      {activeTab === 'punter' && (
        <>
          <p>Punter - Place Your Bet</p>
          
          <form onSubmit={handleSubmit}>
            <div>
              <label>Event / Match:</label>
              <input 
                type="text" 
                placeholder="e.g. Arsenal vs Chelsea" 
                value={bet.event} 
                onChange={(e) => setBet({...bet, event: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label>Selection:</label>
              <input 
                type="text" 
                placeholder="e.g. Arsenal to win" 
                value={bet.selection} 
                onChange={(e) => setBet({...bet, selection: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label>Odds:</label>
              <input 
                type="text" 
                placeholder="e.g. 1.85" 
                value={bet.odds} 
                onChange={(e) => setBet({...bet, odds: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label>Stake (£):</label>
              <input 
                type="number" 
                placeholder="100" 
                value={bet.stake} 
                onChange={(e) => setBet({...bet, stake: e.target.value})} 
                required 
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Bet to House'}
            </button>
          </form>

          {message && <p style={{ color: message.includes('✅') ? 'lime' : 'red', fontWeight: 'bold' }}>{message}</p>}

          <h2>Your Pending Bets</h2>
          {punterBets.length === 0 ? (
            <p>No bets yet.</p>
          ) : (
            punterBets.map(b => (
              <div key={b.id} style={{background:'rgba(255,255,255,0.1)', padding:'12px', margin:'8px 0', borderRadius:'8px'}}>
                <strong>{b.event}</strong> — {b.selection} @ {b.odds} — £{b.stake}<br />
                <small>Status: {b.status || 'pending'}</small>
              </div>
            ))
          )}
        </>
      )}

      {/* HOUSE VIEW */}
      {activeTab === 'house' && (
        <>
          <h2>🏠 House View - Pending Bets</h2>
          {allBets.length === 0 ? (
            <p>No pending bets at the moment.</p>
          ) : (
            allBets.map(b => (
              <div key={b.id} style={{background:'rgba(255,255,255,0.1)', padding:'15px', margin:'12px 0', borderRadius:'8px'}}>
                <strong>{b.event}</strong><br />
                {b.selection} @ {b.odds} — Requested: £{b.stake}<br /><br />

                <button 
                  onClick={() => handleHouseAction(b.id, 'Accepted')} 
                  style={{marginRight:'8px', background:'lime', color:'black', padding:'8px 16px'}}
                >
                  Accept Full (£{b.stake})
                </button>

                <button 
                  onClick={() => handleHouseAction(b.id, 'Rejected')} 
                  style={{marginRight:'8px', padding:'8px 16px'}}
                >
                  Reject
                </button>

                <div style={{marginTop: '15px'}}>
                  <input 
                    type="number" 
                    placeholder="Partial £" 
                    value={partialAmount[b.id] || ''} 
                    onChange={(e) => setPartialAmount({ ...partialAmount, [b.id]: e.target.value })}
                    style={{ width: '110px', marginRight: '8px' }}
                  />
                  <button 
                    onClick={() => handleHouseAction(b.id, 'Partial', parseFloat(partialAmount[b.id]) || 0)} 
                    style={{ padding: '8px 16px', background: '#ffaa00', color: 'black' }}
                  >
                    Accept Partial
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

export default App;