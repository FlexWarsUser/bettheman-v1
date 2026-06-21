const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "bets.json");

let bets = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    bets = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    console.log("Could not load bets.json");
  }
}

function saveBets() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(bets, null, 2));
}

function finalizeBetAllocations(bet) {
  if (!bet || bet.allocationComplete) return bet;

  const houseAmount = bet.houseAmount || 0;
  const remainingStake = parseFloat(bet.stake) - houseAmount;

  if (remainingStake <= 0) {
    bet.allocationComplete = true;
    bet.status = "fully_laid";
    return bet;
  }

  const layerBids = bet.layerBids || [];
  if (layerBids.length === 0) return bet;

  const totalBids = layerBids.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

  let updatedBids = layerBids.map(bid => ({
    ...bid,
    allocatedAmount: parseFloat(bid.amount) || 0,
    originalBid: parseFloat(bid.amount) || 0
  }));

  if (totalBids > remainingStake && totalBids > 0) {
    updatedBids = layerBids.map(bid => {
      const proportion = (parseFloat(bid.amount) || 0) / totalBids;
      const allocated = Math.floor(remainingStake * proportion);
      return {
        ...bid,
        allocatedAmount: allocated,
        originalBid: parseFloat(bid.amount) || 0
      };
    });
  }

  bet.layerBids = updatedBids;
  bet.allocationComplete = true;
  bet.status = "fully_laid";

  return bet;
}

// ==================== ROUTES ====================

app.post("/api/bets", (req, res) => {
  const newBet = {
    id: Date.now(),
    ...req.body,
    status: "pending",
    houseAction: null,
    houseAmount: 0,
    layerBids: [],
    allocationComplete: false,
    createdAt: new Date()
  };
  bets.push(newBet);
  saveBets();
  io.emit("newBetForHouse", newBet);
  res.json({ success: true, bet: newBet });
});

app.get("/api/bets", (req, res) => {
  res.json(bets);
});

app.post("/api/bets/:id/action", (req, res) => {
  const { id } = req.params;
  const { action, amount } = req.body;

  const betIndex = bets.findIndex(b => b.id === parseInt(id));
  if (betIndex === -1) return res.status(404).json({ success: false });

  const bet = bets[betIndex];

  // Prevent House acting more than once
  if (bet.houseAction) {
    return res.status(400).json({ 
      success: false, 
      message: "House has already taken action on this bet" 
    });
  }

  const currentHouseAmount = bet.houseAmount || 0;
  const remainingStake = parseFloat(bet.stake) - currentHouseAmount;

  if (action === "Partial" || action === "Accepted") {
    let layAmount = 0;

    if (action === "Accepted") {
      layAmount = remainingStake;
    } else if (action === "Partial") {
      layAmount = parseFloat(amount) || 0;
      if (layAmount > remainingStake) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot lay more than remaining stake (£${remainingStake})` 
        });
      }
    }

    bet.houseAmount = currentHouseAmount + layAmount;
    bet.houseAction = action;
    bet.layerTimerEnd = Date.now() + 30000;
  } 
  else if (action === "Rejected") {
    bet.houseAction = "Rejected";
    bet.houseAmount = currentHouseAmount;
    bet.layerTimerEnd = Date.now() + 30000;
  }

  saveBets();
  io.emit("betUpdated", bet);
  res.json({ success: true, bet });
});

app.post("/api/bets/:id/layer-bid", (req, res) => {
  const { id } = req.params;
  const { layerId, layerName, amount } = req.body;

  const betIndex = bets.findIndex(b => b.id === parseInt(id));
  if (betIndex === -1) return res.status(404).json({ success: false });

  const bet = bets[betIndex];
  if (!bet.layerBids) bet.layerBids = [];

  bet.layerBids.push({
    layerId,
    layerName,
    amount: parseFloat(amount),
    timestamp: new Date()
  });

  // Auto-finalize if layers have now covered the remaining stake
  const totalMatched = (bet.houseAmount || 0) + 
    bet.layerBids.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

  if (totalMatched >= parseFloat(bet.stake)) {
    finalizeBetAllocations(bet);
  }

  saveBets();
  io.emit("betUpdated", bet);
  res.json({ success: true, bet });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ BetTheMan Server running on http://localhost:${PORT}`);
});