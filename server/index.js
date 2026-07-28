console.log("🚀 Starting BetTheMan Server...");

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "*";
const io = new Server(server, {
  cors: { origin: FRONTEND_URL === "*" ? "*" : FRONTEND_URL, methods: ["GET", "POST", "DELETE"] }
});

app.use(cors({ origin: FRONTEND_URL === "*" ? true : FRONTEND_URL }));
app.use(express.json());

const LAYER_IDS = [1, 3, 5];
function calcExposure(stake, oddsStr) {
  const s = parseFloat(stake);
  if (!s) return 0;
  const str = String(oddsStr).trim();
  if (str.includes("/")) {
      const [n, d] = str.split("/");
    const num = parseFloat(n);
    const den = parseFloat(d) || 1;
    return Math.round(s * (num / den) * 100) / 100;
  }
  const o = parseFloat(str);
  return o > 1 ? Math.round(s * (o - 1) * 100) / 100 : 0;
}

async function getUserBalance(id) {
  const rows = await prisma.$queryRaw`SELECT balance FROM "User" WHERE id = ${parseInt(id)}`;
  return rows[0] ? Number(rows[0].balance) || 0 : 0;
}
async function getLayerExposure(layerId) {
  const bets = await prisma.bet.findMany({
    where: {
      phase: { in: ["layer_bidding", "house_residual", "finalized"] },
      status: { not: "rejected" }
    }
  });
  let exposure = 0;
  for (const b of bets) {
    const bids = Array.isArray(b.layerBids) ? b.layerBids : [];
    for (const l of bids) {
      if (l.rejected) continue;
      if (parseInt(l.layerId) !== parseInt(layerId)) continue;
      const amt = parseFloat(l.actualLaid != null ? l.actualLaid : l.amount) || 0;
      if (amt > 0) exposure += calcExposure(amt, b.odds);
    }
  }
  return Math.round(exposure * 100) / 100;
}
async function changeUserBalance(id, delta) {
  const current = await getUserBalance(id);
  const next = Math.round((current + delta) * 100) / 100;
  await prisma.$executeRaw`
    UPDATE "User" SET balance = ${next}, "updatedAt" = NOW() WHERE id = ${parseInt(id)}
  `;
  console.log(`💰 User ${id} balance ${current} → ${next} (delta ${delta})`);
  return next;
}
async function writeLedger({ betId = null, eventType, actorId = null, actorName = null, details = {} }) {
  try {
    await prisma.ledgerEntry.create({
      data: {
        betId: betId != null ? parseInt(betId) : null,
        eventType,
        actorId: actorId != null ? parseInt(actorId) : null,
        actorName: actorName || null,
        details,
      }
    });
  } catch (err) {
    // Ledger must never break the main flow, but always log failure
    console.error("LEDGER WRITE FAILED:", err.message);
  }
}
async function settleBalancesForBet(bet) {
  if (bet.allocationComplete) return;

  const houseLaid = Number(bet.houseAmount || 0);
  const layers = Array.isArray(bet.layerBids) ? bet.layerBids : [];
  const layersLaid = layers.reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
  const totalLaid = houseLaid + layersLaid;

  if (totalLaid <= 0.01) {
    await prisma.bet.update({ where: { id: bet.id }, data: { allocationComplete: true } });
    return;
  }

  // Only the punter is debited (matched stake)
  await changeUserBalance(bet.punterId, -totalLaid);

  await prisma.bet.update({ where: { id: bet.id }, data: { allocationComplete: true } });
  console.log(`✅ Punter ${bet.punterId} debited £${totalLaid} for bet ${bet.id}`);
}
const DEFAULT_SETTINGS = {
  skipHouseFirstLook: "false",
  skipHouseResidual: "false",
  layerTimerSeconds: "30",
};

async function getSettings() {
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  for (const r of rows) map[r.key] = r.value;
  return {
    skipHouseFirstLook: map.skipHouseFirstLook === "true",
    skipHouseResidual: map.skipHouseResidual === "true",
    layerTimerSeconds: Math.max(5, parseInt(map.layerTimerSeconds) || 30),
  };
}

async function setSetting(key, value) {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });
}
function calcReturn(stake, oddsStr) {
  const s = parseFloat(stake);
  if (!s) return 0;
  const str = String(oddsStr).trim();
  if (str.includes("/")) {
    const [n, d] = str.split("/");
    const num = parseFloat(n);
    const den = parseFloat(d) || 1;
    return Math.round((s + s * (num / den)) * 100) / 100; // stake + profit
  }
  const o = parseFloat(str);
  return o > 0 ? Math.round(s * o * 100) / 100 : 0; // decimal = full return
}

async function settleBet(bet, result, notes = null, manualPayouts = null) {
  if (bet.settledAt) return { error: "Already settled" };

  // 1. Mark settled FIRST
  const updated = await prisma.bet.update({
    where: { id: bet.id },
    data: {
      phase: "settled",
      settledAt: new Date(),
      result,
      settlementNotes: notes || null,
    }
  });

  // 2. THEN move balances
  const houseLaid = Number(bet.houseAmount || 0);
  const layers = Array.isArray(bet.layerBids) ? bet.layerBids : [];

  if (result === "won") {
    const matchedStake = houseLaid + layers.reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
    const payout = calcReturn(matchedStake, bet.odds);
    await changeUserBalance(bet.punterId, payout);

    if (houseLaid > 0) {
      const houseLiability = calcExposure(houseLaid, bet.odds);
      await changeUserBalance(0, -houseLiability);
    }

    for (const l of layers) {
      if (l.rejected) continue;
      const amt = parseFloat(l.actualLaid) || 0;
      if (amt <= 0) continue;
      const liability = calcExposure(amt, bet.odds);
      await changeUserBalance(l.layerId, -liability);
    }
  } else if (result === "lost") {
    if (houseLaid > 0) {
      await changeUserBalance(0, houseLaid);
    }
    for (const l of layers) {
      if (l.rejected) continue;
      const amt = parseFloat(l.actualLaid) || 0;
      if (amt <= 0) continue;
      await changeUserBalance(l.layerId, amt);
    }
  } else if (result === "manual" && manualPayouts) {
    if (manualPayouts.punterDelta) {
      await changeUserBalance(bet.punterId, manualPayouts.punterDelta);
    }
    if (manualPayouts.houseDelta) {
      await changeUserBalance(0, manualPayouts.houseDelta);
    }
    if (Array.isArray(manualPayouts.layers)) {
      for (const l of manualPayouts.layers) {
        await changeUserBalance(l.layerId, l.delta);
      }
    }
  }
await writeLedger({
  betId: bet.id,
  eventType: result === "won" ? "settled_won"
            : result === "lost" ? "settled_lost"
            : "settled_manual",
  actorId: null,
  actorName: "System",
  details: {
    result,
    notes: notes || null,
    houseAmount: bet.houseAmount,
    layerBids: bet.layerBids,
  }
});
  return { success: true, bet: updated };
}
function serializeBet(bet) {
  if (!bet) return null;
  return {
    ...bet,
    id: Number(bet.id),
    stake: Number(bet.stake),
    houseAmount: Number(bet.houseAmount || 0),
    residualStake: bet.residualStake != null ? Number(bet.residualStake) : null,
    layerBids: Array.isArray(bet.layerBids)
      ? bet.layerBids
      : (typeof bet.layerBids === "string" ? JSON.parse(bet.layerBids || "[]") : []),
    houseTimerEnd: bet.houseTimerEnd ? bet.houseTimerEnd.toISOString() : null,
    layerTimerEnd: bet.layerTimerEnd ? bet.layerTimerEnd.toISOString() : null,
    houseActedAt: bet.houseActedAt ? bet.houseActedAt.toISOString() : null,
    acceptedAt: bet.acceptedAt ? bet.acceptedAt.toISOString() : null,
    createdAt: bet.createdAt ? bet.createdAt.toISOString() : null,
    settledAt: bet.settledAt ? bet.settledAt.toISOString() : null,
    result: bet.result || null,
    settlementNotes: bet.settlementNotes || null,
  };
}

async function applyProRata(layerBids, remaining) {
  const weightRows = await prisma.$queryRaw`SELECT id, weight FROM "User" WHERE "canLay" = true`;
  const weights = {};
  for (const r of weightRows) weights[r.id] = Number(r.weight) || 1;

  const active = (layerBids || []).filter(b => !b.rejected && parseFloat(b.amount) > 0);
  if (active.length === 0) return { bids: layerBids || [], totalLaid: 0 };

  const totalBids = active.reduce((s, b) => s + parseFloat(b.amount), 0);

  // Under-subscribed: everyone gets their full bid
  if (totalBids <= remaining + 0.01) {
    const bids = (layerBids || []).map(b => {
      if (b.rejected || parseFloat(b.amount) <= 0) return { ...b, actualLaid: 0 };
      return { ...b, actualLaid: parseFloat(b.amount) };
    });
    const totalLaid = bids.reduce((s, b) => s + (parseFloat(b.actualLaid) || 0), 0);
    return { bids, totalLaid };
  }

  // Over-subscribed: weighted pro-rata
  // share_i = (bid_i * weight_i) / sum(bid_j * weight_j)
  const weighted = active.map(b => {
    const w = Number(weights[b.layerId] ?? weights[String(b.layerId)] ?? 1) || 1;
    return { ...b, w, score: parseFloat(b.amount) * w };
  });
  const totalScore = weighted.reduce((s, b) => s + b.score, 0);

  let allocated = 0;
  const laidMap = {};
  weighted.forEach((b, i) => {
    let laid;
    if (i === weighted.length - 1) {
      laid = Math.round((remaining - allocated) * 100) / 100;
    } else {
      laid = Math.round((remaining * (b.score / totalScore)) * 100) / 100;
      allocated += laid;
    }
    laidMap[b.layerId] = laid;
    console.log(`[PRO-RATA] Layer ${b.layerName}: Bid £${b.amount} weight=${b.w} → Apportioned £${laid.toFixed(2)}`);
  });

  const bids = (layerBids || []).map(b => {
    if (b.rejected || parseFloat(b.amount) <= 0) return { ...b, actualLaid: 0 };
    return { ...b, actualLaid: laidMap[b.layerId] ?? 0 };
  });
  const totalLaid = bids.reduce((s, b) => s + (parseFloat(b.actualLaid) || 0), 0);
  console.log(`[PRO-RATA TOTAL] Layers laid: £${totalLaid.toFixed(2)}`);
  return { bids, totalLaid };
}


async function processExpiredTimers() {
  const now = new Date();
  let changed = false;

  // 1. House review timer expired → send to layers
  const houseReviewBets = await prisma.bet.findMany({
    where: { phase: "house_review", houseTimerEnd: { lte: now } }
  });

  for (const bet of houseReviewBets) {
    const settings = await getSettings();
    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        phase: "layer_bidding",
        layerTimerEnd: new Date(now.getTime() + settings.layerTimerSeconds * 1000),
        houseTimerEnd: null,
      }
    });
    console.log(`[HOUSE TIMER] Bet ${bet.id} moved to layer_bidding`);
    changed = true;
  }

  // 2. Layer bidding timer expired
  const layerBets = await prisma.bet.findMany({
    where: { phase: "layer_bidding", layerTimerEnd: { lte: now } }
  });

  for (const bet of layerBets) {
    const houseLaid = Number(bet.houseAmount || 0);
    const stake = Number(bet.stake);
    const remainingForLayers = Math.max(0, stake - houseLaid);
    const currentBids = Array.isArray(bet.layerBids) ? bet.layerBids : [];

    console.log(`[TIMER] Bet ${bet.id} expired. RemainingForLayers: £${remainingForLayers}`);

const { bids, totalLaid } = await applyProRata(currentBids, remainingForLayers);

    if (totalLaid >= remainingForLayers - 0.01) {
      const updated = await prisma.bet.update({
        where: { id: bet.id },
        data: {
          status: "accepted",
          phase: "finalized",
          acceptedAt: now,
          layerBids: bids,
          layerTimerEnd: null,
        }
      });
      await settleBalancesForBet(updated);   // balance fix
    } else {
  const settings = await getSettings();
  if (settings.skipHouseResidual) {
    const totalWithHouse = houseLaid + totalLaid;
    const data = {
      phase: "finalized",
      layerBids: bids,
      layerTimerEnd: null,
      houseTimerEnd: null,
    };
    if (totalWithHouse <= 0.01) {
      data.status = "rejected";
      data.houseAction = "Rejected";
    } else {
      data.status = "accepted";
      data.acceptedAt = now;
    }
    const updated = await prisma.bet.update({ where: { id: bet.id }, data });
    await settleBalancesForBet(updated);
    console.log(`[SKIP RESIDUAL] Bet ${bet.id} finalized. Total: £${totalWithHouse.toFixed(2)}`);
  } else {
    const residual = Math.round((remainingForLayers - totalLaid) * 100) / 100;
    await prisma.bet.update({
      where: { id: bet.id },
      data: {
        phase: "house_residual",
        residualStake: residual,
        houseTimerEnd: new Date(now.getTime() + 30 * 1000),
        layerBids: bids,
        layerTimerEnd: null,
      }
    });
    console.log(`[RESIDUAL] £${residual} to House for bet ${bet.id}`);
  }
}
    changed = true;
  }

  // 3. Residual house timer expired
  const residualBets = await prisma.bet.findMany({
    where: { phase: "house_residual", houseTimerEnd: { lte: now } }
  });

  for (const bet of residualBets) {
    const houseLaid = Number(bet.houseAmount || 0);
    const layersLaid = (Array.isArray(bet.layerBids) ? bet.layerBids : [])
      .reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
    const totalLaid = houseLaid + layersLaid;

    const data = {
      phase: "finalized",
      houseTimerEnd: null,
    };

    if (totalLaid <= 0.01) {
      data.status = "rejected";
      data.houseAction = "Rejected";
    } else {
      data.status = "accepted";
      if (!bet.acceptedAt) data.acceptedAt = now;
    }

    const updated = await prisma.bet.update({ where: { id: bet.id }, data });
    await settleBalancesForBet(updated);   // balance fix
    console.log(`[RESIDUAL EXPIRED] Bet ${bet.id} finalized. Total laid: £${totalLaid.toFixed(2)}`);
    changed = true;
  }

  if (changed) {
    const all = await prisma.bet.findMany({ orderBy: { createdAt: "desc" } });
    io.emit("betUpdated", { type: "bulk", bets: all.map(serializeBet) });
  }
}

setInterval(processExpiredTimers, 2000);

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.post("/api/bets/clear", async (req, res) => {
  await prisma.bet.deleteMany({});
  io.emit("betUpdated", { type: "bulk", bets: [] });
  res.json({ success: true });
});

app.delete("/api/bets", async (req, res) => {
  try {
    await prisma.bet.deleteMany({});
    io.emit("betUpdated", { type: "bulk", bets: [] });
    console.log("🗑 All bets cleared");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.$queryRaw`
SELECT id, name, "canLay", balance, weight, "createdAt", "updatedAt"
      FROM "User"
      ORDER BY id ASC
    `;
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/:id/balance", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { mode, amount } = req.body;
    const value = parseFloat(amount);
    if (isNaN(value) || value < 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const rows = await prisma.$queryRaw`
      SELECT id, name, balance FROM "User" WHERE id = ${id}
    `;
    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const user = rows[0];
    const current = Number(user.balance) || 0;
    let newBalance = current;
    if (mode === "set") newBalance = value;
    else if (mode === "credit") newBalance = current + value;
    else if (mode === "debit") newBalance = Math.max(0, current - value);
    else return res.status(400).json({ error: "Invalid mode" });

    await prisma.$executeRaw`
      UPDATE "User" SET balance = ${newBalance}, "updatedAt" = NOW() WHERE id = ${id}
    `;

    console.log(`Balance ${mode} user ${id}: £${newBalance}`);
    res.json({ success: true, user: { id, name: user.name, balance: newBalance } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/users/:id/weight", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let w = parseFloat(req.body.weight);
    if (isNaN(w)) return res.status(400).json({ error: "Invalid weight" });
    w = Math.min(2, Math.max(1, Math.round(w * 10) / 10));
    await prisma.$executeRaw`
      UPDATE "User" SET weight = ${w}, "updatedAt" = NOW() WHERE id = ${id}
    `;
    res.json({ success: true, id, weight: w });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/bets", async (req, res) => {
  try {
        const punterId = parseInt(req.body.punterId);
    const stake = parseFloat(req.body.stake);
    const bal = await getUserBalance(punterId);
    if (stake > bal) {
      return res.status(400).json({ success: false, error: `Insufficient balance. You have £${bal.toFixed(2)}` });
    }
   const settings = await getSettings();
const layerSecs = settings.layerTimerSeconds;
const now = new Date();

let phase = "house_review";
let houseTimerEnd = new Date(now.getTime() + 30 * 1000);
let layerTimerEnd = null;

if (settings.skipHouseFirstLook) {
  phase = "layer_bidding";
  houseTimerEnd = null;
  layerTimerEnd = new Date(now.getTime() + layerSecs * 1000);
}

const bet = await prisma.bet.create({
  data: {
    punterId: parseInt(req.body.punterId),
    punterName: req.body.punterName || "Unknown",
    event: req.body.event,
    selection: req.body.selection,
    odds: String(req.body.odds),
    stake: parseFloat(req.body.stake),
    status: "pending",
    phase,
    houseAmount: 0,
    houseTimerEnd,
    layerTimerEnd,
    layerBids: [],
  }
});
    const serialized = serializeBet(bet);
    await writeLedger({
  betId: bet.id,
  eventType: "submitted",
  actorId: bet.punterId,
  actorName: bet.punterName,
  details: {
    event: bet.event,
    selection: bet.selection,
    odds: bet.odds,
    stake: bet.stake,
  }
});
    console.log("🆕 New Bet:", serialized.id, serialized.event);
    io.emit("betUpdated", serialized);
    res.json({ success: true, bet: serialized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/bets", async (req, res) => {
  try {
    const bets = await prisma.bet.findMany({ orderBy: { createdAt: "desc" } });
    res.json(bets.map(serializeBet));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bets/:id/action", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { action, amount } = req.body;
    const bet = await prisma.bet.findUnique({ where: { id } });
    if (!bet) return res.status(404).json({ success: false });

    const now = new Date();
    let data = {};

    if (action === "Accepted") {
      const current = Number(bet.houseAmount || 0);
      const add = parseFloat(amount) || (Number(bet.stake) - current);
      data = {
        houseAmount: Math.min(Number(bet.stake), current + add),
        status: "accepted",
        phase: "finalized",
        acceptedAt: now,
        houseActedAt: bet.houseActedAt || now,
        houseAction: "Accepted",
        houseTimerEnd: null,
        layerTimerEnd: null,
      };
    } else if (action === "Partial") {
      const current = Number(bet.houseAmount || 0);
      const add = parseFloat(amount) || 0;
      data = {
        houseAmount: current + add,
        houseAction: "Partial",
        houseActedAt: bet.houseActedAt || now,
      };
      if (bet.phase === "house_residual") {
        const layerTotal = (Array.isArray(bet.layerBids) ? bet.layerBids : [])
          .filter(b => !b.rejected)
          .reduce((s, b) => s + (parseFloat(b.actualLaid) || parseFloat(b.amount) || 0), 0);
        if (current + add + layerTotal >= Number(bet.stake) - 0.01) {
          data.houseAmount = Number(bet.stake);
          data.status = "accepted";
          data.phase = "finalized";
          data.acceptedAt = now;
          data.houseTimerEnd = null;
        }
      } else {
        data.phase = "layer_bidding";
      const settings = await getSettings();
data.layerTimerEnd = new Date(now.getTime() + settings.layerTimerSeconds * 1000);
      }
    } else if (action === "Rejected") {
      data = { houseAction: "Rejected" };
      if (bet.phase === "house_residual") {
        data.phase = "finalized";
        data.houseTimerEnd = null;
        const houseLaid = Number(bet.houseAmount || 0);
        const layersLaid = (Array.isArray(bet.layerBids) ? bet.layerBids : [])
          .reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
        if (houseLaid + layersLaid === 0) data.status = "rejected";
        else {
          data.status = "accepted";
          if (!bet.acceptedAt) data.acceptedAt = now;
        }
      } else {
        data.phase = "layer_bidding";
       const settings = await getSettings();
data.layerTimerEnd = new Date(now.getTime() + settings.layerTimerSeconds * 1000);
      }
    }
   
    const updated = await prisma.bet.update({ where: { id }, data });
       if (data.phase === "finalized") {
        await settleBalancesForBet(updated);
      }
    const serialized = serializeBet(updated);
    await writeLedger({
  betId: id,
  eventType: action === "Accepted" ? "house_accepted"
            : action === "Partial" ? "house_partial"
            : "house_rejected",
  actorId: 0,
  actorName: "House",
  details: {
    action,
    houseAmount: updated.houseAmount,
    amount: amount || null,
    phase: updated.phase,
  }
});
    console.log(`🏠 House ${action} bet ${id} - HouseAmount: £${serialized.houseAmount}`);
    io.emit("betUpdated", serialized);
    res.json({ success: true, bet: serialized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bets/:id/layer-bid", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { layerId, layerName, amount, action = "bid" } = req.body;
    const bet = await prisma.bet.findUnique({ where: { id } });
    if (!bet) return res.status(404).json({ success: false });
        if (action !== "reject") {
      const liability = calcExposure(amount, bet.odds);
      const layerBal = await getUserBalance(layerId);
      const currentExposure = await getLayerExposure(layerId);
      const available = layerBal - currentExposure;
      if (liability > available + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Insufficient free balance. Liability £${liability.toFixed(2)}, available £${available.toFixed(2)} (balance £${layerBal.toFixed(2)} − exposure £${currentExposure.toFixed(2)})`
        });
      }
    }

    let layerBids = Array.isArray(bet.layerBids) ? [...bet.layerBids] : [];

    if (action === "reject") {
      const existing = layerBids.findIndex(b => b.layerId === parseInt(layerId));
      if (existing !== -1) {
        layerBids[existing] = { ...layerBids[existing], rejected: true, amount: 0, bidAt: new Date().toISOString() };
      } else {
        layerBids.push({
          layerId: parseInt(layerId),
          layerName,
          amount: 0,
          rejected: true,
          bidAt: new Date().toISOString()
        });
      }
    } else {
      const existing = layerBids.findIndex(b => b.layerId === parseInt(layerId));
      if (existing !== -1) {
        layerBids[existing] = {
          ...layerBids[existing],
          amount: parseFloat(amount),
          rejected: false,
          bidAt: new Date().toISOString()
        };
      } else {
        layerBids.push({
          layerId: parseInt(layerId),
          layerName,
          amount: parseFloat(amount),
          rejected: false,
          bidAt: new Date().toISOString()
        });
      }
    }

    let updated = await prisma.bet.update({ where: { id }, data: { layerBids } });
    console.log(`Layer ${action} on bet ${id}`, layerBids);

    if (bet.phase === "layer_bidding") {
      const actedIds = layerBids.map(b => b.layerId);
      const relevantLayers = LAYER_IDS.filter(lid => lid !== bet.punterId);
      const allLayersActed = relevantLayers.every(lid => actedIds.includes(lid));

      const houseLaid = Number(bet.houseAmount || 0);
      const remaining = Math.max(0, Number(bet.stake) - houseLaid);
      const activeBidsTotal = layerBids
        .filter(b => !b.rejected)
        .reduce((s, b) => s + parseFloat(b.amount || 0), 0);

      if (allLayersActed && activeBidsTotal < remaining - 0.01) {
              const { bids, totalLaid } = await applyProRata(layerBids, remaining);
        const residual = Math.round((remaining - totalLaid) * 100) / 100;

        if (residual <= 0.01) {
          updated = await prisma.bet.update({
            where: { id },
            data: {
              status: "accepted",
              phase: "finalized",
              acceptedAt: new Date(),
              layerBids: bids,
              layerTimerEnd: null,
            }
                  });
        await settleBalancesForBet(updated);
        console.log(`[EARLY FULL] Bet ${id} fully covered. Laid: £${totalLaid.toFixed(2)}`);
       } else {
  const settings = await getSettings();
  if (settings.skipHouseResidual) {
    const totalWithHouse = Number(bet.houseAmount || 0) + totalLaid;
    const data = {
      phase: "finalized",
      layerBids: bids,
      layerTimerEnd: null,
      houseTimerEnd: null,
    };
    if (totalWithHouse <= 0.01) {
      data.status = "rejected";
      data.houseAction = "Rejected";
    } else {
      data.status = "accepted";
      data.acceptedAt = new Date();
    }
    updated = await prisma.bet.update({ where: { id }, data });
    await settleBalancesForBet(updated);
    console.log(`[SKIP RESIDUAL EARLY] Bet ${id} finalized. Total: £${totalWithHouse.toFixed(2)}`);
  } else {
    updated = await prisma.bet.update({
      where: { id },
      data: {
        phase: "house_residual",
        residualStake: residual,
        houseTimerEnd: new Date(Date.now() + 30 * 1000),
        layerBids: bids,
        layerTimerEnd: null,
      }
    });
    console.log(`[EARLY RESIDUAL] £${residual} to House for bet ${id} (all layers acted)`);
  }
}
     } else if (allLayersActed && activeBidsTotal >= remaining - 0.01) {
      const { bids, totalLaid } = await applyProRata(layerBids, remaining);
      updated = await prisma.bet.update({
        where: { id },
        data: {
          status: "accepted",
          phase: "finalized",
          acceptedAt: new Date(),
          layerBids: bids,
          layerTimerEnd: null,
        }
      });
      await settleBalancesForBet(updated);
      console.log(`[EARLY FULL] Bet ${id} fully covered by layers. Laid: £${totalLaid.toFixed(2)}`);
    }
    }

    const serialized = serializeBet(updated);
    io.emit("betUpdated", serialized);
    res.json({ success: true, bet: serialized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/bets/:id/settle", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { result, notes, manualPayouts } = req.body; // result = "won" | "lost" | "manual"

    const bet = await prisma.bet.findUnique({ where: { id } });
    if (!bet) return res.status(404).json({ success: false, error: "Bet not found" });
    if (bet.phase !== "finalized" && bet.phase !== "settled") {
      return res.status(400).json({ success: false, error: "Bet is not ready for settlement" });
    }
    if (bet.settledAt) {
      return res.status(400).json({ success: false, error: "Already settled" });
    }

    const outcome = await settleBet(bet, result, notes, manualPayouts);
    if (outcome.error) return res.status(400).json({ success: false, error: outcome.error });

    const serialized = serializeBet(outcome.bet);
    io.emit("betUpdated", serialized);
    res.json({ success: true, bet: serialized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/ledger", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const betId = req.query.betId ? parseInt(req.query.betId) : null;

    const entries = await prisma.ledgerEntry.findMany({
      where: betId ? { betId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    res.json(entries.map(e => ({
      ...e,
      id: Number(e.id),
      betId: e.betId != null ? Number(e.betId) : null,
      actorId: e.actorId != null ? Number(e.actorId) : null,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const { skipHouseFirstLook, skipHouseResidual, layerTimerSeconds } = req.body;
    if (typeof skipHouseFirstLook === "boolean") {
      await setSetting("skipHouseFirstLook", skipHouseFirstLook);
    }
    if (typeof skipHouseResidual === "boolean") {
      await setSetting("skipHouseResidual", skipHouseResidual);
    }
    if (layerTimerSeconds != null) {
      await setSetting("layerTimerSeconds", Math.max(5, parseInt(layerTimerSeconds) || 30));
    }
    const settings = await getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ Server LIVE on port ${PORT}`));