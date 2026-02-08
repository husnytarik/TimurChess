const canvas = document.getElementById("gameCanvas");
canvas.width =
  CONFIG.BOARD.COLS * CONFIG.BOARD.TILE_SIZE + CONFIG.BOARD.OFFSET_X * 2;
canvas.height =
  CONFIG.BOARD.ROWS * CONFIG.BOARD.TILE_SIZE + CONFIG.BOARD.OFFSET_Y * 2;
window.renderer = new Renderer(canvas);
const statusDiv = document.getElementById("status");

// Global State
window.state = {
  pieces: [],
  turn: "white",
  myColor: null,
  roomId: null,
  selectedPiece: null,
  legalMoves: [],
  gameOver: false,
  gameStarted: false,
  hoverSquare: null,
  errorSquare: null,
  isReady: false,
  nickname: "Player",
  timers: {
    white: CONFIG.GAME.TIME_LIMIT_SECONDS,
    black: CONFIG.GAME.TIME_LIMIT_SECONDS,
  },
  interval: null,
};

window.startGameUI = (roomId) => {
  document.getElementById("lobby-screen").classList.add("hidden");
  document.getElementById("room-info").classList.remove("hidden");
  document.getElementById("ui-panel").classList.remove("hidden");
  document.getElementById("game-container").classList.remove("hidden");
  document.getElementById("display-room-id").textContent = roomId;
  document.getElementById("my-role").textContent =
    window.state.myColor === "white" ? "WHITE" : "BLACK";

  document.getElementById("chat-container").classList.remove("hidden");
  window.Network.listenForChat(roomId, window.renderChatMessages);

  window.Network.getUserProfile().then((p) => {
    if (p) window.state.nickname = p.nickname;
  });

  const myVoiceId = `${roomId}_${window.state.myColor}`;
  window.Voice.init(myVoiceId).then(() =>
    window.Network.savePeerId(roomId, window.state.myColor, myVoiceId),
  );
  initGame();
};

window.leaveRoom = async () => {
  if (!confirm("Leave game?")) return;
  await window.Network.leaveGame(window.state.roomId, window.state.myColor);
  location.reload();
};

window.toggleReadyState = () => {
  window.state.isReady = !window.state.isReady;
  const container = document.querySelector(".ready-toggle-container");
  const text = document.getElementById("ready-text");

  if (window.state.isReady) {
    container.classList.add("active");
    text.textContent = "I'M READY!";
  } else {
    container.classList.remove("active");
    text.textContent = "NOT READY";
  }
  window.Network.setReady(
    window.state.roomId,
    window.state.myColor,
    window.state.isReady,
  );
};

function initGame() {
  window.state.pieces = CONFIG.INITIAL_SETUP.map(
    (d) => new Piece(d.t, d.c, d.x, d.y),
  );
  window.Network.listenGame(window.state.roomId, (d) => handleServerUpdate(d));
  gameLoop();
}

let lastProcessedMove = null;
function handleServerUpdate(data) {
  if (!data) return;

  const wS = document.getElementById("status-white");
  const bS = document.getElementById("status-black");
  if (data.playerWhite) {
    wS.textContent = data.readyWhite ? "READY" : "WAITING";
    wS.className = data.readyWhite
      ? "player-tag tag-ready"
      : "player-tag tag-waiting";
  }
  if (data.playerBlack) {
    bS.textContent = data.readyBlack ? "READY" : "WAITING";
    bS.className = data.readyBlack
      ? "player-tag tag-ready"
      : "player-tag tag-waiting";
  }

  if (window.state.myColor === "white" && data.peerBlack && !window.Voice.call)
    window.Voice.connectToPeer(data.peerBlack);

  if (data.status === "playing" && !window.state.gameStarted) {
    window.state.gameStarted = true;
    document.getElementById("ready-overlay").classList.add("hidden");
    startTimer();
  } else if (
    data.status !== "playing" &&
    data.readyWhite &&
    data.readyBlack &&
    window.state.myColor === "white"
  ) {
    window.Network.startGame(window.state.roomId);
  }

  window.state.turn = data.turn;
  updateStatusText();

  if (
    data.lastMove &&
    JSON.stringify(data.lastMove) !== JSON.stringify(lastProcessedMove)
  ) {
    const move = data.lastMove;
    const piece = window.state.pieces.find(
      (p) => p.x === move.from.x && p.y === move.from.y,
    );
    if (piece) {
      const targetIndex = window.state.pieces.findIndex(
        (p) => p.x === move.to.x && p.y === move.to.y,
      );
      if (targetIndex !== -1) window.state.pieces.splice(targetIndex, 1);
      piece.x = move.to.x;
      piece.y = move.to.y;
      const newType = GameLogic.checkPromotion(piece);
      if (newType) piece.type = newType;
    }
    lastProcessedMove = data.lastMove;
    checkGameState();
  }
}

function updateStatusText() {
  statusDiv.textContent =
    window.state.turn === window.state.myColor
      ? "YOUR TURN"
      : "OPPONENT'S TURN";
  statusDiv.style.background =
    window.state.turn === window.state.myColor ? "#27ae60" : "#c0392b";
}

function startTimer() {
  if (window.state.interval) clearInterval(window.state.interval);
  window.state.interval = setInterval(() => {
    if (!window.state.gameStarted || window.state.gameOver) return;
    window.state.timers[window.state.turn]--;
    formatTime("timer-white", window.state.timers.white);
    formatTime("timer-black", window.state.timers.black);
    if (window.state.timers[window.state.turn] <= 0)
      endGame(window.state.turn === "white" ? "black" : "white", "Time Up");
  }, 1000);
}
function formatTime(id, s) {
  document.getElementById(id).textContent = `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

window.executeMove = (move) => {
  const from = {
    x: window.state.selectedPiece.x,
    y: window.state.selectedPiece.y,
  };
  const targetIdx = window.state.pieces.findIndex(
    (p) => p.x === move.x && p.y === move.y,
  );

  let captureText = "";
  if (targetIdx !== -1) {
    const capturedPiece = window.state.pieces[targetIdx];
    window.state.pieces.splice(targetIdx, 1);
    captureText = ` captured ${capturedPiece.type}`;
  }

  const pieceType = window.state.selectedPiece.type;
  window.state.selectedPiece.x = move.x;
  window.state.selectedPiece.y = move.y;

  const promo = GameLogic.checkPromotion(window.state.selectedPiece);
  if (promo) window.state.selectedPiece.type = promo;

  window.state.selectedPiece = null;
  window.state.legalMoves = [];

  window.Network.sendMove(
    window.state.roomId,
    { from, to: move },
    window.state.turn === "white" ? "black" : "white",
  );

  // LOGLAMA
  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
  const fromStr = `${cols[from.x] || "?"}${10 - from.y}`;
  const toStr = `${cols[move.x] || "?"}${10 - move.y}`;
  window.Network.sendChatMessage(
    window.state.roomId,
    `[GAME] ${pieceType.toUpperCase()} ${fromStr} -> ${toStr}${captureText}`,
    "SYSTEM",
  );

  checkGameState();
};

function checkGameState() {
  const myP = window.state.pieces.filter((p) => p.color === window.state.turn);
  if (
    !myP.some((p) => GameLogic.getLegalMoves(p, window.state.pieces).length > 0)
  ) {
    if (GameLogic.isKingInCheck(window.state.turn, window.state.pieces))
      endGame(window.state.turn === "white" ? "black" : "white", "CHECKMATE");
    else endGame("draw", "STALEMATE");
  }
}

function endGame(winner, reason) {
  window.state.gameOver = true;
  clearInterval(window.state.interval);
  if (window.state.gameStarted)
    window.Network.recordGameResult(
      winner === window.state.myColor,
      "Online Opponent",
    );
  statusDiv.textContent = `GAME OVER: ${reason}`;
}

function gameLoop() {
  const now = Date.now();
  window.renderer.setPerspective(window.state.myColor || "white");
  window.renderer.clear();
  window.renderer.drawBoard();
  if (window.state.hoverSquare)
    window.renderer.drawPulseSquare(
      window.state.hoverSquare,
      CONFIG.THEME.COLOR_HOVER,
      now,
      "hover",
    );
  window.state.legalMoves.forEach((m) =>
    window.renderer.drawPulseSquare(
      m,
      m.isCapture ? CONFIG.THEME.COLOR_CAPTURE : CONFIG.THEME.COLOR_VALID,
      now,
      "move",
    ),
  );
  if (window.state.errorSquare)
    window.renderer.drawSolidSquare(
      window.state.errorSquare,
      CONFIG.THEME.COLOR_INVALID,
      0.6,
    );

  let kPos = null;
  if (GameLogic.isKingInCheck(window.state.turn, window.state.pieces)) {
    const k = window.state.pieces.find(
      (p) =>
        (p.type === "king" || p.type === "prince") &&
        p.color === window.state.turn,
    );
    if (k) kPos = { x: k.x, y: k.y };
  }
  window.renderer.drawHighlights(window.state.selectedPiece, kPos);
  window.state.pieces.forEach((p) => window.renderer.drawPiece(p));
  requestAnimationFrame(gameLoop);
}
