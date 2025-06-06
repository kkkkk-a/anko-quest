const express = require("express");
const app = express();
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

// 静的ファイルを public から提供
app.use(express.static("public"));

// ルート
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// ソケット通信
io.on("connection", (socket) => {
  console.log("ユーザー接続");

  socket.on("chat message", (msg) => {
    console.log("受信:", msg);
    io.emit("chat message", msg); // 全員に送信
  });

  socket.on("disconnect", () => {
    console.log("ユーザー切断");
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
