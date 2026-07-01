console.log("🚀 Starting BetTheMan Server...");

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: "*" } 
});

app.use(cors());
app.use(express.json());

let bets = [];

app.post("/api/bets", (req, res) => {
  const newBet = {
    id: Date.now(),
    ...req.body,
    status: "pending",
    phase: "house_review",
    houseAction: null,
    houseAmount: null,
    acceptedAt: null,
    houseTimerEnd: new Date(Date.now() + 30 * 1000).toISOString(),
    layerTimerEnd: null,
    createdAt: new Date().toISOString(),
    layerBids: []
  };
  bets.push(newBet);
  console.log("🆕 New Bet Received:", newBet);
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

  if (action === 'Accepted') {
    bet.houseAction = 'Accepted';
    bet.houseAmount = parseFloat(bet.stake);
    bet.status = 'accepted';
    bet.phase = 'finalized';
    bet.acceptedAt = new Date().toISOString();
    bet.layerTimerEnd = null;
  } else if (action === 'Partial') {
    bet.houseAction = 'Partial';
    bet.houseAmount = parseFloat(amount || 0);
    bet.phase = 'layer_bidding';
    bet.layerTimerEnd = new Date(Date.now() + 30 * 1000).toISOString();
  } else if (action === 'Rejected') {
    bet.houseAction = 'Rejected';
    bet.phase = 'layer_bidding';
    bet.layerTimerEnd = new Date(Date.now() + 30 * 1000).toISOString();
  }

  console.log(`🏠 House ${action} bet ${id}`, bet);
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
    layerId: parseInt(layerId),
    layerName,
    amount: parseFloat(amount),
    bidAt: new Date().toISOString()
  });

  console.log(`Layer bid on bet ${id}`, bet.layerBids);
  io.emit("betUpdated", bet);
  res.json({ success: true, bet });
});

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ SUCCESS! BetTheMan Server is LIVE on http://localhost:${PORT}`);
});