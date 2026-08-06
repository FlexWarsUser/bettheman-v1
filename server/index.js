console.log("🚀 Starting BetTheMan Server...");

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const webpush = require("web-push");

const prisma = new PrismaClient();
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@bettheman.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}
const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "*";
const io = new Server(server, {
  cors: { origin: FRONTEND_URL === "*" ? "*" : FRONTEND_URL, methods: ["GET", "POST", "DELETE"] }
});

app.use(cors({ origin: FRONTEND_URL === "*" ? true : FRONTEND_URL }));
app.use(express.json());

const LAYER_IDS = [1, 3, 5];
async function sendPushToUser(userId, title, body, tag) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { userId: Number(userId) },
    });
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify({
            title,
            body,
            tag: tag || "btm-" + Date.now(),
          })
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.error("sendPushToUser", e.message);
  }
}

async function sendPushToHouse(title, body, tag) {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ role: "admin" }, { role: "house" }, { id: 7 }],
    },
  });
  for (const u of users) {
    await sendPushToUser(u.id, title, body, tag);
  }
}

async function sendPushToLayers(title, body, tag, excludeUserId = null) {
  const users = await prisma.user.findMany({
    where: { canLay: true },
  });
  for (const u of users) {
    if (excludeUserId != null && Number(u.id) === Number(excludeUserId)) continue;
    await sendPushToUser(u.id, title, body, tag);
  }
}
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
function calcExposure(stake, oddsStr, eachWay, placeFraction) {
  const s = parseFloat(stake) || 0;
  if (s <= 0) return 0;
  const mult = oddsToLiabilityMultiplier(oddsStr);
  if (!eachWay || placeFraction === null) {
    // win-only or non-EW: full stake at win odds
    return s * mult;
  }
  const part = s / 2;
  return part * mult + part * mult * placeFraction;
}

function calcReturn(stake, oddsStr, eachWay, placeFraction) {
  const s = parseFloat(stake) || 0;
  if (s <= 0) return 0;
  return s + calcExposure(s, oddsStr, eachWay, placeFraction);
}

function calcPlaceReturn(matchedStake, oddsStr, placeFraction) {
  const s = parseFloat(matchedStake) || 0;
  if (s <= 0 || placeFraction == null) return 0;
  const part = s / 2;
  const mult = oddsToLiabilityMultiplier(oddsStr);
  return part + part * mult * placeFraction;
}
function oddsToLiabilityMultiplier(oddsStr) {
  const str = String(oddsStr || "").trim();
  if (!str) return 0;
  if (str.includes("/") || str.includes("-")) {
    const [n, d] = str.split(/[\/\-]/);
    const num = parseFloat(n);
    const den = parseFloat(d) || 1;
    if (!num || !den) return 0;
    return num / den;
  }
  const o = parseFloat(str);
  return o > 1 ? o - 1 : 0;
}

function getPlaceFraction(fieldSize, isHandicap) {
  const n = parseInt(fieldSize, 10) || 0;
  if (n < 5) return null;
  if (n <= 7) return 0.25;
  if (isHandicap) return n >= 12 ? 0.25 : 0.2;
  return 0.2;
}

async function settleBet(bet, result, notes = null, manualPayouts = null, placeFraction = undefined) {
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
    const eachWay = !!bet.eachWay;
    let frac = placeFraction;
    if (eachWay && frac === undefined) {
      const event = await prisma.event.findFirst({
        where: { name: { equals: bet.event, mode: "insensitive" } },
      });
      frac = getPlaceFraction(event?.fieldSize, !!event?.isHandicap);
    }
    // non-EW: ignore fraction
    if (!eachWay) frac = undefined;

    const matchedStake =
      houseLaid + layers.reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);

    const payout = eachWay
      ? calcReturn(matchedStake, bet.odds, true, frac)
      : calcReturn(matchedStake, bet.odds, false, undefined);
    await changeUserBalance(bet.punterId, payout);

    if (houseLaid > 0) {
      const houseLiability = eachWay
        ? calcExposure(houseLaid, bet.odds, true, frac)
        : calcExposure(houseLaid, bet.odds, false, undefined);
      await changeUserBalance(7, -houseLiability);
    }

    for (const l of layers) {
      if (l.rejected) continue;
      const amt = parseFloat(l.actualLaid) || 0;
      if (amt <= 0) continue;
      const liability = eachWay
        ? calcExposure(amt, bet.odds, true, frac)
        : calcExposure(amt, bet.odds, false, undefined);
      await changeUserBalance(l.layerId, -liability);
    }
  } else if (result === "placed") {
    // place only; client sends placeFraction as a number (not win-only)
    let frac = placeFraction;
    if (frac === undefined || frac === null) {
      const event = await prisma.event.findFirst({
        where: { name: { equals: bet.event, mode: "insensitive" } },
      });
      frac = getPlaceFraction(event?.fieldSize, !!event?.isHandicap);
    }
    if (frac == null) {
      // win only → treat as lost
      if (houseLaid > 0) await changeUserBalance(7, houseLaid);
      for (const l of layers) {
        if (l.rejected) continue;
        const amt = parseFloat(l.actualLaid) || 0;
        if (amt <= 0) continue;
        await changeUserBalance(l.layerId, amt);
      }
    } else {
      const matchedStake =
        houseLaid + layers.reduce((s, l) => s + (parseFloat(l.actualLaid) || 0), 0);
      const placePayout = calcPlaceReturn(matchedStake, bet.odds, frac);
      await changeUserBalance(bet.punterId, placePayout);

      if (houseLaid > 0) {
        const part = houseLaid / 2;
        const placeProfit = part * oddsToLiabilityMultiplier(bet.odds) * frac;
        await changeUserBalance(7, part - placeProfit);
      }
      for (const l of layers) {
        if (l.rejected) continue;
        const amt = parseFloat(l.actualLaid) || 0;
        if (amt <= 0) continue;
        const part = amt / 2;
        const placeProfit = part * oddsToLiabilityMultiplier(bet.odds) * frac;
        await changeUserBalance(l.layerId, part - placeProfit);
      }
    }
  } else if (result === "lost") {
    if (houseLaid > 0) {
      await changeUserBalance(7, houseLaid);
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
      await changeUserBalance(7, manualPayouts.houseDelta);
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
    const updated = await prisma.bet.update({
      where: { id: bet.id },
      data: {
        phase: "layer_bidding",
        layerTimerEnd: new Date(now.getTime() + settings.layerTimerSeconds * 1000),
        houseTimerEnd: null,
      },
    });
    console.log(`[HOUSE TIMER] Bet ${bet.id} moved to layer_bidding`);
    const serialized = serializeBet(updated);
    io.emit("betUpdated", serialized);
    io.emit("bet:notify", {
      phase: "layer_bidding",
      betId: updated.id,
      event: updated.event,
      selection: updated.selection,
      odds: updated.odds,
      stake: updated.stake,
      eachWay: !!updated.eachWay,
      punterName: updated.punterName,
      punterId: updated.punterId,
    });
        await sendPushToLayers(
      "Available to lay",
      `${updated.event} – ${updated.selection} @ ${updated.odds}`,
      "btm-layer-" + updated.id,
      updated.punterId
    );
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
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }
    const rows = await prisma.$queryRaw`
      SELECT id, name, email, "canLay", balance, weight, role, "passwordHash", "mustChangePassword"
      FROM "User" WHERE lower(email) = ${email}
    `;
    const user = rows[0];
    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: "Invalid login" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, error: "Invalid login" });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        canLay: user.canLay,
        balance: Number(user.balance) || 0,
        weight: Number(user.weight) || 1,
        role: user.role || "punter",
        mustChangePassword: !!user.mustChangePassword,   // ← add this
  },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/auth/set-password", async (req, res) => {
  try {
    const userId = parseInt(req.body.userId);
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "punter");
    if (!userId || !email || !password) {
      return res.status(400).json({ success: false, error: "userId, email and password required" });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, error: "Password too short" });
    }
    const hash = await bcrypt.hash(password, 10);
    await prisma.$executeRaw`
      UPDATE "User"
      SET email = ${email}, "passwordHash" = ${hash}, role = ${role},
          "mustChangePassword" = true, "updatedAt" = NOW()
      WHERE id = ${userId}
    `;
    console.log(`Auth set for user ${userId} (${email}) role=${role}`);
    res.json({ success: true, userId, email, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balance: true,
        canLay: true,
        weight: true,
        mustChangePassword: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/auth/create-user', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name ||  !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        name,
        role: 'punter',
        canLay: false,
        balance: 0,
        weight: 1.0,
        mustChangePassword: true,    // force change on first login if you wired it
      },
    });

    res.json({ success: true, userId: user.id, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const userId = parseInt(req.body.userId);
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "All fields required" });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, error: "New password too short" });
    }
    const rows = await prisma.$queryRaw`
      SELECT id, "passwordHash" FROM "User" WHERE id = ${userId}
    `;
    const user = rows[0];
    if (!user || !user.passwordHash) {
      return res.status(400).json({ success: false, error: "No password set" });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, error: "Current password wrong" });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.$executeRaw`
      UPDATE "User" SET "passwordHash" = ${hash}, "mustChangePassword" = false, "updatedAt" = NOW()
      WHERE id = ${userId}
    `;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/users", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "punter");
    const canLay = Boolean(req.body.canLay);
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "name, email and password required" });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hash,
        role,
        canLay,
        balance: 0,
        weight: 1,
      },
    });
    console.log("Created user", user.id, user.email);
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        canLay: user.canLay,
        balance: user.balance,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
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
    eachWay: !!req.body.eachWay,
originalStake: req.body.originalStake != null ? parseFloat(req.body.originalStake) : parseFloat(req.body.stake),
status: "pending",
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
    io.emit("bet:notify", {
      phase: bet.phase,
      betId: bet.id,
      event: bet.event,
      selection: bet.selection,
      odds: bet.odds,
      stake: bet.stake,
      eachWay: !!bet.eachWay,
      punterName: bet.punterName,
      punterId: bet.punterId,
    });
        if (bet.phase === "house_review" || bet.phase === "house_residual") {
      await sendPushToHouse(
        bet.phase === "house_residual" ? "Residual — House" : "New bet — House review",
        `${bet.event} – ${bet.selection} @ ${bet.odds}`,
        "btm-house-" + bet.id
      );
    }
    if (bet.phase === "layer_bidding") {
      await sendPushToLayers(
        "Available to lay",
        `${bet.event} – ${bet.selection} @ ${bet.odds}`,
        "btm-layer-" + bet.id,
        bet.punterId
      );
    }
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
    data.status = "accepted";
    data.phase = "finalized";
    data.acceptedAt = now;
    data.houseTimerEnd = null;
    data.layerTimerEnd = null;
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
    if (updated.phase === "layer_bidding" || updated.phase === "house_residual") {
      io.emit("bet:notify", {
        phase: updated.phase,
        betId: updated.id,
        event: updated.event,
        selection: updated.selection,
        odds: updated.odds,
        stake: updated.stake,
        eachWay: !!updated.eachWay,
        punterName: updated.punterName,
        punterId: updated.punterId,
      });
            if (updated.phase === "layer_bidding") {
        await sendPushToLayers(
          "Available to lay",
          `${updated.event} – ${updated.selection} @ ${updated.odds}`,
          "btm-layer-" + updated.id,
          updated.punterId
        );
      }
      if (updated.phase === "house_residual") {
        await sendPushToHouse(
          "Residual — House",
          `${updated.event} – ${updated.selection} @ ${updated.odds}`,
          "btm-house-" + updated.id
        );
      }
    }
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
    const { result, notes, manualPayouts, placeFraction } = req.body; // result = "won" | "lost" | "manual"

    const bet = await prisma.bet.findUnique({ where: { id } }); 
    if (!bet) return res.status(404).json({ success: false, error: "Bet not found" });
    if (bet.phase !== "finalized" && bet.phase !== "settled") {
      return res.status(400).json({ success: false, error: "Bet is not ready for settlement" });
    }
    if (bet.settledAt) {
      return res.status(400).json({ success: false, error: "Already settled" });
    }

    const outcome = await settleBet(bet, result, notes, manualPayouts, placeFraction);
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
app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    if (!userId || !subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ success: false, error: "Missing data" });
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        userId: Number(userId),
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        userId: Number(userId),
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
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
// GET /api/events?q=don&from=2026-08-01
app.get("/api/events", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    const from = new Date();
    from.setHours(0, 0, 0, 0);

    const to = new Date(from);
    to.setDate(to.getDate() + 25);
    to.setHours(23, 59, 59, 999);

    const where = {
      active: true,
      date: { gte: from, lte: to },
    };
    if (q) {
      where.name = { contains: q, mode: "insensitive" };
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ date: "asc" }, { name: "asc" }],
      take: 2000,
    });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/events  (single)
app.post("/api/events", async (req, res) => {
  try {
    const { type, name, date } = req.body;
    if (!type || !name || !date) {
      return res.status(400).json({ success: false, error: "type, name, date required" });
    }
    const event = await prisma.event.create({
      data: {
        type: String(type).toLowerCase(),
        name: String(name).trim(),
        date: new Date(date),
      },
    });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/events/bulk  (CSV rows as JSON array)
app.post("/api/events/bulk", async (req, res) => {
  try {
    const rows = Array.isArray(req.body.events) ? req.body.events : [];
    if (!rows.length) {
      return res.status(400).json({ success: false, error: "No events provided" });
    }

    const data = rows
      .filter(r => r.type && r.name && r.date)
      .map(r => ({
  type: String(r.type).toLowerCase(),
  name: String(r.name).trim(),
  date: new Date(r.date),
  isHandicap: !!r.isHandicap,
  fieldSize: r.fieldSize != null ? parseInt(r.fieldSize, 10) : null,
}));

const result = await prisma.event.createMany({ data });
    res.json({ success: true, count: result.count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// DELETE /api/events  (all)
app.delete("/api/events", async (req, res) => {
  try {
    const result = await prisma.event.deleteMany({});
    res.json({ success: true, count: result.count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// DELETE /api/events/:id
app.delete("/api/events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.event.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// GET /api/runners?q=rum&eventId=12  (or eventName=340 Doncaster)
app.get("/api/runners", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const eventId = req.query.eventId ? parseInt(req.query.eventId) : null;
    const eventName = (req.query.eventName || "").trim();

    const where = {};
    if (q) where.name = { contains: q, mode: "insensitive" };
    if (eventId) where.eventId = eventId;
    else if (eventName) where.event = { name: { equals: eventName, mode: "insensitive" } };

    const runners = await prisma.runner.findMany({
      where,
      orderBy: { name: "asc" },
      take: 25,
      select: { id: true, name: true, eventId: true },
    });
    res.json({ success: true, runners });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/runners/bulk", async (req, res) => {
  try {
    const rows = Array.isArray(req.body.runners) ? req.body.runners : [];
    if (!rows.length) return res.json({ success: true, count: 0 });

    const data = rows
      .filter(r => r.eventId && r.name)
      .map(r => ({
        eventId: parseInt(r.eventId, 10),
        name: String(r.name).trim(),
      }));

    const result = await prisma.runner.createMany({ data });
    res.json({ success: true, count: result.count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// Optional: soft-delete (set active=false) instead of hard delete
app.patch("/api/events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const event = await prisma.event.update({
      where: { id },
      data: { active: req.body.active === false ? false : true },
    });
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/users/:id/rights", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const canLay = Boolean(req.body.canLay);
    const role = String(req.body.role || "punter");
    await prisma.$executeRaw`
      UPDATE "User"
      SET "canLay" = ${canLay}, role = ${role}, "updatedAt" = NOW()
      WHERE id = ${id}
    `;
    res.json({ success: true, id, canLay, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ Server LIVE on port ${PORT}`));