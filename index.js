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


  socket.on("chat message", (msg) => {

    io.emit("chat message", msg); // 全員に送信
  });


});

const PORT = process.env.PORT || 3000;

