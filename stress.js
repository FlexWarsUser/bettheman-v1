const password = "Boylesports21!";
const punter = "liam@test.com";
const layers = ["ryan@test.com","louisa@test.com","jenny@test.com","linda@test.com","pete@test.com","larry@test.com","john@test.com","matt@test.com","bazza@test.com"];
async function login(email) {
  const res = await fetch("https://betorlay.uk/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { email, ok: res.ok && data.success, id: data.user && data.user.id, name: data.user && data.user.name, cookie: (res.headers.getSetCookie?.() || []).join("; "), error: data.error || "" };
}
(async () => {
  const liam = await login(punter);
  if (!liam.ok) return console.log("Liam login failed", liam.error);
  const placed = await fetch("https://betorlay.uk/api/bets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: liam.cookie },
    body: JSON.stringify({ event: "Stress test", selection: "Liam FCFS", odds: "2/1", stake: 10, eachWay: false, punterId: liam.id, punterName: liam.name }),
  });
  const bet = await placed.json();
  if (!placed.ok) return console.log("Bet failed", bet.error);
  const sessions = [];
  for (const email of layers) sessions.push(await login(email));
  const results = await Promise.all(sessions.map(async (s) => {
    const amount = Math.round((1 + Math.random() * 4) * 100) / 100;
    if (!s.ok) return { email: s.email, amount, error: s.error || "login failed" };
    const res = await fetch("https://betorlay.uk/api/bets/" + bet.bet.id + "/layer-bid", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: s.cookie },
      body: JSON.stringify({ layerId: s.id, layerName: s.name, amount, action: "bid" }),
    });
    const data = await res.json().catch(() => ({}));
    return { email: s.email, amount, status: res.status, error: data.error || "bid" };
  }));
  console.log("bet", bet.bet.id);
  console.table(results);
})();
