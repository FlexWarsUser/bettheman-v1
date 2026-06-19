console.log("?? Starting BetTheMan Server...");

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
    createdAt: new Date() 
  };
  bets.push(newBet);
  console.log("?? New Bet Received:", newBet);
  io.emit("newBetForHouse", newBet);
  res.json({ success: true, bet: newBet });
});

app.get("/api/bets", (req, res) => {
  res.json(bets);
});

io.on("connection", (socket) => {
  console.log("?? Client connected:", socket.id);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`? SUCCESS! BetTheMan Server is LIVE on http://localhost:${PORT}`);
  console.log("Ready for bets from the frontend...");
});
