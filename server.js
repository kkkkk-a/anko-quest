const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const MAX_STONES_PER_PLAYER = 3;
const TIME_LIMIT_SECONDS = 30;

app.use(express.static('public'));

let rooms = {};
let playerRoomMap = {};
let turnTimers = {};
let playerStats = {}; // { socketId: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 } }

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function updatePlayerStats(playerId, result) {
    if (!playerStats[playerId]) {
        playerStats[playerId] = { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 };
    }
    playerStats[playerId].gamesPlayed++;
    if (result === 'win') {
        playerStats[playerId].wins++;
    } else if (result === 'loss') {
        playerStats[playerId].losses++;
    } else if (result === 'draw') {
        playerStats[playerId].draws++;
    }
    console.log(`[Stats] Player ${playerId.substring(0,4)} stats updated: ${JSON.stringify(playerStats[playerId])}`);
    // クライアントに戦績を通知する場合
    io.to(playerId).emit('statsUpdate', playerStats[playerId]);
}


function initializeGame(roomId, player1Id, player2Id) {
    console.log(`[Server] Initializing game for room ${roomId} with players ${player1Id} and ${player2Id}`);
    rooms[roomId] = {
        board: Array(9).fill(''),
        players: [player1Id, player2Id],
        symbols: {[player1Id]: 'X', [player2Id]: 'O'},
        currentPlayerId: player1Id,
        playerMoves: {[player1Id]: [], [player2Id]: []},
        gameActive: true,
        winner: null,
        message: `ゲーム開始！プレイヤーX (${player1Id.substring(0,4)}) の番です (制限時間: ${TIME_LIMIT_SECONDS}秒)`
    };
    clearTurnTimer(roomId);
    startTurnTimer(roomId, player1Id);

    // ゲーム開始時に各プレイヤーに現在の戦績を送信
    if (playerStats[player1Id]) io.to(player1Id).emit('statsUpdate', playerStats[player1Id]);
    if (playerStats[player2Id]) io.to(player2Id).emit('statsUpdate', playerStats[player2Id]);
}

function checkWin(board, symbol) {
    for (const condition of winningConditions) {
        if (condition.every(index => board[index] === symbol)) {
            return true;
        }
    }
    return false;
}

function checkDraw(board) {
    // 盤面が全て埋まっているか、かつ勝者がいない場合
    // このゲームのルール上、石が消えるため、全てのマスが埋まることは稀。
    // 引き分けの条件をどう定義するかが難しい。
    // 例えば、特定の手数を超えても決着がつかない場合など。
    // ここでは単純に「全てのセルが埋まったら」という古典的な引き分けは適用しにくい。
    // 今回は、checkWinで勝者が決まらなかった場合、かつgameActiveがfalseになる特定の条件（例：手数上限）
    // がないため、明示的な引き分けは発生しにくい。
    // もし「どちらも勝てない状況」を判定するなら、より高度なロジックが必要。
    // 今回は、勝者が決まらないままゲームが終了した場合（例：両者合意のリセットなど）は考慮しない。
    return !board.includes(''); // 全てのセルが埋まったら引き分け (このルールではほぼ発生しない)
}


function clearTurnTimer(roomId) {
    if (turnTimers[roomId]) {
        if (turnTimers[roomId].timer) clearTimeout(turnTimers[roomId].timer);
        if (turnTimers[roomId].interval) clearInterval(turnTimers[roomId].interval);
        delete turnTimers[roomId];
        console.log(`[Server Timer] Timer cleared for room ${roomId}`);
    }
}

function startTurnTimer(roomId, playerId) {
    clearTurnTimer(roomId);
    const game = rooms[roomId];
    if (!game || !game.gameActive) return;

    turnTimers[roomId] = {
        playerId: playerId,
        timeLeft: TIME_LIMIT_SECONDS,
        timer: setTimeout(() => {
            if (rooms[roomId] && rooms[roomId].currentPlayerId === playerId && rooms[roomId].gameActive) {
                console.log(`[Server Timer] Player ${playerId} in room ${roomId} timed out.`);
                game.gameActive = false;
                const winnerId = game.players.find(pId => pId !== playerId);
                game.winner = winnerId; // 相手の勝ち
                const winnerSymbol = game.symbols[winnerId];
                const loserSymbol = game.symbols[playerId];
                game.message = `プレイヤー${loserSymbol} (${playerId.substring(0,4)}) の時間切れです。プレイヤー${winnerSymbol} (${winnerId ? winnerId.substring(0,4) : '相手'}) の勝ち！`;

                updatePlayerStats(playerId, 'loss'); // タイムアウトしたプレイヤーは負け
                if (winnerId) updatePlayerStats(winnerId, 'win'); // 相手は勝ち

                io.to(roomId).emit('gameStateUpdate', game);
                clearTurnTimer(roomId);
            }
        }, TIME_LIMIT_SECONDS * 1000),
        interval: setInterval(() => {
            if (turnTimers[roomId] && turnTimers[roomId].timeLeft > 0) {
                turnTimers[roomId].timeLeft--;
                io.to(roomId).emit('timerUpdate', {
                    currentPlayerId: turnTimers[roomId].playerId,
                    timeLeft: turnTimers[roomId].timeLeft
                });
            } else if (turnTimers[roomId] && turnTimers[roomId].interval) {
                clearInterval(turnTimers[roomId].interval);
                turnTimers[roomId].interval = null;
            }
        }, 1000)
    };
    io.to(roomId).emit('timerUpdate', {
        currentPlayerId: playerId,
        timeLeft: TIME_LIMIT_SECONDS
    });
    console.log(`[Server Timer] Timer started for player ${playerId} in room ${roomId}. ${TIME_LIMIT_SECONDS}s remaining.`);
}


io.on('connection', (socket) => {
    console.log('新しいプレイヤーが接続しました:', socket.id);
    // 接続時にプレイヤーの統計情報がなければ初期化
    if (!playerStats[socket.id]) {
        playerStats[socket.id] = { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 };
    }
    io.to(socket.id).emit('statsUpdate', playerStats[socket.id]); // 接続時に戦績を送信

    let assignedRoomId = null;
    for (const roomId_iter in rooms) {
        if (rooms[roomId_iter] && rooms[roomId_iter].players.length === 1 && !rooms[roomId_iter].gameActive) {
            rooms[roomId_iter].players.push(socket.id);
            playerRoomMap[socket.id] = roomId_iter;
            assignedRoomId = roomId_iter;
            socket.join(roomId_iter);

            console.log(`プレイヤー ${socket.id} がルーム ${assignedRoomId} に参加しました。ゲーム開始準備。`);
            initializeGame(assignedRoomId, rooms[assignedRoomId].players[0], socket.id);

            const player1Id = rooms[assignedRoomId].players[0];
            const player2Id = rooms[assignedRoomId].players[1];

            io.to(player1Id).emit('gameStart', { ...rooms[assignedRoomId], yourSymbol: rooms[assignedRoomId].symbols[player1Id] });
            io.to(player2Id).emit('gameStart', { ...rooms[assignedRoomId], yourSymbol: rooms[assignedRoomId].symbols[player2Id] });
            console.log(`ルーム ${assignedRoomId} でゲーム開始。プレイヤーX: ${player1Id.substring(0,4)}, プレイヤーO: ${player2Id.substring(0,4)}`);
            break;
        }
    }

    if (!assignedRoomId) {
        const newRoomId = `room_${socket.id}`;
        rooms[newRoomId] = { players: [socket.id], gameActive: false };
        playerRoomMap[socket.id] = newRoomId;
        socket.join(newRoomId);
        socket.emit('waitingForOpponent', { message: '対戦相手を待っています...' });
        console.log(`プレイヤー ${socket.id} が新しいルーム ${newRoomId} を作成し待機中。`);
    }

    socket.on('makeMove', (data) => {
        const roomId = playerRoomMap[socket.id];
        if (!roomId || !rooms[roomId] || !rooms[roomId].gameActive) return;

        const game = rooms[roomId];
        const cellIndex = data.cellIndex;
        const playerSymbol = game.symbols[socket.id];
        const opponentId = game.players.find(pId => pId !== socket.id);


        if (game.currentPlayerId !== socket.id) {
            socket.emit('invalidMove', { message: 'あなたの番ではありません。' });
            return;
        }
        if (game.board[cellIndex] !== '') {
            socket.emit('invalidMove', { message: 'そのマスは既に埋まっています。' });
            return;
        }

        clearTurnTimer(roomId);

        if (game.playerMoves[socket.id].length >= MAX_STONES_PER_PLAYER) {
            const oldestMove = game.playerMoves[socket.id].shift();
            game.board[oldestMove.index] = '';
        }

        game.board[cellIndex] = playerSymbol;
        game.playerMoves[socket.id].push({ index: cellIndex, mark: playerSymbol });
        console.log(`[Server] Player ${socket.id} (${playerSymbol}) in room ${roomId} placed stone at cell ${cellIndex}. Board: ${game.board}`);

        if (checkWin(game.board, playerSymbol)) {
            game.winner = socket.id;
            game.gameActive = false;
            game.message = `プレイヤー${playerSymbol} (${socket.id.substring(0,4)}) の勝ちです！🎉`;
            console.log(`[Server] Player ${socket.id} wins in room ${roomId}.`);
            updatePlayerStats(socket.id, 'win');
            if (opponentId) updatePlayerStats(opponentId, 'loss');
        } else if (checkDraw(game.board)) { // このルールでは引き分けの定義が難しい
            game.gameActive = false;
            game.message = `引き分けです！ 🤝`;
            console.log(`[Server] Draw in room ${roomId}.`);
            updatePlayerStats(socket.id, 'draw');
            if (opponentId) updatePlayerStats(opponentId, 'draw');
        } else {
            game.currentPlayerId = opponentId;
            const nextPlayerSymbol = game.symbols[game.currentPlayerId];
            game.message = `プレイヤー${nextPlayerSymbol} (${game.currentPlayerId.substring(0,4)}) の番です (制限時間: ${TIME_LIMIT_SECONDS}秒)`;
            startTurnTimer(roomId, game.currentPlayerId);
        }
        io.to(roomId).emit('gameStateUpdate', game);
    });

    socket.on('resetGameRequest', () => {
        const roomId = playerRoomMap[socket.id];
        if (roomId && rooms[roomId] && rooms[roomId].players.length === 2) {
            console.log(`[Server] Reset game request from ${socket.id} for room ${roomId}.`);
            clearTurnTimer(roomId);

            const player1Id = rooms[roomId].players[0];
            const player2Id = rooms[roomId].players[1];
            initializeGame(roomId, player1Id, player2Id);

            io.to(player1Id).emit('gameStart', { ...rooms[roomId], yourSymbol: rooms[roomId].symbols[player1Id] });
            io.to(player2Id).emit('gameStart', { ...rooms[roomId], yourSymbol: rooms[roomId].symbols[player2Id] });
            console.log(`ルーム ${roomId} のゲームがリセットされました。Next turn: ${rooms[roomId].currentPlayerId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('プレイヤーが切断しました:', socket.id);
        const roomId = playerRoomMap[socket.id];

        if (roomId && rooms[roomId]) {
            clearTurnTimer(roomId);
            const game = rooms[roomId]; // gameオブジェクトへの参照を取得

            const roomSymbols = game.symbols; // game.symbols を使う
            const disconnectedPlayerSymbol = (roomSymbols && roomSymbols[socket.id]) ? roomSymbols[socket.id] : '不明';

            game.players = game.players.filter(id => id !== socket.id);
            const wasGameActive = game.gameActive; // 切断前のゲーム状態を記録
            game.gameActive = false;
            game.message = `プレイヤー${disconnectedPlayerSymbol} (${socket.id.substring(0,4)}) が退出しました。`;

            if (game.players.length > 0) {
                const remainingPlayerId = game.players[0];
                if (wasGameActive) { // ゲームがアクティブ中に相手が切断した場合
                    game.winner = remainingPlayerId; // 残ったプレイヤーの勝ち
                    game.message += ` ${remainingPlayerId.substring(0,4)}の不戦勝。`;
                    console.log(`[Server] Player ${socket.id} disconnected during active game. ${remainingPlayerId} wins by default.`);
                    updatePlayerStats(socket.id, 'loss'); // 切断したプレイヤーは負け
                    updatePlayerStats(remainingPlayerId, 'win'); // 残ったプレイヤーは勝ち
                }
                io.to(remainingPlayerId).emit('opponentLeft', { // gameStateUpdate の方が一貫性があるかも
                    message: game.message,
                    board: game.board,
                    gameActive: false,
                    winner: game.winner
                });
                // delete rooms[roomId]; // 相手が抜けたらルームを削除する場合
                // console.log(`ルーム ${roomId} はプレイヤー退出により削除されました。`);
                // 一旦ルームは残すが、もうゲームはできない状態。新しいゲームは新しいルームで。
            } else {
                delete rooms[roomId];
                console.log(`ルーム ${roomId} は空になったため削除されました。`);
            }
        }
        // playerRoomMap からの削除は、プレイヤーが再接続時に新しいIDになるため、
        // このIDでの戦績は残るが、新しい接続では新しい戦績となる。
        // もしユーザーアカウントシステムを導入する場合は、socket.idではなくユーザーIDで戦績を管理する。
        // delete playerRoomMap[socket.id]; // roomIdへのマッピングは不要になる
        console.log(`Player ${socket.id.substring(0,4)} disconnected. Stats: ${JSON.stringify(playerStats[socket.id])}`);
        // playerRoomMap の削除は、そのプレイヤーがどのルームにいたかの情報なので、切断時に削除するのが適切。
        if (playerRoomMap[socket.id]) {
            delete playerRoomMap[socket.id];
        }
    });
});

server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});
