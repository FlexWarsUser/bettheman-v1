console.log("Starting BetTheMan Server...");

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

let bets = [];

app.post("/api/bets", (req, res) => {
  const newBet = { 
    id: Date.now(), 
    ...req.body, 
    status: "pending", 
    houseAction: null,
    houseAmount: null,
    createdAt: new Date(),
    actionedAt: null
  };
  bets.push(newBet);
  console.log("New Bet Received:", newBet);
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
  if (betIndex === -1) {
    return res.status(404).json({ success: false });
  }

  const bet = bets[betIndex];
  bet.houseAction = action;
  bet.houseAmount = amount || bet.stake;
  bet.status = action === 'Rejected' ? 'rejected' : 'accepted';
  bet.actionedAt = new Date();           // ← This sets the accepted/rejected time

  console.log("House action on bet", id, ":", action);
  io.emit("betUpdated", bet);

  res.json({ success: true, bet });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log("SUCCESS! BetTheMan Server is LIVE on http://localhost:" + PORT);
});