import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DEFAULT_BRAND = {
  accentColor: '#00ff88',
  bgColor: '#12122a',
  panelColor: '#1a1a2e',
  textColor: '#e8e8e8',
  panelTextColor: '#e8e8e8',
  buttonBgColor: '#00ff88',
  buttonTextColor: '#0b1220',
};

function applyHouseTheme(user) {
  const accent = user?.accentColor || DEFAULT_BRAND.accentColor;
  const bg = user?.bgColor || DEFAULT_BRAND.bgColor;
  const panel = user?.panelColor || DEFAULT_BRAND.panelColor;
  const text = user?.textColor || DEFAULT_BRAND.textColor;
  const panelText = user?.panelTextColor || DEFAULT_BRAND.panelTextColor;
  const btnBg = user?.buttonBgColor || DEFAULT_BRAND.buttonBgColor;
  const btnText = user?.buttonTextColor || DEFAULT_BRAND.buttonTextColor;
  let tag = document.getElementById('btm-house-theme');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'btm-house-theme';
    document.head.appendChild(tag);
  }
  const bgCss = user?.bgColor
    ? ('radial-gradient(1200px 600px at 50% -10%, ' + panel + ' 0%, ' + bg + ' 55%, #07060f 100%)')
    : 'radial-gradient(1200px 600px at 50% -10%, #1a1440 0%, #0b0a1a 55%, #07060f 100%)';
  const btnCss = 'linear-gradient(135deg, ' + btnBg + ', ' + (btnBg === accent ? '#00c6ff' : accent) + ')';
  tag.textContent = [
    'html, body, #root { background: ' + bgCss + ' !important; color: ' + text + ' !important; min-height: 100%; }',
    '#root div, #root span, #root p, #root h2, #root h3, #root label, #root li { color: ' + text + ' !important; }',
    '#root button { background: ' + btnCss + ' !important; color: ' + btnText + ' !important; }',
    '#root input, #root textarea, #root select { color: ' + panelText + ' !important; }',
  ].join(' ');
  document.body.style.background = bgCss;
  document.body.style.color = text;
  try {
    if (user) {
      localStorage.setItem('btm_theme', JSON.stringify({
        logoUrl: '',
        accentColor: accent,
        bgColor: bg,
        panelColor: panel,
        textColor: text,
        panelTextColor: panelText,
        buttonBgColor: btnBg,
        buttonTextColor: btnText,
        houseName: user.houseName || '',
      }));
    }
  } catch (e) {}
  const customLogo = user?.houseLogoUrl && user.houseLogoUrl !== 'in-memory' ? user.houseLogoUrl : '';
  const logoScale = Number(user?.logoScale || 100);
  return { accent, bg, panel, text, panelText, btnBg, btnText, logoSrc: customLogo || '/logo-login.png', logoScale, hasCustomLogo: !!customLogo };
}

function applyDefaultPublicTheme() {
  const bg = DEFAULT_BRAND.bgColor;
  const text = DEFAULT_BRAND.textColor;
  let tag = document.getElementById('btm-house-theme');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'btm-house-theme';
    document.head.appendChild(tag);
  }
  const bgCss = 'radial-gradient(1200px 600px at 50% -10%, #1a1440 0%, #0b0a1a 55%, #07060f 100%)';
  tag.textContent = 'html, body, #root { background: ' + bgCss + ' !important; color: ' + text + ' !important; min-height: 100%; }';
  document.body.style.background = bgCss;
  document.body.style.color = text;
}
const ODDS_LIST = [
"2/1","4/1","1/1","8/1","4/5","8/11","4/6","8/13","4/7","5/1","20/1","11/10",
"1/2","6/5","5/4","11/8","6/4","7/4","15/8","2/5","9/4","12/5","5/2","11/4",
"3/1","10/3","7/2","4/9","9/2","5/6","11/2","6/1","13/2","7/1","15/2","8/15",
"17/5", "17/2","9/1","10/1","11/1","12/1","14/5", "14/1","16/5", "16/1", "18/5", "18/1","20/21","22/1","25/1",
"28/1","33/1","40/1","50/1","66/1","80/1","10/11", "100/1",
];
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscribePush(userId) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Push not supported on this browser");
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Permission: " + permission);
      return false;
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      alert("Missing VITE_VAPID_PUBLIC_KEY");
      return false;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const res = await fetch(`${API}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscription: sub.toJSON() }),
    });
    if (!res.ok) {
      alert("Failed to save subscription");
      return false;
    }

    if (typeof showBetNotification === "function") {
      showBetNotification("Test", "Push enabled");
    }
    return true;
  } catch (e) {
    alert("Push error: " + (e.message || e));
    return false;
  }
}
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
    icon: "/logo-login.png",
    badge: "/logo-login.png",
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
          color: 'inherit',
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
  display: 'block',
  padding: '12px 14px',
  marginBottom: 10,
  background: 'rgba(15, 18, 40, 0.9)',
  color: '#e8e8e8',
  border: '1px solid #2f3a5c',
  borderRadius: 10,
  fontSize: 15,
};

function rememberHouseLogo(houseId, hasCustom) {
  try {
    if (!houseId) return;
    if (hasCustom) sessionStorage.setItem('btm_has_logo_' + houseId, '1');
    else sessionStorage.removeItem('btm_has_logo_' + houseId);
  } catch (e) {}
}
function houseExpectsLogo(houseId) {
  try {
    return !!sessionStorage.getItem('btm_has_logo_' + houseId);
  } catch (e) {
    return false;
  }
}

function persistUser(user) {
  try {
    const slim = { ...user, houseLogoUrl: user?.houseLogoUrl ? 'in-memory' : '' };
    localStorage.setItem('btm_user', JSON.stringify(slim));
  } catch (e) {
    try {
      localStorage.removeItem('btm_theme');
      localStorage.removeItem('btm_user');
      const slim = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        houseId: user.houseId,
        houseMasterId: user.houseMasterId,
        canLay: user.canLay,
        canLayAllowed: user.canLayAllowed,
        balance: user.balance,
        houseLogoUrl: user?.houseLogoUrl ? 'in-memory' : '',
      };
      localStorage.setItem('btm_user', JSON.stringify(slim));
    } catch (e2) {}
  }
}

export default function UserHome() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('btm_user');
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
        setUser(parsed);
      } catch {
        localStorage.removeItem('btm_user');
        applyDefaultPublicTheme();
      }
    } else {
      applyDefaultPublicTheme();
    }
    if (parsed?.id) {
      fetch(`${API}/api/houses/branding?actorId=${parsed.id}`)
        .then(r => r.json())
        .then(data => {
          if (!data.success || !data.house) {
            setUser(u => u ? { ...u, _brandingLoaded: true } : u);
            return;
          }
          const h = data.house;
          setUser(u => {
            const next = {
              ...(u || parsed),
              houseName: h.name,
              houseLogoUrl: h.logoUrl || '',
              accentColor: h.accentColor,
              bgColor: h.bgColor,
              panelColor: h.panelColor,
              textColor: h.textColor,
              panelTextColor: h.panelTextColor,
              buttonBgColor: h.buttonBgColor,
              buttonTextColor: h.buttonTextColor,
              logoScale: h.logoScale,
              _brandingLoaded: true,
            };
            persistUser(next);
            rememberHouseLogo(next.houseId, !!h.logoUrl);
            return next;
          });
        })
        .catch(() => setUser(u => u ? { ...u, _brandingLoaded: true } : u));
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
      persistUser(data.user);
      setUser({ ...data.user, _brandingLoaded: true });
if (data.user.role === 'admin' || data.user.role === 'house') {
  window.location.href = '/ops';
  return;
}
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('btm_user');
    localStorage.removeItem('btm_theme');
    applyDefaultPublicTheme();
    setUser(null);
      useEffect(() => {
    if (!user) return;
    if (user.role === 'admin' || user.role === 'house') {
      window.location.href = '/ops';
    }
  }, [user]);
  };

  if (user) {
    return <UserDashboard user={user} onLogout={logout} onUserUpdate={setUser} />;
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20, color: '#e8e8e8' }}>
      <h1 style={{ textAlign: 'center', margin: 0 }}>
        <img src="/logo-login.png" alt="BetOrLay" style={{ maxWidth: '280px', height: 'auto' }} />
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
          style={{
  width: '100%',
  padding: '14px 16px',
  marginTop: 8,
  background: loading
    ? '#2a2a40'
    : 'linear-gradient(135deg, #00ff88, #00c6ff)',
  color: loading ? '#888' : '#0a0a14',
  border: 'none',
  borderRadius: 10,
  fontWeight: 800,
  fontSize: 16,
  cursor: loading ? 'default' : 'pointer',
  boxShadow: loading ? 'none' : '0 6px 20px rgba(0, 255, 136, 0.3)',
  letterSpacing: '0.3px',
}}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

function UserDashboard({ user, onLogout, onUserUpdate }) {
  const theme = applyHouseTheme(user);
  const [bets, setBets] = useState([]);
const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '', eachWay: false });
  const [message, setMessage] = useState('');
  const [placing, setPlacing] = useState(false);
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
const [oddsSuggestions, setOddsSuggestions] = useState([]);
const [now, setNow] = useState(Date.now());   // ← add this line
const [showMoney, setShowMoney] = useState(() => {
    try {
      const v = localStorage.getItem('btm_show_money');
      if (v === 'false') return false;
    } catch (e) {}
    return true;
  });
  const [accountOpen, setAccountOpen] = useState(false);
const [holdingBets, setHoldingBets] = useState({}); // id -> { bet, message, until }
const prevInProcessIds = useRef(new Set());
  const [noteModal, setNoteModal] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatImage, setChatImage] = useState(null); // data URL or null
  const [chatSending, setChatSending] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const chatOpenRef = useRef(false);
  const [partyMode, setPartyMode] = useState(false);
const [leaderboard, setLeaderboard] = useState([]);
const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const HOUSE_ID = Number(user?.houseMasterId || 7);
  const toggleLayerProfile = async (e) => {
  const next = e.target.checked;
  try {
    const res = await fetch(`${API}/api/users/${user.id}/can-lay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, canLay: next }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return alert(data.error || 'Failed to update layer profile');
    }

    const updated = { ...user, canLay: next };
    persistUser(updated);
    if (typeof onUserUpdate === 'function') onUserUpdate(updated);
    if (!next && customerTab === 'lays') setCustomerTab('slip');
  } catch (err) {
    alert('Failed to update layer profile');
  }
};
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  useEffect(() => {
  const load = async () => {
    try {
      const q = user?.id ? `?actorId=${user.id}` : '';
      const sRes = await fetch(`${API}/api/settings${q}`);
      const sData = await sRes.json();
const enabled = sData.partyMode === true || sData.partyMode === 'true';
      setPartyMode(enabled);

      if (enabled) {
        const lRes = await fetch(`${API}/api/leaderboard${q}`);
        const lData = await lRes.json();
        if (lData.success) setLeaderboard(lData.leaderboard || []);
      } else {
        setLeaderboard([]);
      }
    } catch (_) {}
  };

  load();

  const socket = io(API, { transports: ['websocket', 'polling'] });
  const refresh = () => load();
  socket.on('betUpdated', refresh);
  socket.on('bets:updated', refresh);

  return () => {
    socket.off('betUpdated', refresh);
    socket.off('bets:updated', refresh);
    socket.disconnect();
  };
}, []);
  useEffect(() => {
  chatOpenRef.current = chatOpen;
  if (chatOpen) setChatUnread(0);
}, [chatOpen]);

useEffect(() => {
  if (!user?.id) return;

  const socket = io(API, { transports: ["websocket", "polling"] });

  const refresh = () => {
    fetchBets();
    if (typeof refreshUser === "function") refreshUser();
  };

  socket.on("betUpdated", refresh);
  socket.on("bets:updated", refresh);

  if (user.canLay) {
    socket.on("bet:notify", (payload) => {
      if (payload.phase !== "layer_bidding") return;
      if (Number(payload.punterId) === Number(user.id)) return;
      if (payload.houseId != null && user.houseId != null && Number(payload.houseId) !== Number(user.houseId)) return;

      const stakeLabel = payload.eachWay
        ? `£${Number(payload.originalStake ?? payload.stake / 2).toFixed(0)} each way`
        : `£${payload.stake} Win`;

      showBetNotification(
        "Available to lay",
        `${payload.event} – ${payload.selection} @ ${payload.odds} — ${stakeLabel}`
      );
      fetchBets();
    });
  }

  return () => {
    socket.off("betUpdated", refresh);
    socket.off("bets:updated", refresh);
    socket.off("bet:notify");
    socket.disconnect();
  };
}, [user?.canLay, user?.id]);
    const loadChat = async () => {
    try {
      const res = await fetch(`${API}/api/chat/${HOUSE_ID}?userId=${user.id}`);
      const data = await res.json();
      if (data.success) setChatMessages(data.messages || []);
    } catch (e) {}
  };

  useEffect(() => {
    if (!chatOpen || !user?.id) return;
    loadChat();
  }, [chatOpen, user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    const tick = async () => {
      try {
        const res = await fetch(
          `${API}/api/chat/${HOUSE_ID}?userId=${user.id}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!data.success) return;
        const msgs = data.messages || [];
        setChatMessages((prev) => {
          if (msgs.length > prev.length) {
            const last = msgs[msgs.length - 1];
            if (Number(last.fromUserId) === HOUSE_ID && !chatOpenRef.current) {
              setChatUnread((n) => n + 1);
              if (typeof showBetNotification === 'function') {
                showBetNotification('New message from House', last.body || 'Image');
              }
            }
          }
          return msgs;
        });
      } catch (e) {}
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    const socket = io(API, { transports: ['websocket', 'polling'] });
    socket.emit('chat:join', user.id);
    socket.on('chat:message', (msg) => {
      const involvesMe =
        (Number(msg.fromUserId) === Number(user.id) && Number(msg.toUserId) === HOUSE_ID) ||
        (Number(msg.fromUserId) === HOUSE_ID && Number(msg.toUserId) === Number(user.id));
      if (!involvesMe) return;

      setChatMessages((prev) => {
        if (prev.some((m) => Number(m.id) === Number(msg.id))) return prev;
        return [...prev, msg];
      });

           if (Number(msg.fromUserId) === HOUSE_ID && !chatOpenRef.current) {
        setChatUnread((n) => n + 1);
        if (typeof showBetNotification === 'function') {
          showBetNotification('New message from House', msg.body || 'Image');
        }
      }
    });
    socket.on('chat:ended', ({ userA, userB }) => {
      if (userA === user.id || userB === user.id) {
        setChatMessages([]);
        setChatOpen(false);
      }
    });
    return () => {
      socket.off('chat:message');
      socket.off('chat:ended');
      socket.disconnect();
    };
  }, [user?.id]);
  const fetchBets = async () => {
    try {
      const res = await fetch(`${API}/api/bets${user?.id ? `?actorId=${user.id}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setBets(data);
      }
    } catch (e) {}
  };
    const sendChat = async () => {
    const text = chatText.trim();
    if (!text && !chatImage) return;
    setChatSending(true);
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          fromName: user.name,
          toUserId: HOUSE_ID,
          body: text,
          imageData: chatImage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Send failed');
      } else {
        setChatText('');
        setChatImage(null);
        // message also arrives via socket; optional optimistic:
        if (data.message) {
          setChatMessages((prev) =>
            prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
          );
        }
      }
    } catch (e) {
      alert(e.message);
    }
    setChatSending(false);
  };

  const endChat = async () => {
    if (!window.confirm('End this chat? All messages and images will be deleted.')) return;
    try {
      const res = await fetch(`${API}/api/chat/${HOUSE_ID}?userId=${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) alert(data.error || 'Failed');
      else {
        setChatMessages([]);
        setChatOpen(false);
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 900_000) {
      alert('Image too large (keep under ~900KB)');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setChatImage(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = '';
  };
const searchEvents = async (q) => {
  if (!q || q.length < 2) {
    setEventSuggestions([]);
    setShowEventDropdown(false);
    return;
  }
  try {
    const res = await fetch(`${API}/api/events?q=${encodeURIComponent(q)}${user?.id ? `&actorId=${user.id}` : ''}`);
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
        canLayAllowed: data.canLayAllowed,
        weight: data.weight,
        mustChangePassword: data.mustChangePassword,
        houseLogoUrl: user.houseLogoUrl,
        houseHasLogo: data.houseHasLogo,
        accentColor: data.accentColor,
        bgColor: data.bgColor,
        panelColor: data.panelColor,
        textColor: data.textColor,
        panelTextColor: data.panelTextColor,
        buttonBgColor: data.buttonBgColor,
        buttonTextColor: data.buttonTextColor,
        logoScale: data.logoScale != null ? data.logoScale : user.logoScale,
      };
      if (JSON.stringify(newUser) !== JSON.stringify(user)) {
        persistUser(newUser);
        onUserUpdate(newUser);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchBets();
    refreshUser();
      fetch(`${API}/api/events${user?.id ? `?actorId=${user.id}` : ''}`)
    .then(r => r.json())
    .then(d => setEvents(d.events || []))
    .catch(() => {});
    const interval = setInterval(() => {
      fetchBets();
      refreshUser();
    }, 10000);
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

  // event → { selection → liabilitySum, ewTotal }
  const byEvent = {};

  for (const b of bets) {
    if (b.settledAt || b.phase === 'settled') continue;

    const myBid = (b.layerBids || []).find(
      l => Number(l.layerId) === Number(user.id) && !l.rejected
    );
    if (!myBid) continue;

    const laid = parseFloat(myBid.actualLaid ?? myBid.amount) || 0;
    if (laid <= 0) continue;

    const liability = calcLiability(laid, b.odds);
    const eventKey = (b.event || '').trim() || `bet-${b.id}`;
    const selectionKey = (b.selection || '').trim().toLowerCase() || `sel-${b.id}`;

    if (!byEvent[eventKey]) {
      byEvent[eventKey] = { bySelection: {}, ewTotal: 0 };
    }

    if (b.eachWay) {
      byEvent[eventKey].ewTotal += liability;
    } else {
      byEvent[eventKey].bySelection[selectionKey] =
        (byEvent[eventKey].bySelection[selectionKey] || 0) + liability;
    }
  }

  let exposure = 0;
  for (const data of Object.values(byEvent)) {
    const selectionTotals = Object.values(data.bySelection);
    const maxWin = selectionTotals.length ? Math.max(...selectionTotals) : 0;
    exposure += maxWin + data.ewTotal;
  }

  return Math.round(exposure * 100) / 100;
})();

  const placeBet = async (e) => {
    e.preventDefault();
      if (placing) return;
  setPlacing(true);
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
    setMessage(err.message || 'Failed to place bet');
  } finally {
    setPlacing(false);
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
      persistUser(updatedUser);
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
      alert('Lay bid submitted. Check My Lays for progress.');
      fetchBets();
      await refreshUser();
    } catch (e) {
      setLayerMessage(e.message);
    }
  };
  const openPunterNote = async (aboutUserId, name) => {
    const authorId = user.id;
    try {
      const res = await fetch(`${API}/api/notes/${aboutUserId}?authorId=${authorId}`);
      const data = await res.json();
      setNoteText(data.note || '');
      setNoteModal({ aboutUserId, name, note: data.note || '' });
    } catch {
      setNoteText('');
      setNoteModal({ aboutUserId, name, note: '' });
    }
  };

  const savePunterNote = async () => {
    if (!noteModal) return;
    try {
      const res = await fetch(`${API}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorId: user.id,
          aboutUserId: noteModal.aboutUserId,
          note: noteText,
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Save failed');
      setNoteModal(null);
    } catch {
      alert('Save failed');
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
  useEffect(() => {
    const my = bets.filter(b => Number(b.punterId) === Number(user.id));

    for (const b of my) {
      const key = String(b.id);
      const isPending =
        !b.settledAt &&
        b.status !== 'rejected' &&
        b.phase !== 'finalized' &&
        b.phase !== 'settled';

      const wasPending = prevInProcessIds.current.has(b.id) || prevInProcessIds.current.has(Number(b.id));

      if (wasPending && !isPending) {
        const matched = getMatched(b);
        const stake = Number(b.stake) || 0;
        let message = 'Updated';

        if (b.status === 'rejected' || matched <= 0.01) {
          message = b.settlementNotes
            ? `Not Accepted — ${b.settlementNotes}`
            : 'Not Accepted';
        } else if (matched + 0.01 < stake) {
          message = b.eachWay
            ? `Partially matched £${(matched / 2).toFixed(2)} each way`
            : `Partially matched £${matched.toFixed(2)}`;
        } else {
          message = 'Fully laid';
        }

        console.log('HOLD bet', b.id, message);
        setHoldingBets(h => ({
          ...h,
          [b.id]: { bet: b, message, until: Date.now() + 10000 },
        }));
        setTimeout(() => {
          setHoldingBets(h => {
            const next = { ...h };
            delete next[b.id];
            return next;
          });
        }, 10000);
      }
    }

    const nextSet = new Set(
      my
        .filter(
          b =>
            !b.settledAt &&
            b.status !== 'rejected' &&
            b.phase !== 'finalized' &&
            b.phase !== 'settled'
        )
        .map(b => b.id)
    );
    prevInProcessIds.current = nextSet;
  }, [bets, user.id]);
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
<div style={{ maxWidth: 520, width: '100%', margin: '6px auto', padding: '6px 12px 12px', boxSizing: 'border-box', color: theme.text }}>
  {/* Header */}
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <h1 style={{ textAlign: 'left', margin: 0, lineHeight: 0, fontSize: 0 }}>
          <img src={theme.hasCustomLogo ? theme.logoSrc : (user._brandingLoaded && !houseExpectsLogo(user.houseId) ? '/logo-login.png' : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')} alt={user.houseName || 'BetOrLay'} style={{ maxWidth: Math.round(165 * (theme.logoScale || 100) / 100), maxHeight: Math.round(55 * (theme.logoScale || 100) / 100), width: 'auto', height: 'auto', display: 'block' }} />
        </h1>
        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          aria-label="Account settings"
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: '2px solid #5aa89a',
            background: '#3d8a7e',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="32" fill="#4e9d90" />
            <circle cx="32" cy="24" r="11" fill="#ffffff" />
            <path d="M12 54c3.5-12 12-18 20-18s16.5 6 20 18" fill="#ffffff" />
          </svg>
        </button>
      </div>
      {showMoney && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
            <span
              style={{
                color: '#00ff88',
                fontWeight: 600,
                fontSize: 14,
                letterSpacing: '0.2px',
              }}
            >
              Balance: £{Number(user.balance || 0).toFixed(2)}
            </span>
            {user.canLay && openLaysExposure > 0 && (
              <span
                style={{
                  color: '#ff6b6b',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Open lays: £{openLaysExposure.toFixed(2)}
              </span>
            )}
          </div>
      </div>
      )}
      {/* Forced password change */}
{user.mustChangePassword && user.role !== 'admin' && user.role !== 'house' && (
        <div style={{ background: theme.panel, border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginTop: 16, marginBottom: 16 }}>
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
<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18, marginBottom: 12 }}>
  <button
    type="button"
    onClick={() => setCustomerTab('slip')}
    style={{
      flex: 1,
      minWidth: 100,
      padding: '10px 12px',
      borderRadius: 10,
      border: customerTab === 'slip' ? 'none' : '1px solid #2f3a5c',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: 13,
      background:
        customerTab === 'slip'
          ? theme.btnBg
          : 'rgba(15, 18, 40, 0.9)',
      color: customerTab === 'slip' ? theme.btnText : theme.text,
      boxShadow:
        customerTab === 'slip' ? '0 4px 14px rgba(0, 255, 136, 0.25)' : 'none',
    }}
  >
    Betting Slip
  </button>
  <button
    type="button"
    onClick={() => setCustomerTab('bets')}
    style={{
      flex: 1,
      minWidth: 100,
      padding: '10px 12px',
      borderRadius: 10,
      border: customerTab === 'bets' ? 'none' : '1px solid #2f3a5c',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: 13,
      background:
        customerTab === 'bets'
          ? theme.btnBg
          : 'rgba(15, 18, 40, 0.9)',
      color: customerTab === 'bets' ? theme.btnText : theme.text,
      boxShadow:
        customerTab === 'bets' ? '0 4px 14px rgba(0, 255, 136, 0.25)' : 'none',
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
        minWidth: 100,
        padding: '10px 12px',
        borderRadius: 10,
        border: customerTab === 'lays' ? 'none' : '1px solid #2f3a5c',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: 13,
        background:
          customerTab === 'lays'
            ? theme.btnBg
            : 'rgba(15, 18, 40, 0.9)',
        color: customerTab === 'lays' ? theme.btnText : theme.text,
        boxShadow:
          customerTab === 'lays' ? '0 4px 14px rgba(0, 255, 136, 0.25)' : 'none',
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
      background: theme.panel,
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
            background: theme.panel,
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
inputMode="decimal"
  autoComplete="off"
  spellCheck={false}
  value={bet.odds}
                     onChange={e => {
                      const value = e.target.value;
                      if (
                        value === '' ||
                        /^\d+$/.test(value) ||
                        /^\d+\.\d*$/.test(value) ||
                        /^\d+[\/\-]\d*$/.test(value)
                      ) {
                        setBet({ ...bet, odds: value });
                        if (value === '') {
                          setOddsSuggestions([]);
                        } else {
                          setOddsSuggestions(
                            ODDS_LIST.filter(o => o.startsWith(value)).slice(0, 12)
                          );
                        }
                      }
                    }}
  required
  style={inputStyle}
/>
                     {oddsSuggestions.length > 0 && (
                      <div style={{
                        background: theme.panel,
                        border: '1px solid #3a3a5c',
                        borderRadius: 6,
                        marginTop: 4,
                        maxHeight: 180,
                        overflowY: 'auto',
                      }}>
                        {oddsSuggestions.map(o => (
                          <div
                            key={o}
                            onClick={() => {
                              setBet({ ...bet, odds: o });
                              setOddsSuggestions([]);
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              color: '#e8e8e8',
                              fontSize: 14,
                              borderBottom: '1px solid #2a2a40',
                            }}
                          >
                            {o}
                          </div>
                        ))}
                      </div>
                    )}
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
  disabled={placing}
  style={{
    width: '33%',
    padding: '10px 12px',
    marginTop: 4,
    background: placing ? '#3a3a5c' : theme.btnBg,
    color: theme.btnText,
    border: 'none',
    borderRadius: 7,
    fontWeight: 700,
    fontSize: 14,
    cursor: placing ? 'not-allowed' : 'pointer',
    letterSpacing: '0.3px',
  }}
>
  {placing ? 'Submitting…' : 'Submit bet'}
</button>
            </form>
            {message && <p style={{ color: '#00ff88' }}>{message}</p>}
          </CollapsibleSection>
          {partyMode && (
  <CollapsibleSection
    title="🏆 Leaderboard"
    open={leaderboardOpen}
    onToggle={setLeaderboardOpen}
  >
    <div style={{
      background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
      border: '1px solid #3a3a5c',
      borderRadius: 12,
      padding: '16px',
      overflow: 'hidden',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: 14,
        fontSize: 13,
        color: '#00ff88',
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>
        Party Mode • Live Standings
      </div>

      {leaderboard.length === 0 && (
        <p style={{ color: '#999', textAlign: 'center' }}>No punters yet</p>
      )}

      {leaderboard.map((row) => {
        const isTop3 = row.rank <= 3;
        const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null;
        const arrow =
          row.movement === 'up'   ? <span style={{ color: '#00ff88' }}>▲</span> :
          row.movement === 'down' ? <span style={{ color: '#ff6b6b' }}>▼</span> :
                                    <span style={{ color: '#888' }}>–</span>;

        return (
          <div
            key={row.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              marginBottom: 6,
              borderRadius: 10,
              background: isTop3
                ? 'linear-gradient(90deg, rgba(0,255,136,0.12), rgba(0,198,255,0.08))'
                : 'rgba(255,255,255,0.03)',
              border: isTop3 ? '1px solid rgba(0,255,136,0.25)' : '1px solid transparent',
            }}
          >
            <div style={{
              width: 36,
              textAlign: 'center',
              fontWeight: 800,
              fontSize: isTop3 ? 18 : 15,
              color: isTop3 ? '#00ff88' : '#c8c8d8',
            }}>
              {medal || row.rank}
            </div>

            <div style={{ width: 18, textAlign: 'center', fontSize: 14 }}>
              {arrow}
            </div>

            <div style={{
              flex: 1,
              fontWeight: isTop3 ? 700 : 500,
              color: isTop3 ? '#fff' : '#e0e0e0',
              fontSize: 15,
            }}>
              {row.name}
            </div>

            <div style={{
              fontWeight: 700,
              fontSize: 15,
              color: '#00ff88',
              fontVariantNumeric: 'tabular-nums',
            }}>
              £{row.net.toFixed(0)}
            </div>
          </div>
        );
      })}
    </div>
  </CollapsibleSection>
)}
          {/* Pending bets shown under slip */}
{(inProcess.length > 0 || Object.values(holdingBets).some(h => h.until > Date.now())) && (
  <div style={{ marginTop: 10 }}>
    <div style={{ color: '#ffb347', fontWeight: 600, marginBottom: 10 }}>
In Process ({inProcess.length + Object.values(holdingBets).filter(h => h.until > Date.now()).length})
    </div>
{inProcess.map(b => (
  <div key={b.id} style={{ background: theme.panel, border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
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
            {Object.values(holdingBets)
              .filter(h => h.until > Date.now())
              .map(({ bet: b, message }) => (
                <div
                  key={`hold-${b.id}`}
                  style={{
                    background: theme.panel,
                    border: '1px solid #3a3a5c',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {b.event} – {b.selection} @ {b.odds}
                  </div>
                  <div style={{ color: '#b0b0b0', marginTop: 4 }}>
                    £{b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
                    {b.eachWay ? ' E/W' : ' Win'}
                  </div>
                  <div style={{ marginTop: 6, color: '#00ff88', fontWeight: 600 }}>{message}</div>
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
                <div key={b.id} style={{ background: theme.panel, border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
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
        <div key={b.id} style={{ background: theme.panel, border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
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
                <div key={b.id} style={{ background: theme.panel, border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>
                    {b.selection} @ {b.odds} — £
                    {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
                    {b.eachWay ? ' each way' : ''}
                  </div>
                  <div style={{ marginTop: 6, color: '#ff6b6b' }}>Not Accepted</div>
                                    {b.settlementNotes && (
                    <div style={{ marginTop: 4, fontSize: 13, color: '#ffb347' }}>
                      Note: {b.settlementNotes}
                    </div>
                  )}
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
              const bidAmt = parseFloat(myBid?.amount) || 0;
              const hasActual = myBid?.actualLaid != null;
              const actual = Number(myBid?.actualLaid);
              const wasCut = hasActual && actual > 0 && actual < bidAmt - 0.01;
              const layStatus = !hasActual
                ? ' (awaiting apportioning)'
                : actual === 0
                  ? ' — Bid rejected, bet filled by other layers'
                  : wasCut
                    ? ' (apportioned)'
                    : '';
              return (
                <div key={b.id} style={{ background: theme.panel, border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>
                    {b.selection} @ {b.odds} — £
                    {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
                    {b.eachWay ? ' each way' : ''}
                  </div>
                                  <div style={{ color: '#999', fontSize: 13, marginTop: 2 }}>
by{' '}
<span
  onClick={() => openPunterNote(b.punterId, b.punterName)}
  style={{ color: '#00ff88', cursor: 'pointer', textDecoration: 'underline' }}
>
  {b.punterName}
</span> 
                </div>
                  <div style={{ marginTop: 6, color: '#00ff88' }}>
                    Your lay: £{b.eachWay ? (laid / 2).toFixed(2) : laid.toFixed(2)}
                    {b.eachWay ? ' each way' : ''}
                    {layStatus}
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

const resultColor = isManual || isPlaced
  ? '#ffb347'
  : isWon
    ? '#ff6b6b'
    : '#00ff88';
              return (
                <div key={b.id} style={{ background: theme.panel, border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ fontWeight: 600 }}>{b.event}</div>
                  <div style={{ color: '#b0b0b0' }}>
                    {b.selection} @ {b.odds} — £
                    {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
                    {b.eachWay ? ' each way' : ''}
                  </div>
                                    <div style={{ color: '#999', fontSize: 13, marginTop: 2 }}>
by{' '}
<span
  onClick={() => openPunterNote(b.punterId, b.punterName)}
  style={{ color: '#00ff88', cursor: 'pointer', textDecoration: 'underline' }}
>
  {b.punterName}
</span>
                  </div>
                  <div style={{ marginTop: 6 }}>Your lay: £{laid.toFixed(2)}</div>
<div style={{ marginTop: 4, fontWeight: 600, color: resultColor }}>
  {isManual
    ? 'SETTLED (Manual)'
    : isWon
      ? `Selection won — You lose £${liability.toFixed(2)}`
      : isPlaced
        ? `Selection placed — see settlement`
        : `Selection lost — You win £${laid.toFixed(2)}`}
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
              <div key={b.id} style={{ background: theme.panel, border: '1px solid #3a3a5c', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>
                  {b.event} – {b.selection} @ {b.odds} — £
                  {b.eachWay ? (remaining / 2).toFixed(2) : remaining.toFixed(2)}
                  {b.eachWay ? ' each way' : ' Win'}
                </div>
                <div style={{ color: '#999', fontSize: 13, marginTop: 2 }}>
by{' '}
<span
  onClick={() => openPunterNote(b.punterId, b.punterName)}
  style={{ color: '#00ff88', cursor: 'pointer', textDecoration: 'underline' }}
>
  {b.punterName}
</span>
{' '}at {new Date(b.createdAt).toLocaleTimeString()}
                </div>
                {b.layerTimerEnd && (
                  <div style={{ color: '#ffb347', marginTop: 4, fontSize: 13 }}>
                    Time left: {Math.max(0, Math.floor((new Date(b.layerTimerEnd) - now) / 1000))}s left
                  </div>
                )}
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (displayRemaining * 0.1).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '8px 14px', fontSize: 14, border: 'none', borderRadius: 5, cursor: 'pointer' }}>10%</button>
                  <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (displayRemaining * 0.25).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '8px 14px', fontSize: 14, border: 'none', borderRadius: 5, cursor: 'pointer' }}>25%</button>
                  <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: (displayRemaining * 0.5).toFixed(2) }))} style={{ background: '#3a3a5c', color: 'white', padding: '8px 14px', fontSize: 14, border: 'none', borderRadius: 5, cursor: 'pointer' }}>50%</button>
                  <button type="button" onClick={() => setBidAmount(prev => ({ ...prev, [b.id]: displayRemaining.toFixed(2) }))} style={{ background: '#2d6a4f', color: 'white', padding: '8px 14px', fontSize: 14, border: 'none', borderRadius: 5, cursor: 'pointer' }}>Full</button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input type="number" placeholder="Your lay amount" value={bidAmount[b.id] || ''} onChange={e => setBidAmount(prev => ({ ...prev, [b.id]: e.target.value }))} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                  <button type="button" onClick={() => submitLay(b)} style={{ padding: '12px 12px', fontSize: 14, background: '#0066cc', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Lay</button>
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
                style={{
                  marginTop: 8,
                  padding: '7px 14px',
                  fontSize: 13,
                  background: '#7f1d1d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}  
                >
                  Reject Bet
                </button>
              </div>
            );
          })}
        </>
      )}
          {/* Chat button */}
      <button
        type="button"
        onClick={() => {
          setChatOpen(true);
          setChatUnread(0);
        }}
style={{
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 900,
  padding: '14px 18px',
  borderRadius: 28,
  border: 'none',
  background: 'linear-gradient(135deg, #00ff88, #00c6ff)',
  color: '#0a0a14',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(0, 255, 136, 0.4)',
}}
      >
        Chat{chatUnread > 0 ? ` (${chatUnread})` : ''}
      </button>

      {/* Chat panel */}
      {chatOpen && (
        <div
          style={{
            position: 'fixed',
            right: 12,
            bottom: 12,
            width: 'min(360px, calc(100vw - 24px))',
            height: 'min(480px, calc(100vh - 24px))',
            background: theme.panel,
            border: '1px solid #3a3a5c',
            borderRadius: 12,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            color: '#e8e8e8',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #3a3a5c',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
            }}
          >
            <span>Chat with House</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={endChat}
                style={{
                  background: '#7f1d1d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                End
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                style={{
                  background: '#3a3a5c',
                  color: '#e8e8e8',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {chatMessages.length === 0 && (
              <div style={{ color: '#999', fontSize: 13 }}>No messages yet.</div>
            )}
            {chatMessages.map((m) => {
              const mine = Number(m.fromUserId) === Number(user.id);
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '80%',
                      background: mine ? '#2d6a4f' : '#252540',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: 14,
                    }}
                  >
                    {!mine && (
                      <div style={{ fontSize: 11, color: '#00ff88', marginBottom: 4 }}>
                        {m.fromName}
                      </div>
                    )}
                    {m.body ? <div>{m.body}</div> : null}
                    {m.imageData && (
                      <img
                        src={m.imageData}
                        alt="attachment"
                        style={{
                          maxWidth: '100%',
                          borderRadius: 6,
                          marginTop: m.body ? 6 : 0,
                        }}
                      />
                    )}
                    <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                      {new Date(m.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {chatImage && (
            <div style={{ padding: '0 12px 8px' }}>
              <img src={chatImage} alt="preview" style={{ maxHeight: 80, borderRadius: 6 }} />
              <button
                type="button"
                onClick={() => setChatImage(null)}
                style={{
                  marginLeft: 8,
                  background: '#3a3a5c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          )}

          <div
            style={{
              padding: 10,
              borderTop: '1px solid #3a3a5c',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <label
              style={{
                background: '#3a3a5c',
                padding: '8px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              📎
              <input type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
            </label>
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="Message House..."
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #3a3a5c',
                background: '#0f0c29',
                color: '#e8e8e8',
              }}
            />
            <button
              type="button"
              onClick={sendChat}
              disabled={chatSending}
              style={{
                background: '#00ff88',
                color: '#0f0c29',
                border: 'none',
                borderRadius: 6,
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
      {accountOpen && (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => setAccountOpen(false)}>
    <div onClick={e => e.stopPropagation()} style={{ background: theme.panel, padding: 20, borderRadius: 12, maxWidth: 360, width: '90%', border: '1px solid #3a3a5c', color: theme.panelText, position: 'relative' }}>
      <button type="button" onClick={() => setAccountOpen(false)} aria-label="Close" style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, border: 'none', background: 'transparent', color: theme.text, fontSize: 22, lineHeight: '32px', cursor: 'pointer' }}>×</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingRight: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#3d8a7e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="32" fill="#4e9d90" />
            <circle cx="32" cy="24" r="11" fill="#ffffff" />
            <path d="M12 54c3.5-12 12-18 20-18s16.5 6 20 18" fill="#ffffff" />
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{user.name}</div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Account</div>
        </div>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <div style={{ color: '#00ff88', fontWeight: 700, marginBottom: 6 }}>Balance: £{Number(user.balance || 0).toFixed(2)}</div>
        <div style={{ color: '#ff6b6b', fontWeight: 600 }}>Open lays: £{Number(openLaysExposure || 0).toFixed(2)}</div>
      </div>
      {!!user.canLayAllowed && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!user.canLay} onChange={toggleLayerProfile} />
          Activate Lays
        </label>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!showMoney}
          onChange={() => {
            setShowMoney(v => {
              const next = !v;
              try { localStorage.setItem('btm_show_money', next ? 'true' : 'false'); } catch (e) {}
              return next;
            });
          }}
        />
        Show balance on home screen
      </label>
      {typeof Notification !== "undefined" && Notification.permission !== "granted" && (
        <button
          type="button"
          onClick={() => {
            if (typeof Notification === "undefined") {
              alert("On iPhone: tap Share → Add to Home Screen, then open BetOrLay from the home screen icon and try again.");
              return;
            }
            subscribePush(user.id);
          }}
          style={{ width: '100%', padding: 10, marginBottom: 12, background: '#3a3a5c', color: '#e8e8e8', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Enable notifications
        </button>
      )}
      <button type="button" onClick={onLogout} style={{ width: '100%', padding: '7px 10px', marginTop: 4, background: theme.btnBg, color: theme.btnText, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
        Log out
      </button>
    </div>
  </div>
)}
      {noteModal && (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div style={{ background: theme.panel, padding: 20, borderRadius: 10, maxWidth: 400, width: '90%', border: '1px solid #3a3a5c', color: '#e8e8e8' }}>
      <h3 style={{ color: '#00ff88', marginTop: 0 }}>Notes — {noteModal.name}</h3>
      <textarea
        value={noteText}
        onChange={e => setNoteText(e.target.value)}
        rows={5}
        placeholder="enter notes"
        style={{ width: '100%', padding: 10, background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', borderRadius: 6, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" onClick={() => setNoteModal(null)} style={{ flex: 1, padding: 10, background: '#3a3a5c', color: '#e8e8e8', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        <button type="button" onClick={savePunterNote} style={{ flex: 1, padding: 10, background: '#00ff88', color: '#0f0c29', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Save</button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}