const canvas = document.getElementById("gameCanvas");
canvas.width =
  CONFIG.BOARD.COLS * CONFIG.BOARD.TILE_SIZE + CONFIG.BOARD.OFFSET_X * 2;
canvas.height =
  CONFIG.BOARD.ROWS * CONFIG.BOARD.TILE_SIZE + CONFIG.BOARD.OFFSET_Y * 2;
window.renderer = new Renderer(canvas);
const statusDiv = document.getElementById("status");

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
  isVsComputer: false,
  timers: {
    white: CONFIG.GAME.TIME_LIMIT_SECONDS,
    black: CONFIG.GAME.TIME_LIMIT_SECONDS,
  },
  interval: null,
};

const ICONS = {
  CHECK: '<i class="fa-solid fa-check" style="color:#2ecc71;"></i>',
  CROSS: '<i class="fa-solid fa-xmark" style="color:#e74c3c;"></i>',
  WAIT: '<i class="fa-solid fa-hourglass-half" style="color:#f1c40f;"></i>',
};

window.addLogEntry = (msg) => {
  const list = document.getElementById("log-list");
  const div = document.createElement("div");
  div.className = "log-item";
  div.textContent = msg;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
};

window.startGameUI = (roomId) => {
  const newurl =
    window.location.protocol +
    "//" +
    window.location.host +
    window.location.pathname +
    "?room=" +
    roomId;
  window.history.pushState({ path: newurl }, "", newurl);

  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("lobby-screen").classList.add("hidden");

  document.getElementById("game-header-bar").classList.remove("hidden");
  document.getElementById("middle-area").classList.remove("hidden");
  document.getElementById("game-container").classList.remove("hidden");
  document.getElementById("ui-panel").classList.remove("hidden");
  document.getElementById("log-container").classList.remove("hidden");
  document.getElementById("chat-container").classList.remove("hidden");

  document.getElementById("log-list").innerHTML = "";
  document.getElementById("display-room-id").textContent = roomId;

  window.Network.getUserProfile().then((p) => {
    const name = p && p.nickname ? p.nickname : "Player";
    const badge = document.getElementById("badge-nickname-game");
    if (badge) badge.textContent = name;
  });

  initGame();

  if (window.state.isVsComputer) {
    const overlay = document.getElementById("lobby-waiting-overlay");
    if (overlay) overlay.classList.add("hidden");

    const miniReady = document.getElementById("ready-overlay");
    if (miniReady) miniReady.classList.add("hidden");

    window.state.gameStarted = true;
    window.state.turn = "white";
    window.updateStatusText();
    startTimer();
  } else {
    const overlay = document.getElementById("lobby-waiting-overlay");
    if (overlay) overlay.classList.remove("hidden");

    window.Network.listenForChat(roomId, window.renderChatMessages);
    const myVoiceId = `${roomId}_${window.state.myColor}`;
    window.Voice.init(myVoiceId).then(() =>
      window.Network.savePeerId(roomId, window.state.myColor, myVoiceId),
    );
    window.Network.listenGame(roomId, (d) => handleServerUpdate(d));
  }
};

window.leaveRoom = async () => {
  if (!confirm("Leave game?")) return;

  window.history.pushState({}, "", window.location.pathname);

  if (!window.state.isVsComputer) {
    await window.Network.leaveGame(window.state.roomId, window.state.myColor);
  }
  location.reload();
};

window.toggleReadyState = () => {
  if (window.state.isVsComputer) return;

  const chk = document.getElementById("chk-ready-big");
  window.state.isReady = chk ? chk.checked : !window.state.isReady;

  const txt = document.getElementById("ready-text-big");
  if (txt) {
    txt.textContent = window.state.isReady ? "I'M READY!" : "ARE YOU READY?";
    txt.style.color = window.state.isReady ? "#2ecc71" : "#bdc3c7";
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
  gameLoop();
}

let lastProcessedMove = null;
function handleServerUpdate(data) {
  if (!data) return;

  const pWhite = document.getElementById("lobby-p-white");
  const sWhite = document.getElementById("lobby-s-white");
  const pBlack = document.getElementById("lobby-p-black");
  const sBlack = document.getElementById("lobby-s-black");

  if (data.playerWhite) {
    pWhite.textContent = data.whiteName || "Player 1";
    sWhite.innerHTML = data.readyWhite ? ICONS.CHECK : ICONS.CROSS;
  } else {
    pWhite.textContent = "Waiting...";
    sWhite.innerHTML = ICONS.WAIT;
  }

  if (data.playerBlack) {
    pBlack.textContent = data.blackName || "Player 2";
    sBlack.innerHTML = data.readyBlack ? ICONS.CHECK : ICONS.CROSS;
  } else {
    pBlack.textContent = "Waiting...";
    sBlack.innerHTML = ICONS.WAIT;
  }

  const dotWhite = document.getElementById("status-white");
  const dotBlack = document.getElementById("status-black");
  if (dotWhite)
    dotWhite.style.background = data.readyWhite
      ? "#2ecc71"
      : data.playerWhite
        ? "#f1c40f"
        : "#7f8c8d";
  if (dotBlack)
    dotBlack.style.background = data.readyBlack
      ? "#2ecc71"
      : data.playerBlack
        ? "#f1c40f"
        : "#7f8c8d";

  if (data.status === "playing") {
    if (!window.state.gameStarted) {
      window.state.gameStarted = true;
      document.getElementById("lobby-waiting-overlay").classList.add("hidden");
      document.getElementById("ready-overlay").classList.add("hidden");
      startTimer();
    }
  } else if (
    data.status !== "playing" &&
    data.readyWhite &&
    data.readyBlack &&
    window.state.myColor === "white"
  ) {
    window.Network.startGame(window.state.roomId);
  }

  if (window.state.myColor === "white" && data.peerBlack && !window.Voice.call)
    window.Voice.connectToPeer(data.peerBlack);

  window.state.turn = data.turn;
  window.updateStatusText();

  if (
    data.lastMove &&
    JSON.stringify(data.lastMove) !== JSON.stringify(lastProcessedMove)
  ) {
    const move = data.lastMove;
    const piece = window.state.pieces.find(
      (p) => p.x === move.from.x && p.y === move.from.y,
    );
    if (piece) {
      const pieceType = piece.type;
      const targetIndex = window.state.pieces.findIndex(
        (p) => p.x === move.to.x && p.y === move.to.y,
      );
      let captureText = "";

      if (targetIndex !== -1) {
        captureText = "x";
        window.state.pieces.splice(targetIndex, 1);
      }
      piece.x = move.to.x;
      piece.y = move.to.y;

      const newType = GameLogic.checkPromotion(piece);
      if (newType) piece.type = newType;

      const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
      const fromStr = `${cols[move.from.x]}${10 - move.from.y}`;
      const toStr = `${cols[move.to.x]}${10 - move.to.y}`;
      const logMsg = `${pieceType.toUpperCase().substring(0, 2)} ${fromStr} > ${toStr} ${captureText}`;
      window.addLogEntry(logMsg);
    }
    lastProcessedMove = data.lastMove;
    checkGameState();
  }
}

window.updateStatusText = () => {
  const statusDiv = document.getElementById("status");
  if (!statusDiv) return;

  if (window.state.isVsComputer) {
    if (window.state.turn === window.state.myColor) {
      statusDiv.textContent = "YOUR TURN";
      statusDiv.style.background = "rgba(46, 204, 113, 0.2)";
    } else {
      statusDiv.textContent = "THINKING...";
      statusDiv.style.background = "rgba(230, 126, 34, 0.5)";
    }
  } else {
    statusDiv.textContent =
      window.state.turn === window.state.myColor ? "YOUR TURN" : "OPPONENT";
    statusDiv.style.background =
      window.state.turn === window.state.myColor
        ? "rgba(46, 204, 113, 0.2)"
        : "rgba(192, 57, 43, 0.2)";
  }
};

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
  const el = document.getElementById(id);
  if (el)
    el.textContent = `${Math.floor(s / 60)
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
    captureText = "x";
  }

  const pieceType = window.state.selectedPiece.type;
  window.state.selectedPiece.x = move.x;
  window.state.selectedPiece.y = move.y;

  const promo = GameLogic.checkPromotion(window.state.selectedPiece);
  if (promo) window.state.selectedPiece.type = promo;

  window.state.selectedPiece = null;
  window.state.legalMoves = [];

  const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
  const fromStr = `${cols[from.x]}${10 - from.y}`;
  const toStr = `${cols[move.x]}${10 - move.y}`;
  const logMsg = `${pieceType.toUpperCase().substring(0, 2)} ${fromStr} > ${toStr} ${captureText}`;

  if (window.state.isVsComputer) {
    window.addLogEntry(logMsg);
    window.state.turn = window.state.turn === "white" ? "black" : "white";
    window.updateStatusText();
  } else {
    window.Network.sendMove(
      window.state.roomId,
      { from, to: move },
      window.state.turn === "white" ? "black" : "white",
    );
  }

  checkGameState();

  if (
    window.state.isVsComputer &&
    !window.state.gameOver &&
    window.state.turn === "black"
  ) {
    setTimeout(() => window.Bot.playTurn("black"), 500);
  }
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
  if (window.state.gameStarted && !window.state.isVsComputer)
    window.Network.recordGameResult(
      winner === window.state.myColor,
      "Online Opponent",
    );

  if (statusDiv)
    statusDiv.textContent = `${reason} - ${winner.toUpperCase()} WINS!`;
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
