import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

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
    icon: "/logo3.png",
    badge: "/logo3.png",
    tag: "btm-bet-" + Date.now(),
  };

  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready
    .then((reg) => reg.showNotification(title, opts))
    .catch(() => {});
}
function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-open when defaultOpen becomes true (e.g. residual bets appear)
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

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

function Ops() {
  const [activeTab, setActiveTab] = useState('house');   // was 'punter'
const [currentUser, setCurrentUser] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem('btm_user'));
  } catch {
    return null;
  }
});
const [authName, setAuthName] = useState('');
  const [bet, setBet] = useState({ event: '', selection: '', odds: '', stake: '' });
  const [message, setMessage] = useState('');
  const [layerMessage, setLayerMessage] = useState('');
  const [allBets, setAllBets] = useState([]);
  const [partialAmount, setPartialAmount] = useState({});
  const [bidAmount, setBidAmount] = useState({});
  const [showBidConfirm, setShowBidConfirm] = useState(null);
    const [users, setUsers] = useState([]);
  const [balanceUserId, setBalanceUserId] = useState(7);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [authEmail, setAuthEmail] = useState(''); 
  const [authPassword, setAuthPassword] = useState('');
const [ledger, setLedger] = useState([]);
const [events, setEvents] = useState([]);
const [eventForm, setEventForm] = useState({ type: 'horse', name: '', date: '' });
const [csvText, setCsvText] = useState('');
const [eventMessage, setEventMessage] = useState('');
const [chatTabUnread, setChatTabUnread] = useState(0);
const [settings, setSettings] = useState({
  skipHouseFirstLook: false,
  skipHouseResidual: false,
  layerTimerSeconds: 30,
});
  const [chatConversations, setChatConversations] = useState([]);
  const [chatOtherId, setChatOtherId] = useState(null);
  const [chatOtherName, setChatOtherName] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatImage, setChatImage] = useState(null);
  const [chatSending, setChatSending] = useState(false);
  const HOUSE_ID = 7;
const inputStyle = {
  width: '100%',
  padding: '10px',
  marginBottom: 8,
  background: '#1a1a2e',
  color: '#e8e8e8',
  border: '1px solid #3a3a5c',
  borderRadius: 6,
  boxSizing: 'border-box',
};
const fetchEvents = async () => {
  try {
    const res = await fetch(`${API}/api/events`);
    const data = await res.json();
    if (data.success) setEvents(data.events || []);
  } catch (e) {}
};

  useEffect(() => {
    fetchEvents();
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  useEffect(() => {
    const socket = io(API, { transports: ["websocket", "polling"] });

    socket.on("bet:notify", (payload) => {
      const stakeLabel = payload.eachWay
        ? `£${Number(payload.originalStake ?? payload.stake / 2).toFixed(0)} each way`
        : `£${payload.stake} Win`;

      if (payload.phase === "house_review") {
        showBetNotification(
          "New bet – House review",
          `${payload.event} – ${payload.selection} @ ${payload.odds} – ${stakeLabel} (${payload.punterName || ""})`
        );
        if (typeof fetchBets === "function") fetchBets();
      }
      if (payload.phase === "house_residual") {
        showBetNotification(
          "Residual look",
          `${payload.event} – ${payload.selection} @ ${payload.odds} – ${stakeLabel}`
        );
        if (typeof fetchBets === "function") fetchBets();
      }
    });

    return () => {
      socket.off("bet:notify");
      socket.disconnect();
    };
  }, []);
  const addEvent = async () => {
    if (!eventForm.name || !eventForm.date) return alert('Name and date required');
    try {
      const res = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventForm),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Failed');
      setEventForm({ type: 'horse', name: '', date: '' });
      setEventMessage('Event added');
      fetchEvents();
    } catch (e) {
      alert('Failed to add event');
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await fetch(`${API}/api/events/${id}`, { method: 'DELETE' });
      fetchEvents();
    } catch (e) {
      alert('Delete failed');
    }
  };
    const loadConversations = async () => {
    try {
      const res = await fetch(`${API}/api/chat?userId=${HOUSE_ID}`);
      const data = await res.json();
      if (data.success) setChatConversations(data.conversations || []);
    } catch (e) {}
  };

  const loadThread = async (otherId) => {
    try {
      const res = await fetch(`${API}/api/chat/${otherId}?userId=${HOUSE_ID}`);
      const data = await res.json();
      if (data.success) setChatMessages(data.messages || []);
    } catch (e) {}
  };

  useEffect(() => {
    if (activeTab !== 'chat') return;
    loadConversations();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'chat' || !chatOtherId) return;
    loadThread(chatOtherId);
  }, [activeTab, chatOtherId]);

  useEffect(() => {
const socket = io(API, { transports: ['websocket', 'polling'] });
socket.emit('chat:join', HOUSE_ID);
    socket.on('chat:message', (msg) => {
  if (Number(msg.fromUserId) !== HOUSE_ID && Number(msg.toUserId) !== HOUSE_ID) return;

  loadConversations();

  if (Number(msg.fromUserId) !== HOUSE_ID) {
    const viewingThis =
      chatOtherId &&
      (Number(msg.fromUserId) === Number(chatOtherId) ||
        Number(msg.toUserId) === Number(chatOtherId));

    if (!viewingThis) {
      setChatTabUnread((n) => n + 1);
      if (typeof showBetNotification === 'function') {
        showBetNotification(
          'New chat message',
          `${msg.fromName || 'Punter'}: ${msg.body || 'Image'}`
        );
      }
    }

    if (viewingThis) {
      setChatMessages((prev) =>
        prev.some((m) => Number(m.id) === Number(msg.id)) ? prev : [...prev, msg]
      );
    }
    return;
  }

  if (
    chatOtherId &&
    (Number(msg.fromUserId) === Number(chatOtherId) ||
      Number(msg.toUserId) === Number(chatOtherId))
  ) {
    setChatMessages((prev) =>
      prev.some((m) => Number(m.id) === Number(msg.id)) ? prev : [...prev, msg]
    );
  }
});
    socket.on('chat:ended', ({ userA, userB }) => {
      if (userA === chatOtherId || userB === chatOtherId) {
        setChatMessages([]);
        setChatOtherId(null);
      }
      loadConversations();
    });
    return () => {
      socket.off('chat:message');
      socket.off('chat:ended');
      socket.disconnect();
    };
  }, [chatOtherId]);
  const sendChat = async () => {
    if (!chatOtherId) return;
    const text = chatText.trim();
    if (!text && !chatImage) return;
    setChatSending(true);
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: HOUSE_ID,
          fromName: 'House',
          toUserId: chatOtherId,
          body: text,
          imageData: chatImage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) alert(data.error || 'Send failed');
      else {
        setChatText('');
        setChatImage(null);
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
    if (!chatOtherId) return;
    if (!window.confirm('End this chat? All messages and images will be deleted.')) return;
    try {
      const res = await fetch(
        `${API}/api/chat/${chatOtherId}?userId=${HOUSE_ID}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) alert(data.error || 'Failed');
      else {
        setChatMessages([]);
        setChatOtherId(null);
        loadConversations();
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
const uploadCsvFromText = async (text) => {
  const raw = (text || '').trim();
  if (!raw) return alert('No file content');

  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return alert('Need header + data rows');

  const delim = lines[0].includes('\t') ? '\t' : ',';
  const splitLine = (line) =>
    line.split(delim).map(s => s.trim().replace(/^["']|["']$/g, ''));

  const header = splitLine(lines[0]).map(h => h.toLowerCase());

  const findCol = (...names) => {
    for (const n of names) {
      const i = header.findIndex(h => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  const idxCourse = findCol('race_course', 'course', 'track', 'venue');
  const idxDate = findCol('race_date', 'date');
  const idxTime = findCol('race_off_time', 'race_off_ti', 'off_time', 'scheduled', 'time');
  const idxHandicap = findCol('handicap', 'race_type', 'race_name', 'race_race');
  const idxField = findCol('race_field', 'field_size', 'fieldsize', 'field');
  let idxHorse = 20;
  if (idxCourse < 0 || idxDate < 0 || idxTime < 0) {
    return alert('Could not find course/date/time columns.\n\nHeaders:\n' + header.join(' | '));
  }

  const raceMap = new Map();
  const runnerRows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = splitLine(lines[i]);
    if (parts.length < 4) continue;

    const course = parts[idxCourse] || '';
    const dateStr = parts[idxDate] || '';
    const timeStr = parts[idxTime] || '';
    if (!course || !dateStr) continue;

    let timeDigits = (timeStr || '').replace(/[^\d]/g, '');
    if (timeDigits.length === 3) timeDigits = '0' + timeDigits;
    if (timeDigits.length >= 4) timeDigits = timeDigits.slice(0, 4);
    else if (timeDigits.length > 0) timeDigits = timeDigits.padStart(4, '0');
    else timeDigits = '0000';

    const timeLabel = String(parseInt(timeDigits, 10));
    const name = `${timeLabel} ${course}`.replace(/\s+/g, ' ').trim();
    if (name.length < 3) continue;

    let date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      const m = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (m) {
        const y = m[3].length === 2 ? '20' + m[3] : m[3];
        date = new Date(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
      }
    }
    if (timeDigits.length === 4 && !isNaN(date.getTime())) {
      date.setHours(parseInt(timeDigits.slice(0, 2), 10), parseInt(timeDigits.slice(2, 4), 10), 0, 0);
    }
    if (isNaN(date.getTime())) continue;

    const handRaw = ((idxHandicap >= 0 ? parts[idxHandicap] : '') || '').toLowerCase();
    const isHandicap =
      handRaw === 'y' || handRaw === 'yes' || handRaw === 'true' || handRaw === '1' ||
      handRaw.includes('handicap');
    const fieldSize = idxField >= 0 ? parseInt(parts[idxField], 10) : NaN;
    const field = Number.isFinite(fieldSize) ? fieldSize : null;

    const key = `${name}|${date.toISOString().slice(0, 16)}`;
    if (!raceMap.has(key)) {
      raceMap.set(key, {
        type: 'horse',
        name,
        date: date.toISOString(),
        isHandicap,
        fieldSize: field,
      });
    }

    if (idxHorse >= 0) {
      const horse = (parts[idxHorse] || '').trim();
      if (horse) runnerRows.push({ key, horse });
    }
  }

  const raceList = Array.from(raceMap.values());
  if (!raceList.length) {
    return alert('No races found.\n\nHeaders:\n' + header.join(' | '));
  }

  try {
    const res = await fetch(`${API}/api/events/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: raceList }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'Event upload failed');

    const evRes = await fetch(`${API}/api/events`);
    const evData = await evRes.json();
    const allEvents = evData.events || [];
    const idByKey = new Map();
    for (const ev of allEvents) {
      const k = `${ev.name}|${new Date(ev.date).toISOString().slice(0, 16)}`;
      idByKey.set(k, ev.id);
    }

    const runners = [];
const seen = new Set();
    for (const { key, horse } of runnerRows) {
      const eventId = idByKey.get(key);
      if (!eventId) continue;
      const sk = `${eventId}|${horse.toLowerCase()}`;
      if (seen.has(sk)) continue;
      seen.add(sk);
      runners.push({ eventId, name: horse });
    }

    if (runners.length) {
      await fetch(`${API}/api/runners/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runners }),
      });
    }

    setEventMessage(`Uploaded ${data.count} races, ${runners.length} runners`);
    fetchEvents();
} catch (e) {
  alert('Upload failed: ' + (e && e.message ? e.message : String(e)));
}
};
const uploadFootballCsvFromText = async (text) => {
  const lines = text.replace(/\r/g, '').trim().split('\n');
  if (lines.length < 2) {
    setEventMessage('Empty CSV');
    return;
  }

  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  const idx = (names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h === n || h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iDate = idx(['date']);
  const iTime = idx(['time']);
  const iHome = idx(['home_team', 'home']);
  const iAway = idx(['away_team', 'away']);

  if (iDate < 0 || iHome < 0 || iAway < 0) {
    setEventMessage('Need columns: date, home_team, away_team (time optional)');
    return;
  }

  const events = [];
  for (let r = 1; r < lines.length; r++) {
         const cols = lines[r].split(delim).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const home = (cols[iHome] || '').trim();
      const away = (cols[iAway] || '').trim();
      if (!home || !away) continue;

      const dateStr = (cols[iDate] || '').trim();
      const timeStr = (iTime >= 0 ? (cols[iTime] || '15:00') : '15:00').trim();

      // Support 21/08/2026, 21-08-26, 2026-08-21
      let dd, mm, yyyy;
      const parts = dateStr.split(/[\/\-]/).map(p => parseInt(String(p).trim(), 10));

      if (parts.length >= 3 && parts[0] > 31) {
        // yyyy-mm-dd
        yyyy = parts[0];
        mm = parts[1];
        dd = parts[2];
      } else if (parts.length >= 3) {
        // dd/mm/yyyy
        dd = parts[0];
        mm = parts[1];
        yyyy = parts[2];
      } else {
        continue;
      }

      if (yyyy < 100) yyyy += 2000;

      const timeParts = timeStr.split(':');
      const hh = parseInt(timeParts[0], 10) || 15;
      const min = parseInt(timeParts[1], 10) || 0;

      if (!dd || !mm || !yyyy || yyyy < 2020) continue;

      const iso = new Date(yyyy, mm - 1, dd, hh, min);
      if (isNaN(iso.getTime())) continue;

      events.push({
        type: 'football',
        name: `${home} v ${away}`,
        date: iso.toISOString(),
        isHandicap: false,
        fieldSize: null,
        active: true,
      });
  }

  if (!events.length) {
    setEventMessage('No football rows parsed');
    return;
  }

  try {
    const res = await fetch(`${API}/api/events/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setEventMessage(data.error || 'Upload failed');
      return;
    }
    setEventMessage(`Uploaded ${data.count} football fixtures`);
    fetchEvents();
  } catch (e) {
    setEventMessage('Upload failed');
  }
};
const fetchBets = async () => {
  try {
    const res = await fetch(`${API}/api/bets`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setAllBets(data);
    }
  } catch (e) {}
};

const fetchLedger = async () => {
  try {
    const res = await fetch(`${API}/api/ledger?limit=100`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setLedger(data);
    }
  } catch (e) {}
};
const fetchSettings = async () => {
  try {
    const res = await fetch(`${API}/api/settings`);
    if (res.ok) setSettings(await res.json());
  } catch (e) {}
};
useEffect(() => {
  fetchBets();
  fetchUsers();
  fetchLedger();
  fetchSettings();
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
    const setUserAuth = async () => {
    if (!authEmail || !authPassword) {
      alert('Email and password required');
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authName,
          userId: authUserId,
          email: authEmail,
          password: authPassword,
          role: authRole,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed');
        return;
      }
      alert(`Login set for user ${data.userId}: ${data.email} (${data.role})`);
      setAuthPassword('');
      fetchUsers();
    } catch (e) {
      alert(e.message);
    }
  };
const saveSettings = async () => {
  try {
    const res = await fetch(`${API}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) return alert('Failed to save settings');
    const data = await res.json();
    if (data.settings) setSettings(data.settings);
    alert('Settings saved');
  } catch (e) {
    alert('Failed to save settings');
  }
};
const createNewUser = async () => {
  if (!authName || !authEmail || !authPassword) {
    alert('Full name, email and temporary password required');
    return;
  }
  try {
    const res = await fetch(`${API}/api/auth/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: authName,
        email: authEmail,
        password: authPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to create user');
      return;
    }
    alert(`User created (id ${data.userId}): ${data.email}`);
    setAuthName('');
    setAuthEmail('');
    setAuthPassword('');
    fetchUsers();
  } catch (e) {
    alert(e.message);
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
const askPlaceFraction = () => {
  const choice = window.prompt(
    'Place terms for this each-way bet?\n\n' +
      '5 = 1/5\n' +
      '4 = 1/4\n' +
      '3 = 1/3\n' +
      '2 = 1/2\n' +
      '0 = Win only\n\n' +
      'Enter 5, 4, 3, 2 or 0:'
  );
  const map = {
    '5': 0.2,
    '4': 0.25,
    '3': 1 / 3,
    '2': 0.5,
    '0': null,
  };
  if (choice == null) return undefined;
  if (!(choice in map)) {
    alert('Invalid choice');
    return undefined;
  }
  return map[choice];
};

const settleEachWay = async (bet, result) => {
  const placeFraction = askPlaceFraction();
  if (placeFraction === undefined) return;

  if (result === 'placed' && placeFraction === null) {
    if (!window.confirm('Win only — settle as LOST?')) return;
    return handleSettle(bet.id, 'lost');
  }

  const label =
    placeFraction === null ? 'Win only' :
    placeFraction === 0.2 ? '1/5' :
    placeFraction === 0.25 ? '1/4' :
    placeFraction === 0.5 ? '1/2' : '1/3';

  if (!window.confirm(`Confirm ${result.toUpperCase()} with place terms: ${label}?`)) return;

  try {
    const res = await fetch(`${API}/api/bets/${bet.id}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result,
        placeFraction,
        notes: `EW terms: ${label}`,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return alert(data.error || 'Settlement failed');
    }
    fetchBets();
    if (typeof fetchUsers === 'function') fetchUsers();
  } catch (e) {
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

  // Collect per-layer adjustments for anyone who actually laid
  const layers = [];
  const layerBids = (bet.layerBids || []).filter(l => {
    const amt = parseFloat(l.actualLaid != null ? l.actualLaid : l.amount) || 0;
    return amt > 0 && !l.rejected;
  });

  for (const l of layerBids) {
    const name = l.layerName || `Layer ${l.layerId}`;
    const laid = parseFloat(l.actualLaid != null ? l.actualLaid : l.amount) || 0;
    const deltaStr = window.prompt(
      `Layer "${name}" (laid £${laid.toFixed(2)}) balance change:`,
      '0'
    );
    if (deltaStr === null) return; // user cancelled
    const delta = parseFloat(deltaStr) || 0;
    if (delta !== 0) {
      layers.push({ layerId: l.layerId, delta });
    }
  }

  handleManualSettle(bet.id, notes, { punterDelta, houseDelta, layers });
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

  const getExposure = (stake, oddsStr, opts = {}) => {
    const s = parseFloat(stake) || 0;
    if (s <= 0) return 0;

    const mult = oddsToLiabilityMultiplier(oddsStr);
    const eachWay = !!opts.eachWay;
    const round2 = (n) => Math.round(Number(n) * 100) / 100;

    if (!eachWay) {
      return round2(s * mult);
    }

    const part = s / 2;
    const frac = getPlaceFraction(opts.fieldSize, opts.isHandicap);

    if (frac == null) {
      return round2(part * mult);
    }

    return round2(part * mult + part * mult * frac);
  };
const getBetRaceMeta = (bet) => {
  const name = (bet.event || '').toLowerCase();
  const ev = (events || []).find(e => (e.name || '').toLowerCase() === name);
  return {
    fieldSize: ev?.fieldSize ?? null,
    isHandicap: !!ev?.isHandicap,
  };
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
const meta = getBetRaceMeta(b);
total += getExposure(amt, b.odds, {
  eachWay: !!b.eachWay,
  fieldSize: meta.fieldSize,
  isHandicap: meta.isHandicap,
}) || 0;
  }
    return Math.round(total * 100) / 100;
};
const getHouseExposure = () => {
  let total = 0;
  for (const b of allBets) {
    if (b.status === 'rejected') continue;
    if (b.phase === 'settled' || b.settledAt) continue;   // only skip settled
    const houseAmt = parseFloat(b.houseAmount) || 0;
    if (houseAmt <= 0) continue;
const meta = getBetRaceMeta(b);
total += getExposure(houseAmt, b.odds, {
  eachWay: !!b.eachWay,
  fieldSize: meta.fieldSize,
  isHandicap: meta.isHandicap,
}) || 0;
  }
    return Math.round(total * 100) / 100;
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
<div style={{ maxWidth: 520, width: '100%', margin: '10px auto', padding: 12, boxSizing: 'border-box', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h1 style={{ textAlign: 'left', margin: 0 }}>
          <img src="/logo3.png" alt="BetTheMan" style={{ maxWidth: '240px', height: 'auto' }} />
        </h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#b0b0b0', marginBottom: 6, fontSize: 14 }}>
            {currentUser?.name}
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('btm_user');
              window.location.href = '/';
            }}
            style={{
              padding: '8px 12px',
              background: '#3a3a5c',
              color: '#e8e8e8',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
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
                subscribePush(currentUser?.id || 7);
              }}
      style={{
        marginTop: 8,
        padding: "8px 12px",
        background: "#3a3a5c",
        color: "#e8e8e8",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      Enable notifications
    </button>
  );
})()}
        </div>
      </div>

      <div style={{ marginTop: 4, marginBottom: 12 }}>
        <span style={{ color: '#00ff88', fontWeight: 600 }}>
          Balance: £{Number(users.find(u => Number(u.id) === 7)?.balance ?? 0).toFixed(2)}
        </span>
         {(() => {
          const exp =
            activeTab === 'house'
              ? getHouseExposure()
              : currentUser?.canLay
                ? getMyExposure(currentUser.id)
                : 0;
          if (!(exp > 0)) return null;
          return (
            <span style={{ color: '#ff6b6b', fontWeight: 600, marginLeft: 16 }}>
              Open lays: £{exp.toFixed(2)}
            </span>
          );
        })()}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
  {['house', 'settlement', 'admin', 'chat'].map(tab => (
  <button
    key={tab}
    onClick={() => {
      setActiveTab(tab);
      if (tab === 'chat') setChatTabUnread(0);
    }}
    style={{
      background: activeTab === tab ? '#00ff88' : '#252540',
      color: activeTab === tab ? '#0f0c29' : '#e8e8e8',
      border: '1px solid #3a3a5c',
      padding: '12px 22px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '15px',
      textTransform: 'capitalize'
    }}
  >
    {tab === 'chat' && chatTabUnread > 0 ? `chat (${chatTabUnread})` : tab}
  </button>
))}
      </div>

 
            {activeTab === 'house' && (
        <div>
    {residualBets.length > 0 && (
  <CollapsibleSection title="🔄 Residual Bets (House Second Look)" defaultOpen={true}>
    {residualBets.map(b => {
      const houseLaid = parseFloat(b.houseAmount) || 0;
      const layerTotal = (b.layerBids || []).reduce((sum, bid) => sum + (parseFloat(bid.actualLaid) || parseFloat(bid.amount) || 0), 0);
      const residual = Math.max(0, Math.round((parseFloat(b.residualStake) || (parseFloat(b.stake) - houseLaid - layerTotal)) * 100) / 100);
      return (
        <div key={b.id} style={{ ...cardYellow, border: '2px solid #ff9800' }}>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>
  {b.event} – {b.selection} @ {b.odds}
</div>
<div style={{ color: '#b0b0b0', marginTop: 4 }}>
  £{b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
  {b.eachWay ? ' E/W' : ' Win'}
  {' requested by '}{b.punterName}
</div>
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
              Accept Full
            </button>
            <button onClick={() => handleHouseAction(b.id, 'Rejected')} style={{ background: '#7f1d1d', color: 'white', flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Reject
            </button>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <input type="number" placeholder="Partial residual amount" value={partialAmount[b.id] || ''} onChange={e => setPartialAmount({ ...partialAmount, [b.id]: e.target.value })} style={{ flex: 1, padding: '9px', background: '#1a1a2e', color: '#e8e8e8', border: '1px solid #3a3a5c', borderRadius: '6px' }} />
            <button onClick={() => handleHouseAction(b.id, 'Partial', partialAmount[b.id])} style={{ background: '#d4a017', color: '#0f0c29', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
              Accept Partial 
            </button>
          </div>
        </div>
      );
    })}
  </CollapsibleSection>
)}
          <h2 style={{ color: '#00ff88' }}>Pending House Review</h2>
         
          {pendingReview.length === 0 && <p style={muted}>No bets waiting.</p>}
          {pendingReview.map(b => {
const meta = getBetRaceMeta(b);
const exposure = getExposure(b.stake, b.odds, {
  eachWay: !!b.eachWay,
  fieldSize: meta.fieldSize,
  isHandicap: meta.isHandicap,
});
            return (
              <div key={b.id} style={cardYellow}>
<div style={{ fontSize: '16px', fontWeight: '600' }}>
  {b.event} – {b.selection} @ {b.odds}
</div>
<div style={{ color: '#b0b0b0', marginTop: 4 }}>
  £{b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
  {b.eachWay ? ' E/W' : ' Win'}
  {' requested by '}{b.punterName}
</div>

                <div style={{ marginTop: '6px', color: '#ff6b6b', fontWeight: '600' }}>Exposure: £{Number(exposure).toFixed(2)}</div>
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

          <CollapsibleSection title="Active Lays" defaultOpen={false}>
            {activeBets.filter(b => parseFloat(b.houseAmount) > 0).map(b => {
  const houseLaid = parseFloat(b.houseAmount) || 0;
  const layerBids = (b.layerBids || []).filter(l => !l.rejected);
  const layersLaid = layerBids.reduce((s, l) => s + (parseFloat(l.actualLaid != null ? l.actualLaid : l.amount) || 0), 0);
  const totalLaid = houseLaid + layersLaid;
  const isFull = totalLaid >= parseFloat(b.stake) - 0.01;
  return (
    <div key={b.id} style={cardGreen}>
      <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
<div style={muted}>
  {b.selection} @ {b.odds} — £
  {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
  {b.eachWay ? ' each way' : ''}
</div>
      <div style={{ marginTop: '6px', color: '#00ff88', fontWeight: '600' }}>
        {isFull ? 'Laid in Full' : `Partially Laid (£${totalLaid.toFixed(2)} of £${b.stake})`}
      </div>
      <div style={{ fontSize: '13px', color: '#b0b0b0', marginTop: '6px' }}>
        House: £{houseLaid.toFixed(2)} | Layers: £{layersLaid.toFixed(2)} | Total: £{totalLaid.toFixed(2)}
      </div>
      {layerBids.length > 0 && (
        <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
          <strong>Layers:</strong>
          {layerBids.map((l, i) => (
            <div key={i}>
              • {l.layerName}: £{parseFloat(l.actualLaid != null ? l.actualLaid : l.amount).toFixed(2)}
              {l.actualLaid != null && parseFloat(l.actualLaid) !== parseFloat(l.amount)
                ? ` (bid £${parseFloat(l.amount).toFixed(2)})`
                : ''}
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
        Accepted: {(b.houseActedAt || b.acceptedAt)
          ? new Date(b.houseActedAt || b.acceptedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' }) + ' UTC'
          : 'N/A'}
      </div>
    </div>
  );
})}
          </CollapsibleSection>

          <CollapsibleSection title="Rejected Bets" defaultOpen={false}>
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
<div style={muted}>
  {b.selection} @ {b.odds} — £
  {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
  {b.eachWay ? ' each way' : ''}
</div>
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
<div style={muted}>
  {b.selection} @ {b.odds} — £
  {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
  {b.eachWay ? ' each way' : ''}
</div>
          <div style={{ marginTop: '6px', fontSize: '13px' }}>
            House laid: £{houseLaid.toFixed(2)} | Layers: £{layersLaid.toFixed(2)}
          </div>
          <div style={{ marginTop: '6px', fontWeight: '600', color: b.result === 'won' ? '#00ff88'
  : b.result === 'placed' ? '#ffb347'
  : b.result === 'lost' ? '#ff6b6b'
  : '#ffb347' }}>
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
      {activeTab === 'settlement' && (
  <div>

    <CollapsibleSection title="Awaiting Settlement" defaultOpen={false}>
      {allBets.filter(b => b.phase === 'finalized' && !b.settledAt).length === 0 && (
        <p style={muted}>No bets waiting to be settled.</p>
      )}
      {allBets
.filter(b => {
  const houseLaid = parseFloat(b.houseAmount) || 0;
  const layersLaid = (b.layerBids || []).reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
  return b.phase === 'finalized' && !b.settledAt && (houseLaid + layersLaid) > 0;
})
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(b => {
          const houseLaid = parseFloat(b.houseAmount) || 0;
          const layersLaid = (b.layerBids || []).reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
          const matched = houseLaid + layersLaid;
          return (
            <div key={b.id} style={cardYellow}>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
<div style={muted}>
  {b.selection} @ {b.odds} — £
  {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
  {b.eachWay ? ' each way' : ''}
</div>
              <div style={{ marginTop: '6px', fontSize: '13px' }}>
                Matched: £{matched.toFixed(2)} (House £{houseLaid.toFixed(2)} + Layers £{layersLaid.toFixed(2)})
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                Punter: {b.punterName}
              </div>

                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {b.eachWay ? (
                  <>
                    <button
                      onClick={() => settleEachWay(b, 'won')}
                      style={{ background: '#2d6a4f', color: 'white', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Won
                    </button>
                    <button
                      onClick={() => settleEachWay(b, 'placed')}
                      style={{ background: '#d4a017', color: '#0f0c29', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Placed
                    </button>
                    <button
                      onClick={() => handleSettle(b.id, 'lost')}
                      style={{ background: '#7f1d1d', color: 'white', padding: '9px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Lost
                    </button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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
        <p style={muted}></p>
      )}
      {allBets
        .filter(b => b.settledAt)
        .sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt))
        .map(b => (
          <div key={b.id} style={card}>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{b.event}</div>
<div style={muted}>
  {b.selection} @ {b.odds} — £
  {b.eachWay ? (b.originalStake || b.stake / 2) : b.stake}
  {b.eachWay ? ' each way' : ''}
</div>
            <div style={{ marginTop: '6px', fontWeight: '600', color: b.result === 'won' ? '#00ff88'
  : b.result === 'placed' ? '#ffb347'
  : b.result === 'lost' ? '#ff6b6b'
  : '#ffb347' }}>
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
  </div>
)}
 {activeTab === 'admin' && (
  <div>
    <CollapsibleSection title="Settings" defaultOpen={false}>
      <div style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', padding: '16px', borderRadius: '8px', maxWidth: '420px', textAlign: 'left' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 12px', alignItems: 'center', marginBottom: '12px', textAlign: 'left' }}>
          <input
            type="checkbox"
            checked={settings.skipHouseFirstLook}
            onChange={e => setSettings(s => ({
              ...s,
              skipHouseFirstLook: e.target.checked,
              skipHouseResidual: e.target.checked ? s.skipHouseResidual : false,
            }))}
          />
          <span style={{ color: '#e8e8e8', textAlign: 'left' }}>Skip House first look</span>

          <input
            type="checkbox"
            checked={settings.skipHouseResidual}
            disabled={!settings.skipHouseFirstLook}
            onChange={e => setSettings(s => ({ ...s, skipHouseResidual: e.target.checked }))}
          />
          <span style={{ color: '#e8e8e8', textAlign: 'left' }}>Skip House residual</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
          Lay stage timer (seconds)
          <input
            type="number"
            min={5}
            value={settings.layerTimerSeconds}
            onChange={e => setSettings(s => ({ ...s, layerTimerSeconds: parseInt(e.target.value) || 30 }))}
            style={{ display: 'block', marginTop: '6px', background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', padding: '8px', borderRadius: '6px', width: '100%' }}
          />
        </label>
        <button
          type="button"
          onClick={saveSettings}
          style={{ marginTop: '12px', background: '#2d6a4f', color: 'white', padding: '10px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          Save Settings
        </button>
      </div>
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
    <CollapsibleSection title="Events" defaultOpen={false}>
      {eventMessage && <p style={{ color: '#00ff88' }}>{eventMessage}</p>}
      <div style={{ background: '#1a1a2e', padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Upload racing / football CSV</div>
        <p style={{ color: '#999', fontSize: 13, marginBottom: 8 }}>
          Racing or football CSV. Football needs home_team / away_team columns.
        </p>
        <input
          type="file"
          accept="*/*"
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const text = String(reader.result || '');
              const head = text.slice(0, 200).toLowerCase();
              if (head.includes('home_team') || head.includes('away_team')) {
                uploadFootballCsvFromText(text);
              } else {
                uploadCsvFromText(text);
              }
            };
            reader.readAsText(file);
            e.target.value = '';
          }}
        />
      </div>
            <CollapsibleSection title={`Stored events (${events.length})`} defaultOpen={false}>
        {events.length > 0 && (
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm('Delete ALL stored events?')) return;
              try {
                const res = await fetch(`${API}/api/events`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) return alert(data.error || 'Delete failed');
                setEventMessage(`Deleted ${data.count} events`);
                fetchEvents();
              } catch (e) {
                alert('Delete failed');
              }
            }}
            style={{
              background: '#7f1d1d',
              color: 'white',
              padding: '6px 10px',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            Delete all
          </button>
        )}

        {events.length === 0 && <p style={{ color: '#999' }}>No events stored.</p>}

        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {events.map(ev => (
            <div
              key={ev.id}
              style={{
                background: '#1a1a2e',
                border: '1px solid #3a3a5c',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{ev.name}</div>
                <div style={{ color: '#999', fontSize: 12 }}>
                  {(() => {
                    const d = new Date(ev.date);
                    const day = d.toLocaleDateString('en-GB', { weekday: 'long' });
                    const date = d.toLocaleDateString('en-GB');
                    return `${day} ${date}`;
                  })()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteEvent(ev.id)}
                style={{
                  background: '#7f1d1d',
                  color: 'white',
                  padding: '5px 10px',
                  border: 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </CollapsibleSection>
    <CollapsibleSection title="Layer pro-rata weights" defaultOpen={false}>
      <div style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', padding: '16px', borderRadius: '8px', maxWidth: '420px' }}>
        <p style={{ color: '#b0b0b0', fontSize: '13px' }}>1.0 = equal share. 2.0 = double share. Range 1.0–2.0.</p>
        {users.filter(u => u.canLay && u.name !== 'House').map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ flex: 1 }}>{u.name}</span>
            <input
              type="number"
              min={1}
              max={2}
              step={0.1}
              value={Number(u.weight ?? 1)}
              onChange={async (e) => {
                let w = parseFloat(e.target.value);
                if (isNaN(w)) return;
                w = Math.min(2, Math.max(1, Math.round(w * 10) / 10));
                await fetch(`${API}/api/users/${u.id}/weight`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ weight: w })
                });
                fetchUsers();
              }}
              style={{ width: '80px', background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', padding: '6px', borderRadius: '6px' }}
            />
          </div>
        ))}
      </div>
    </CollapsibleSection>

    <CollapsibleSection title="Create New User" defaultOpen={false}>
      <div style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', padding: '16px', borderRadius: '8px', maxWidth: '420px', textAlign: 'left' }}>
        <input
          type="text"
          placeholder="Full name"
          value={authName}
          onChange={e => setAuthName(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 8, background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', borderRadius: 6 }}
        />
        <input
          type="email"
          placeholder="Email"
          value={authEmail}
          onChange={e => setAuthEmail(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 8, background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', borderRadius: 6 }}
        />
        <input
          type="text"
          placeholder="Temporary password"
          value={authPassword}
          onChange={e => setAuthPassword(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 8, background: '#252540', color: '#e8e8e8', border: '1px solid #3a3a5c', borderRadius: 6 }}
        />
        <button
          type="button"
          onClick={createNewUser}
          style={{ width: '100%', padding: 10, background: '#0066cc', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Create user
        </button>
      </div>
    </CollapsibleSection>

    <CollapsibleSection title="User rights" defaultOpen={false}>
      <div style={{ background: '#1a1a2e', border: '1px solid #3a3a5c', padding: '16px', borderRadius: '8px', maxWidth: '420px', textAlign: 'left' }}>
        <p style={{ color: '#b0b0b0', fontSize: 13 }}>Default is punter. Tick Can lay to allow laying.</p>
        {users.filter(u => Number(u.id) > 0 && u.name !== 'House').map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ flex: 1 }}>{u.name}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e8e8e8', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!u.canLay}
                onChange={async (e) => {
                  const canLay = e.target.checked;
                  await fetch(`${API}/api/users/${u.id}/rights`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ canLay, role: u.role || 'punter' }),
                  });
                  fetchUsers();
                }}
              />
              Can lay
            </label>
          </div>
        ))}
      </div>
    </CollapsibleSection>

    <CollapsibleSection title="Ledger" defaultOpen={false}>
      <div style={{ marginBottom: '10px' }}>
        <button
          type="button"
          onClick={fetchLedger}
          style={{ background: '#3a3a5c', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Refresh Ledger
        </button>
      </div>
      {ledger.length === 0 && <p style={muted}>No ledger entries yet.</p>}
      {ledger.map(entry => (
        <div key={entry.id} style={{ ...card, fontSize: '12px' }}>
          <div style={{ fontWeight: '600', color: '#00ff88' }}>
            {entry.eventType}
            {entry.betId != null ? ` — Bet #${entry.betId}` : ''}
          </div>
          <div style={muted}>
            {entry.actorName || 'System'}
            {entry.actorId != null ? ` (id ${entry.actorId})` : ''}
          </div>
          <div style={{ color: '#999', marginTop: '4px' }}>
            {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : ''}
          </div>
          {entry.details && (
            <pre style={{ marginTop: '6px', whiteSpace: 'pre-wrap', color: '#b0b0b0', fontSize: '11px' }}>
              {typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </CollapsibleSection>
  </div>
)}
{activeTab === 'chat' && (
  <div>
    <h2 style={{ color: '#00ff88' }}>Chat</h2>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {/* Conversation list */}
      <div style={{ flex: '1 1 200px', minWidth: 180 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Conversations</div>
        {chatConversations.length === 0 && (
          <p style={{ color: '#999' }}>No messages yet.</p>
        )}
        {chatConversations.map((c) => (
          <button
            key={c.userId}
            type="button"
            onClick={() => {
              setChatOtherId(c.userId);
              setChatOtherName(c.name);
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              marginBottom: 6,
              padding: 10,
              background: chatOtherId === c.userId ? '#2d6a4f' : '#1a1a2e',
              border: '1px solid #3a3a5c',
              borderRadius: 8,
              color: '#e8e8e8',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {c.lastBody?.slice(0, 40) || '—'}
            </div>
          </button>
        ))}
      </div>

      {/* Thread */}
      <div
        style={{
          flex: '2 1 280px',
          background: '#1a1a2e',
          border: '1px solid #3a3a5c',
          borderRadius: 10,
          minHeight: 360,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!chatOtherId ? (
          <div style={{ padding: 16, color: '#999' }}>Select a conversation</div>
        ) : (
          <>
            <div
              style={{
                padding: 10,
                borderBottom: '1px solid #3a3a5c',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600 }}>{chatOtherName}</span>
              <button
                type="button"
                onClick={endChat}
                style={{
                  background: '#7f1d1d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                End chat
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {chatMessages.map((m) => {
                const mine = Number(m.fromUserId) === HOUSE_ID;
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
                          alt=""
                          style={{
                            maxWidth: '100%',
                            borderRadius: 6,
                            marginTop: m.body ? 6 : 0,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {chatImage && (
              <div style={{ padding: '0 12px 8px' }}>
                <img src={chatImage} alt="" style={{ maxHeight: 80, borderRadius: 6 }} />
                <button type="button" onClick={() => setChatImage(null)}>
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
              }}
            >
              <label style={{ background: '#3a3a5c', padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}>
                📎
                <input type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
              </label>
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Reply..."
                style={{
                  flex: 1,
                  padding: 8,
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
          </>
        )}
      </div>
    </div>
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
export default Ops;