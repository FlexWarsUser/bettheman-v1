import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function requestNotifyPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showBetNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const opts = {
    body,
    icon: "/logo2.png",
    badge: "/logo2.png",
    tag: "btm-bet-" + Date.now(),
  };

  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready
    .then((reg) => reg.showNotification(title, opts))
    .catch(() => {});
}
function CollapsibleSection({ title, children, defaultOpen = false, open: controlledOpen, onToggle }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const toggle = () => {
    if (isControlled) {
      onToggle && onToggle(!controlledOpen);
    } else {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={toggle}
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
      <div style={{ marginTop: 12 }}>
        <div style={{  marginBottom: 8, color: '#b0b0b0' }}>Email</div>
        <input type="text" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <div style={{ marginTop: 14, marginBottom: 8, color: '#b0b0b0' }}>Password</div>
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
const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '', eachWay: false });
  const [message, setMessage] = useState('');
  const [bidAmount, setBidAmount] = useState({});
  const [layerMessage, setLayerMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');
  const [customerTab, setCustomerTab] = useState('slip');
  const [slipOpen, setSlipOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventSuggestions, setEventSuggestions] = useState([]);
const [showEventDropdown, setShowEventDropdown] = useState(false);
const [selectionSuggestions, setSelectionSuggestions] = useState([]);
const [showSelectionDropdown, setShowSelectionDropdown] = useState(false);
const [now, setNow] = useState(Date.now());   // ← add this line
useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  requestNotifyPermission();
}, []);
    useEffect(() => {
    if (!user?.canLay) return;

    const socket = io(API, { transports: ["websocket", "polling"] });

    socket.on("bet:notify", (payload) => {
      if (payload.phase !== "layer_bidding") return;
      if (Number(payload.punterId) === Number(user.id)) return;

      const stakeLabel = payload.eachWay
        ? `£${Number(payload.originalStake ?? payload.stake / 2).toFixed(0)} each way`
        : `£${payload.stake} Win`;

      showBetNotification(
        "Available to lay",
        `${payload.event} – ${payload.selection} @ ${payload.odds} — ${stakeLabel}`
      );
      fetchBets();
    });

    return () => {
      socket.off("bet:notify");
      socket.disconnect();
    };
  }, [user?.canLay, user?.id]);
  const fetchBets = async () => {
    try {
      const res = await fetch(`${API}/api/bets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setBets(data);
      }
    } catch (e) {}
  };
const searchEvents = async (q) => {
  if (!q || q.length < 2) {
    setEventSuggestions([]);
    setShowEventDropdown(false);
    return;
  }
  try {
    const res = await fetch(`${API}/api/events?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    let list = data.success ? (data.events || []) : [];

    const ql = q.trim().toLowerCase();
    const isNumeric = /^\d+$/.test(ql);

        if (isNumeric) {
      list = list.filter(ev => {
        const name = (ev.name || '').toLowerCase();
        return name.startsWith(ql);
      });
    } else {
      list = list.filter(ev => (ev.name || '').toLowerCase().includes(ql));
    }

    setEventSuggestions(list);
    setShowEventDropdown(list.length > 0);
  } catch (e) {
    setEventSuggestions([]);
  }
};
  const searchSelections = async (q) => {
    const query = (q || '').trim();

    // Football: markets from templates
    const FOOTBALL_MARKETS = [
  'Home Win',
  'Draw',
  'Away Win',
  'Over 1.5 Goals',
  'Over 2.5 Goals',
  'Over 3.5 Goals',
  'Over 4.5 Goals',
  'Both Teams to Score BTTS',
  'Over 7.5 Corners',
  'Over 8.5 Corners',
  'Over 9.5 Corners',
  'Over 10.5 Corners',
  'Over 11.5 Corners',
  'Over 12.5 Corners',
  'Over 13.5 Corners',
  'Under 7.5 Corners',
  'Under 8.5 Corners',
  'Under 9.5 Corners',
  'Under 10.5 Corners',
  'Under 11.5 Corners',
  'Under 12.5 Corners',
  'Under 13.5 Corners',
  'Over 1.5 Home Goals',
  'Over 2.5 Home Goals',
  'Over 3.5 Home Goals',
  'Under 1.5 Home Goals',
  'Under 2.5 Home Goals',
  'Under 3.5 Home Goals',
  'Over 1.5 Away Goals',
  'Over 2.5 Away Goals',
  'Over 3.5 Away Goals',
  'Under 1.5 Away Goals',
  'Under 2.5 Away Goals',
  'Under 3.5 Away Goals',
  'Over 1.5 Home Corners',
  'Over 2.5 Home Corners',
  'Over 3.5 Home Corners',
  'Over 4.5 Home Corners',
  'Over 5.5 Home Corners',
  'Over 6.5 Home Corners',
  'Over 7.5 Home Corners',
  'Over 8.5 Home Corners',
  'Over 9.5 Home Corners',
  'Over 10.5 Home Corners',
  'Over 1.5 Away Corners',
  'Over 2.5 Away Corners',
  'Over 3.5 Away Corners',
  'Over 4.5 Away Corners',
  'Over 5.5 Away Corners',
  'Over 6.5 Away Corners',
  'Over 7.5 Away Corners',
  'Over 8.5 Away Corners',
  'Over 9.5 Away Corners',
  'Over 10.5 Away Corners',
  'Under 1.5 Home Corners',
  'Under 2.5 Home Corners',
  'Under 3.5 Home Corners',
  'Under 4.5 Home Corners',
  'Under 5.5 Home Corners',
  'Under 6.5 Home Corners',
  'Under 7.5 Home Corners',
  'Under 8.5 Home Corners',
  'Under 9.5 Home Corners',
  'Under 10.5 Home Corners',
  'Under 1.5 Away Corners',
  'Under 2.5 Away Corners',
  'Under 3.5 Away Corners',
  'Under 4.5 Away Corners',
  'Under 5.5 Away Corners',
  'Under 6.5 Away Corners',
  'Under 7.5 Away Corners',
  'Under 8.5 Away Corners',
  'Under 9.5 Away Corners',
  'Under 10.5 Away Corners',
  'Over 1.5 Match Cards',
  'Over 2.5 Match Cards',
  'Over 3.5 Match Cards',
  'Over 4.5 Match Cards',
  'Over 6.5 Match Cards',
  'Over 7.5 Match Cards',
  'Under 1.5 Match Cards',
  'Under 2.5 Match Cards',
  'Under 3.5 Match Cards',
  'Under 4.5 Match Cards',
  'Under 6.5 Match Cards',
  'Under 7.5 Match Cards',
  'Over 0.5 Home Cards',
  'Over 1.5 Home Cards',
  'Over 2.5 Home Cards',
  'Over 3.5 Home Cards',
  'Over 4.5 Home Cards',
  'Under 0.5 Home Cards',
  'Under 1.5 Home Cards',
  'Under 2.5 Home Cards',
  'Under 3.5 Home Cards',
  'Under 4.5 Home Cards',
  'Over 0.5 Away Cards',
  'Over 1.5 Away Cards',
  'Over 2.5 Away Cards',
  'Over 3.5 Away Cards',
  'Over 4.5 Away Cards',
  'Under 0.5 Away Cards',
  'Under 1.5 Away Cards',
  'Under 2.5 Away Cards',
  'Under 3.5 Away Cards',
  'Under 4.5 Away Cards',
  'Home Team -0.5 Handicap',
  'Home Team -1.5 Handicap',
  'Home Team -2.5 Handicap',
  'Home Team -3.5 Handicap',
  'Home Team +0.5 Handicap',
  'Home Team +1.5 Handicap',
  'Home Team +2.5 Handicap',
  'Home Team +3.5 Handicap',
  'Away Team -0.5 Handicap',
  'Away Team -1.5 Handicap',
  'Away Team -2.5 Handicap',
  'Away Team -3.5 Handicap',
  'Away Team +0.5 Handicap',
  'Away Team +1.5 Handicap',
  'Away Team +2.5 Handicap',
  'Away Team +3.5 Handicap',
];

function parseFootballTeams(eventName) {
  const parts = String(eventName || '').split(/\s+v\s+/i);
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    return { home: parts[0].trim(), away: parts[1].trim() };
  }
  return null;
}

function footballSelectionsForEvent(eventName) {
  const teams = parseFootballTeams(eventName);
  if (!teams) return [];
  const { home, away } = teams;
  return FOOTBALL_MARKETS.map(label =>
    label
      .replace(/\bHome Team\b/g, home)
      .replace(/\bAway Team\b/g, away)
      .replace(/\bHome\b/g, home)
      .replace(/\bAway\b/g, away)
  );
}
    const teams = parseFootballTeams(bet.event);
    if (teams) {
      let list = footballSelectionsForEvent(bet.event);
      if (query) {
        list = list.filter(s => s.toLowerCase().includes(query.toLowerCase()));
      }
      setSelectionSuggestions(list.slice(0, 40));
      setShowSelectionDropdown(list.length > 0);
      return;
    }

    // Horse: need at least 2 chars
    if (!query || query.length < 2) {
      setSelectionSuggestions([]);
      setShowSelectionDropdown(false);
      return;
    }

    try {
      const params = new URLSearchParams({ q: query });
      if (bet.event) params.set('eventName', bet.event);
      const res = await fetch(`${API}/api/runners?${params}`);
      const data = await res.json();
      const list = (data && data.runners) ? data.runners : [];
      setSelectionSuggestions(list);
      setShowSelectionDropdown(list.length > 0);
    } catch (e) {
      setSelectionSuggestions([]);
      setShowSelectionDropdown(false);
    }
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
      fetch(`${API}/api/events`)
    .then(r => r.json())
    .then(d => setEvents(d.events || []))
    .catch(() => {});
    const interval = setInterval(() => {
      fetchBets();
      refreshUser();
    }, 3000);
    return () => clearInterval(interval);
  }, [user.id]);
useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(id);
}, []);
const oddsToLiabilityMultiplier = (oddsStr) => {
  const str = String(oddsStr || '').trim();
  if (!str) return 0;
  if (str.includes('/') || str.includes('-')) {
    const [n, d] = str.split(/[\/\-]/);
    const num = parseFloat(n);
    const den = parseFloat(d) || 1;
    if (!num || !den) return 0;
    return num / den;
  }
  const o = parseFloat(str);
  return o > 1 ? (o - 1) : 0;
};

const getPlaceFraction = (fieldSize, isHandicap) => {
  const n = parseInt(fieldSize, 10) || 0;
  if (n < 5) return null;
  if (n <= 7) return 0.25;
  if (isHandicap) {
    if (n >= 12) return 0.25;
    return 0.2;
  }
  return 0.2;
};

const calcLiability = (stake, oddsStr, opts = {}) => {
  const s = parseFloat(stake) || 0;
  if (s <= 0) return 0;
  const mult = oddsToLiabilityMultiplier(oddsStr);
  if (!opts.eachWay) return s * mult;
  const part = s / 2;
  const frac = getPlaceFraction(opts.fieldSize, opts.isHandicap);
  if (frac == null) return part * mult;
  return part * mult + part * mult * frac;
};

const getBetRaceMeta = (bet) => {
  const name = (bet.event || '').toLowerCase();
  const ev = (events || []).find(e => (e.name || '').toLowerCase() === name);
  return {
    fieldSize: ev?.fieldSize ?? null,
    isHandicap: !!ev?.isHandicap,
  };
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
body: JSON.stringify({
  ...bet,
  stake: bet.eachWay ? (parseFloat(bet.stake) * 2) : bet.stake,
  eachWay: !!bet.eachWay,
  originalStake: parseFloat(bet.stake) || 0,
  punterId: user.id,
  punterName: user.name
}),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to place bet');
        return;
      }
setBet({ event: '', selection: '', odds: '', stake: '', eachWay: false });
setSlipOpen(false);
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
  let amount = parseFloat(bidAmount[b.id]);
  if (!amount || amount <= 0) {
    setLayerMessage('Enter an amount');
    return;
  }

  // Each-way: the number the layer typed is the single stake, so double it for the backend
  if (b.eachWay) {
    amount = amount * 2;
  }

  setLayerMessage('');
  try {
    const res = await fetch(`${API}/api/bets/${b.id}/layer-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        layerId: user.id,
        layerName: user.name,
        amount,          // this is now the correct total
        action: 'bid',
      }),
    });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLayerMessage(data.error || 'Lay failed');
        return;
      }
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
<div style={{ maxWidth: 520, width: '100%', margin: '10px auto', padding: 12, boxSizing: 'border-box', color: '#e8e8e8' }}>
  {/* Header */}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <h1 style={{ textAlign: 'left', margin: 0 }}>
          <img src="/logo2.png" alt="BetTheMan" style={{ maxWidth: '240px', height: 'auto' }} />
        </h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#b0b0b0', fontSize: 14, marginBottom: 6 }}>{user.name}</div>
          <button
            type="button"
            onClick={onLogout}
            style={{ padding: '8px 12px', fontSize: 14, background: '#3a3a5c', color: '#e8e8e8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}
          >
            Log out
          </button>
                  {(() => {
            const supported = typeof Notification !== "undefined";
            const needsEnable = !supported || Notification.permission !== "granted";
            if (!needsEnable) return null;

            return (
              <button
                type="button"
                onClick={() => {
                  if (!supported) {
                    alert(
                      "On iPhone: tap Share → Add to Home Screen, then open BetTheMan from the home screen icon and try again."
                    );
                    return;
                  }
                  Notification.requestPermission().then((p) => {
                    if (p === "granted") showBetNotification("Test", "Notifications on");
                    else alert("Permission: " + p);
                  });
                }}
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  background: "#3a3a5c",
                  color: "#e8e8e8",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  display: "block",
                  marginLeft: "auto",
                }}
              >
                Enable notifications
              </button>
            );
          })()}
        </div>
      </div>
<div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
  <span style={{ color: '#00ff88', fontWeight: 600 }}>
    Balance: £{Number(user.balance || 0).toFixed(2)}
  </span>
          {user.canLay && openLaysExposure > 0 && (
          <span style={{ color: '#ff6b6b', fontWeight: 600 }}>
            Open lays: £{openLaysExposure.toFixed(2)}
          </span>
        )}
</div>
      {/* Forced password change */}
{user.mustChangePassword && user.role !== 'admin' && user.role !== 'house' && (
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
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
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
<CollapsibleSection title="Show/Hide Betting Slip" open={slipOpen} onToggle={setSlipOpen}>
            <form onSubmit={placeBet}>
              <p style={{ color: '#00ff88', margin: '0 0 0 0', fontSize: 14 }}>Enter bet details</p>
<div style={{ position: 'relative' }}>
  <input
    placeholder="Event"
    value={bet.event}
    onChange={e => {
      const v = e.target.value;
      setBet({ ...bet, event: v });
      searchEvents(v);
    }}
    onBlur={() => setTimeout(() => setShowEventDropdown(false), 200)}
    onFocus={() => { if (eventSuggestions.length) setShowEventDropdown(true); }}
    required
    style={inputStyle}
    autoComplete="off"
  />
  {showEventDropdown && eventSuggestions.length > 0 && (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      background: '#1a1a2e',
      border: '1px solid #3a3a5c',
      borderRadius: 6,
      zIndex: 50,
      maxHeight: 200,
      overflowY: 'auto',
    }}>
      {eventSuggestions.map(ev => (
        <div
          key={ev.id}
          onMouseDown={() => {
            setBet({ ...bet, event: ev.name });
            setShowEventDropdown(false);
            setEventSuggestions([]);
          }}
          style={{
            padding: '10px 12px',
            cursor: 'pointer',
            borderBottom: '1px solid #2a2a40',
            color: '#e8e8e8',
            fontSize: 14,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#252540'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {ev.name}
<span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
  {new Date(ev.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
</span>
        </div>
      ))}
    </div>
  )}
</div>
<div style={{ position: 'relative' }}>
  <input
    placeholder="Selection"
    value={bet.selection}
    onChange={e => {
      const v = e.target.value;
      setBet({ ...bet, selection: v });
      searchSelections(v);
    }}
    onBlur={() => setTimeout(() => setShowSelectionDropdown(false), 200)}
    onFocus={() => { if (selectionSuggestions.length) setShowSelectionDropdown(true); }}
    required
    style={inputStyle}
    autoComplete="off"
  />
          {showSelectionDropdown && selectionSuggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#1a1a2e',
            border: '1px solid #3a3a5c',
            borderRadius: 6,
            zIndex: 50,
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            {selectionSuggestions.map((s, i) => {
              const label = typeof s === 'string' ? s : (s.name || '');
              return (
                <div
                  key={i}
                  onClick={() => {
                    setBet({ ...bet, selection: label });
                    setShowSelectionDropdown(false);
                    setSelectionSuggestions([]);
                  }}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #2a2a40',
                    color: '#e8e8e8',
                    fontSize: 14,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#252540'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {label}
                </div>
              );
            })}
          </div>
        )}
              </div>
<input
  placeholder="Odds - e.g 2.5, 6/4 or 6-4"
inputMode={
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    ? "text"
    : "decimal"
}
  autoComplete="off"
  spellCheck={false}
  value={bet.odds}
  onChange={e => {
    const value = e.target.value;

    // Allow:
    // - Empty (so the user can delete)
    // - Whole numbers (2)
    // - Decimal odds (2.5)
    // - Fractional odds (11/4)
if (
    value === '' ||
    /^\d+$/.test(value) ||
    /^\d+\.\d*$/.test(value) ||
    /^\d+[\/\-]\d*$/.test(value)   // 4/1 or 4-1
  ) {
    setBet({ ...bet, odds: value });
  }
}}
  required
  style={inputStyle}
/>
              <input placeholder="Stake" type="number" value={bet.stake} onChange={e => setBet({ ...bet, stake: e.target.value })} required style={inputStyle} />
<label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 0, color: '#ccc', fontSize: 14, cursor: 'pointer' }}>
  <input
    type="checkbox"
    checked={bet.eachWay}
    onChange={e => setBet({ ...bet, eachWay: e.target.checked })}
    style={{ width: 14, height: 14, accentColor: '#00ff88' }}
  />
  Tick for each way
</label>
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
    <div style={{ fontWeight: 600 }}>
      {b.event} – {b.selection} @ {b.odds}
    </div>
    <div style={{ color: '#b0b0b0', marginTop: 4 }}>
      £{b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
      {b.eachWay ? ' E/W' : ' Win'}
    </div>
    <div style={{ marginTop: 6, color: '#ffb347' }}>Pending</div>
    <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
      Submitted: {b.createdAt
        ? new Date(b.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'
        : '—'}
    </div>
  </div>
))}
  </div>
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
          <div style={{ fontWeight: 600 }}>
            {b.event} – {b.selection} @ {b.odds}
          </div>
          <div style={{ color: '#b0b0b0', marginTop: 4 }}>
            {(() => {
              const total = Number(b.stake) || 0;
              const perSide = b.eachWay ? (Number(b.originalStake) || total / 2) : total;
              const matchedSide = b.eachWay ? matched / 2 : matched;
              const isFull = matched >= total - 0.01;
              const unit = b.eachWay ? 'each way' : 'Win';
              if (isFull) {
                return `£${Number(perSide).toFixed(0)} ${unit} — fully laid`;
              }
              return `£${Number(perSide).toFixed(0)} ${unit} — partially laid (£${matchedSide.toFixed(2)} ${unit})`;
            })()}
          </div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 6 }}>
            Submitted: {b.createdAt
              ? new Date(b.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'
              : '—'}
          </div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
            Accepted: {(b.acceptedAt || b.houseActedAt)
              ? new Date(b.acceptedAt || b.houseActedAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'
              : '—'}
          </div>
        </div>
                          );
            })}
          </CollapsibleSection>

          <CollapsibleSection title={`Settled Bets (${settledBets.length})`} defaultOpen={false}>
            {settledBets.length === 0 && <p style={{ color: '#b0b0b0' }}>No settled bets.</p>}
            {settledBets.map(b => {
              const matched = getMatched(b);
const originalStake = b.eachWay
  ? (Number(b.originalStake) || Number(b.stake) / 2)
  : (Number(b.stake) || 0);
              const isPartial = matched > 0.01 && matched < originalStake - 0.01;
      const isWon = b.result === 'won';
      const isPlaced = b.result === 'placed';
      const isManual = b.result === 'manual';

      let returns = 0;
      if ((isWon || isPlaced) && matched > 0) {
        const meta = getBetRaceMeta(b);
        if (isWon) {
          const profit = calcLiability(matched, b.odds, {
            eachWay: !!b.eachWay,
            fieldSize: meta.fieldSize,
            isHandicap: meta.isHandicap,
          });
          returns = matched + profit;
} else if (isPlaced && b.eachWay) {
  const part = matched / 2;
  const mult = oddsToLiabilityMultiplier(b.odds);
  // Prefer fraction from settlement notes
  let frac = null;
  const notes = b.settlementNotes || '';
  if (notes.includes('1/5')) frac = 0.2;
  else if (notes.includes('1/4')) frac = 0.25;
  else if (notes.includes('1/3')) frac = 1 / 3;
  else if (notes.includes('1/2')) frac = 0.5;
  else if (notes.includes('Win only')) frac = null;

  if (frac == null && !notes.includes('Win only')) {
    const meta = getBetRaceMeta(b);
    frac = getPlaceFraction(meta.fieldSize, meta.isHandicap) ?? 0.25;
  }

  returns = frac == null ? 0 : part + part * mult * frac;
}
      }

      let resultLabel = 'LOST';
      let resultColor = '#ff6b6b';
      if (isWon) {
        resultLabel = 'WON';
        resultColor = '#00ff88';
      } else if (isPlaced) {
        resultLabel = 'PLACED';
        resultColor = '#ffb347';
      } else if (isManual) {
        resultLabel = 'SETTLED (Manual)';
        resultColor = '#ffb347';
      }

      return (
        <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 600 }}>
            {b.event} – {b.selection} @ {b.odds}
          </div>
          <div style={{ color: '#b0b0b0', marginTop: 4 }}>
            £{b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
            {b.eachWay ? ' E/W' : ''}
            {b.eachWay && b.settlementNotes && b.settlementNotes.includes('1/5') ? ' (1/5)' :
             b.eachWay && b.settlementNotes && b.settlementNotes.includes('1/4') ? ' (1/4)' :
             b.eachWay && b.settlementNotes && b.settlementNotes.includes('1/3') ? ' (1/3)' :
             b.eachWay && b.settlementNotes && b.settlementNotes.includes('1/2') ? ' (1/2)' :
             b.eachWay && b.settlementNotes && b.settlementNotes.includes('Win only') ? ' (Win only)' : ''}
            {' — '}
            {matched >= (Number(b.stake) || 0) - 0.01 ? 'Fully laid' : `Part matched £${matched.toFixed(2)}`}
          </div>
          <div style={{ marginTop: 6, fontWeight: 600, color: resultColor }}>
            {resultLabel}
            {(isWon || isPlaced) && returns > 0 ? ` — Returns £${returns.toFixed(2)}` : ''}
          </div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
            Submitted: {b.createdAt ? new Date(b.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : '—'}
          </div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
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
<div style={{ color: '#b0b0b0' }}>
  {b.selection} @ {b.odds} — £
  {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
  {b.eachWay ? ' each way' : ''}
</div>
                <div style={{ marginTop: 6, color: '#ff6b6b' }}>Not Accepted / Rejected</div>
              </div>
            ))}
          </CollapsibleSection>
        </>
      )}

       {/* ===== TAB: My Lays ===== */}
      {customerTab === 'lays' && user.canLay && (
        <>
          <CollapsibleSection title={`Open Lays (${openLays.length})`} defaultOpen={false}>
            {openLays.length === 0 && <p style={{ color: '#b0b0b0' }}>No open lays.</p>}
            {openLays.map(b => {
              const myBid = (b.layerBids || []).find(l => Number(l.layerId) === Number(user.id));
              const laid = parseFloat(myBid?.actualLaid ?? myBid?.amount) || 0;
const meta = getBetRaceMeta(b);
const liability = calcLiability(laid, b.odds, {
  eachWay: !!b.eachWay,
  fieldSize: meta.fieldSize,
  isHandicap: meta.isHandicap,
});
              const hasApportioned = myBid?.actualLaid != null;
              return (
                <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>
                    {b.selection} @ {b.odds} — £
                    {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
                    {b.eachWay ? ' each way' : ''}
                  </div>
                  <div style={{ marginTop: 6, color: '#00ff88' }}>
                    Your lay: £{b.eachWay ? (laid / 2).toFixed(2) : laid.toFixed(2)}
                    {b.eachWay ? ' each way' : ''}
                    {hasApportioned ? ' (apportioned)' : ' (awaiting apportioning)'}
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
const meta = getBetRaceMeta(b);
const liability = calcLiability(laid, b.odds, {
  eachWay: !!b.eachWay,
  fieldSize: meta.fieldSize,
  isHandicap: meta.isHandicap,
});
const isWon = b.result === 'won';
const isPlaced = b.result === 'placed';
const isManual = b.result === 'manual';

let resultLabel = 'LOST';
let resultColor = '#ff6b6b';
if (isWon) {
  resultLabel = 'WON';
  resultColor = '#00ff88';
} else if (isPlaced) {
  resultLabel = 'PLACED';
  resultColor = '#ffb347';
} else if (isManual) {
  resultLabel = 'SETTLED (Manual)';
  resultColor = '#ffb347';
}
              return (
                <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>
                    {b.selection} @ {b.odds} — £
                    {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
                    {b.eachWay ? ' each way' : ''}
                  </div>
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

      {/* Available to lay – shows on every tab */}
      {user.canLay && availableToLay.length > 0 && (
        <>
          <h2 style={{ color: '#00ff88', marginTop: 24, fontSize: 16 }}>Available to lay</h2>
          {layerMessage && <p style={{ color: '#00ff88' }}>{layerMessage}</p>}
          {availableToLay.map(b => {
            const remaining = getLayable(b);
            const displayRemaining = b.eachWay ? remaining / 2 : remaining;
            const currentBid = parseFloat(bidAmount[b.id] || 0);
const meta = getBetRaceMeta(b);
const liability = currentBid > 0
  ? calcLiability(currentBid, b.odds, {
      eachWay: !!b.eachWay,
      fieldSize: meta.fieldSize,
      isHandicap: meta.isHandicap,
    }).toFixed(2)
  : '0.00';
            return (
              <div key={b.id} style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>
                  {b.event} – {b.selection} @ {b.odds} — £
                  {b.eachWay ? (remaining / 2).toFixed(2) : remaining.toFixed(2)}
                  {b.eachWay ? ' each way' : ' Win'}
                </div>
                <div style={{ color: '#999', fontSize: 13, marginTop: 2 }}>
                  by {b.punterName} at {new Date(b.createdAt).toLocaleTimeString()}
                </div>
                {b.layerTimerEnd && (
                  <div style={{ color: '#ffb347', marginTop: 4, fontSize: 13 }}>
                    Time left: {Math.max(0, Math.floor((new Date(b.layerTimerEnd) - now) / 1000))}s left
                  </div>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (displayRemaining * 0.1).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '3px 7px', fontSize: 11, border: 'none', borderRadius: 4, cursor: 'pointer' }}>10%</button>
                  <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (displayRemaining * 0.25).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '3px 7px', fontSize: 11, border: 'none', borderRadius: 4, cursor: 'pointer' }}>25%</button>
                  <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (displayRemaining * 0.5).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '3px 7px', fontSize: 11, border: 'none', borderRadius: 4, cursor: 'pointer' }}>50%</button>
                  <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: displayRemaining.toFixed(2) }))} style={{ background: '#2d6a4f', color: 'white', padding: '3px 9px', fontSize: 11, border: 'none', borderRadius: 4, cursor: 'pointer' }}>Full</button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input type="number" placeholder="Your lay amount" value={bidAmount[b.id] || ''} onChange={e => setBidAmount(prev => ({ ...prev, [b.id]: e.target.value }))} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                  <button type="button" onClick={() => submitLay(b)} style={{ padding: '6px 12px', fontSize: 13, background: '#0066cc', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Lay</button>
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
                  style={{ marginTop: 9, width: '100%', padding: 7, background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Reject Bet
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}