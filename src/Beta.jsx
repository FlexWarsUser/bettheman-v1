import { useState } from "react";

export default function Beta() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [day, setDay] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/beta-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, day }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
  }

  if (done) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <h1 style={styles.h1}>Thanks for registering</h1>
          <p style={styles.sub}>
            Your login details will be sent to your registered email address on the morning of the day you selected.
          </p>
          <p style={styles.sub}>
            You can drop in any time between 12 noon and 8pm UK time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src="/logo-login.png" alt="BetOrLay" style={styles.logo} />
        </div>
        <h1 style={styles.h1}>Beta Launch</h1>
        <p style={styles.sub}>
          Drop in any time between 12 noon and 8pm UK time.<br />
          Register below and we’ll send your login details on the morning of the day you choose.
        </p>

        <form onSubmit={submit}>
          <label style={styles.label}>Name</label>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
          />

          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />

          <label style={styles.label}>Which day are you joining?</label>
          <select
            style={styles.input}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          >
            <option value="" disabled>Select a day</option>
            <option value="Saturday 17 October">Saturday 17 October</option>
            <option value="Sunday 18 October">Sunday 18 October</option>
            <option value="Friday 23 October">Friday 23 October</option>
          </select>

          {error && <p style={{ color: "#ff6b6b", fontSize: 14, marginBottom: 12 }}>{error}</p>}

          <button type="submit" style={styles.button}>Register</button>
        </form>

        <p style={styles.privacy}>
          Your details will not be stored after the event and will only be used on the day of the beta launch to send your login details.{" "}
          <a href="/privacy" style={{ color: "#00ff88" }}>Privacy</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#0b1220",
    color: "#e8e8e8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: "#1a1a2e",
    borderRadius: 16,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  logoWrap: { textAlign: "center", marginBottom: 20 },
  logo: { height: 48 },
  h1: { textAlign: "center", fontSize: "1.5rem", marginBottom: 8, color: "#fff" },
  sub: { textAlign: "center", color: "#aaa", fontSize: "0.9rem", marginBottom: 16, lineHeight: 1.4 },
  label: { display: "block", fontSize: "0.85rem", color: "#ccc", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid #2a2a40",
    background: "#12122a",
    color: "#fff",
    fontSize: "1rem",
    marginBottom: 16,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: 14,
    border: "none",
    borderRadius: 8,
    background: "linear-gradient(90deg, #00ff88, #00ccff)",
    color: "#0b1220",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    marginTop: 8,
  },
  privacy: { textAlign: "center", fontSize: "0.75rem", color: "#888", marginTop: 16 },
};
