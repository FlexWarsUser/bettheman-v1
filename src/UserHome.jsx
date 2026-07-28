export default function UserHome() {
  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 20, textAlign: 'center', color: '#e8e8e8' }}>
      <h1 style={{ color: '#00ff88', marginBottom: 8 }}>BetTheMan</h1>
      <h2 style={{ color: '#e8e8e8', fontWeight: 500 }}>User app</h2>
      <p style={{ color: '#b0b0b0' }}>Login and punter/layer screens will go here.</p>
      <p style={{ marginTop: 24 }}>
        <a href="/ops" style={{ color: '#00ff88' }}>Open ops / testing UI</a>
      </p>
    </div>
  );
}