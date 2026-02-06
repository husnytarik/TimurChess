const canvas = document.getElementById("gameCanvas");
canvas.width =
  CONFIG.BOARD.COLS * CONFIG.BOARD.TILE_SIZE + CONFIG.BOARD.OFFSET_X * 2;
canvas.height =
  CONFIG.BOARD.ROWS * CONFIG.BOARD.TILE_SIZE + CONFIG.BOARD.OFFSET_Y * 2;

const renderer = new Renderer(canvas);
const statusDiv = document.getElementById("status");

let state = {
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
  timers: {
    white: CONFIG.GAME.TIME_LIMIT_SECONDS,
    black: CONFIG.GAME.TIME_LIMIT_SECONDS,
  },
  interval: null,
};

window.createRoom = async () => {
  const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
  document.getElementById("lobby-status").textContent = "Creating room...";

  const assignedColor = await window.Network.createGame(roomId);

  state.myColor = assignedColor;
  state.roomId = roomId;

  startGameUI(roomId);
};

window.joinRoom = async () => {
  const roomId = document
    .getElementById("room-code-input")
    .value.toUpperCase()
    .trim();
  if (!roomId) return alert("Please enter a code!");

  document.getElementById("lobby-status").textContent = "Connecting...";

  const result = await window.Network.joinGame(roomId);

  if (result.success) {
    state.myColor = result.color;
    state.roomId = roomId;
    startGameUI(roomId);
  } else {
    if (result.reason === "full") {
      alert("Room is full!");
    } else {
      alert("Room not found!");
    }
    document.getElementById("lobby-status").textContent = "";
  }
};

function startGameUI(roomId) {
  document.getElementById("lobby-screen").classList.add("hidden");
  document.getElementById("room-info").classList.remove("hidden");
  document.getElementById("ui-panel").classList.remove("hidden");
  document.getElementById("game-container").classList.remove("hidden");

  document.getElementById("display-room-id").textContent = roomId;
  document.getElementById("my-role").textContent =
    state.myColor === "white" ? "WHITE (Host)" : "BLACK (Guest)";

  const myVoiceId = `${roomId}_${state.myColor}`;
  window.Voice.init(myVoiceId).then(() => {
    window.Network.savePeerId(roomId, state.myColor, myVoiceId);
  });
  initGame();
}

window.setMyReady = () => {
  const btn = document.getElementById("btn-set-ready");
  btn.textContent = "Ready, Waiting...";
  btn.disabled = true;
  btn.style.background = "#95a5a6";
  window.Network.setReady(state.roomId, state.myColor);
};

function initGame() {
  state.pieces = CONFIG.INITIAL_SETUP.map((d) => new Piece(d.t, d.c, d.x, d.y));
  state.gameOver = false;
  state.gameStarted = false;

  window.Network.listenGame(state.roomId, (serverData) => {
    handleServerUpdate(serverData);
  });

  gameLoop();
}

let lastProcessedMove = null;

function handleServerUpdate(data) {
  if (!data) return;

  updateReadyStatusUI(data);

  if (state.myColor === "white" && data.peerBlack && !window.Voice.call) {
    window.Voice.connectToPeer(data.peerBlack);
  }
  if (data.status === "playing" && !state.gameStarted) {
    state.gameStarted = true;
    document.getElementById("ready-overlay").classList.add("hidden");
    startTimer();
  } else if (
    data.status !== "playing" &&
    data.readyWhite &&
    data.readyBlack &&
    state.myColor === "white"
  ) {
    window.Network.startGame(state.roomId);
  }

  state.turn = data.turn;
  updateStatusText();

  if (
    data.lastMove &&
    JSON.stringify(data.lastMove) !== JSON.stringify(lastProcessedMove)
  ) {
    const move = data.lastMove;

    const piece = state.pieces.find(
      (p) => p.x === move.from.x && p.y === move.from.y,
    );
    if (piece) {
      const targetIndex = state.pieces.findIndex(
        (p) => p.x === move.to.x && p.y === move.to.y,
      );
      if (targetIndex !== -1) state.pieces.splice(targetIndex, 1);

      piece.x = move.to.x;
      piece.y = move.to.y;

      const newType = GameLogic.checkPromotion(piece);
      if (newType) piece.type = newType;
    }

    lastProcessedMove = data.lastMove;
    checkGameState();
  }
}

function updateReadyStatusUI(data) {
  const wSpan = document.getElementById("status-white");
  const bSpan = document.getElementById("status-black");
  const msg = document.getElementById("waiting-msg");

  if (data.playerWhite) {
    wSpan.textContent = data.readyWhite ? "READY" : "Waiting...";
    wSpan.className = data.readyWhite
      ? "player-tag tag-ready"
      : "player-tag tag-waiting";
  } else {
    wSpan.textContent = "Disconnected";
  }

  if (data.playerBlack) {
    bSpan.textContent = data.readyBlack ? "READY" : "Waiting...";
    bSpan.className = data.readyBlack
      ? "player-tag tag-ready"
      : "player-tag tag-waiting";
    msg.textContent = "Waiting for both players to be ready...";
  } else {
    bSpan.textContent = "Disconnected";
    msg.textContent = "Waiting for opponent...";
  }
}

function updateStatusText() {
  if (state.turn === state.myColor) {
    statusDiv.textContent = "YOUR TURN!";
    statusDiv.style.backgroundColor = "#27ae60";
  } else {
    statusDiv.textContent = "Opponent is thinking...";
    statusDiv.style.backgroundColor = "#c0392b";
  }
}

function startTimer() {
  if (state.interval) clearInterval(state.interval);

  state.interval = setInterval(() => {
    if (!state.gameStarted || state.gameOver) return;

    state.timers[state.turn]--;

    formatTime("timer-white", state.timers.white);
    formatTime("timer-black", state.timers.black);

    if (state.timers[state.turn] <= 0) {
      endGame(state.turn === "white" ? "black" : "white", "Time's Up!");
    }
  }, 1000);
}

function formatTime(elementId, seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  document.getElementById(elementId).textContent = `${m}:${s}`;
}

function gameLoop() {
  const now = Date.now();
  renderer.setPerspective(state.myColor || "white");
  renderer.clear();
  renderer.drawBoard();

  if (state.hoverSquare) {
    renderer.drawPulseSquare(
      state.hoverSquare,
      CONFIG.THEME.COLOR_HOVER,
      now,
      "hover",
    );
  }

  state.legalMoves.forEach((move) => {
    const color = move.isCapture
      ? CONFIG.THEME.COLOR_CAPTURE
      : CONFIG.THEME.COLOR_VALID;
    renderer.drawPulseSquare(move, color, now, "move");
  });

  if (state.errorSquare) {
    if (now - state.errorSquare.time < 500) {
      renderer.drawSolidSquare(
        state.errorSquare,
        CONFIG.THEME.COLOR_INVALID,
        0.6,
      );
    } else {
      state.errorSquare = null;
    }
  }

  let kingCheckPos = null;
  if (GameLogic.isKingInCheck(state.turn, state.pieces)) {
    const k = state.pieces.find(
      (p) =>
        (p.type === "king" || p.type === "prince") && p.color === state.turn,
    );
    if (k) kingCheckPos = { x: k.x, y: k.y };
  }

  renderer.drawHighlights(state.selectedPiece, kingCheckPos);
  state.pieces.forEach((p) => renderer.drawPiece(p));

  requestAnimationFrame(gameLoop);
}

function getLogicalPos(evt) {
  const rect = canvas.getBoundingClientRect();
  let col = Math.floor(
    (evt.clientX - rect.left - CONFIG.BOARD.OFFSET_X) / CONFIG.BOARD.TILE_SIZE,
  );
  let row = Math.floor(
    (evt.clientY - rect.top - CONFIG.BOARD.OFFSET_Y) / CONFIG.BOARD.TILE_SIZE,
  );

  if (state.myColor === "black") {
    col = CONFIG.BOARD.COLS - 1 - col;
    row = CONFIG.BOARD.ROWS - 1 - row;
  }

  return { col, row };
}

canvas.addEventListener("mousemove", (e) => {
  const pos = getLogicalPos(e);
  const col = pos.col;
  const row = pos.row;

  const isValidMain =
    col >= 0 && col < CONFIG.BOARD.COLS && row >= 0 && row < CONFIG.BOARD.ROWS;
  const isLeftCitadel = col === -1 && row === 2;
  const isRightCitadel = col === 11 && row === 7;

  if (isValidMain || isLeftCitadel || isRightCitadel) {
    state.hoverSquare = { x: col, y: row };
  } else {
    state.hoverSquare = null;
  }
});

canvas.addEventListener("click", (e) => {
  if (state.gameOver || !state.gameStarted) return;
  if (state.turn !== state.myColor) return;
  if (!state.hoverSquare) return;

  const { x: col, y: row } = state.hoverSquare;

  const move = state.legalMoves.find((m) => m.x === col && m.y === row);
  if (state.selectedPiece && move) {
    executeMove(move);
    return;
  }

  const clickedPiece = state.pieces.find((p) => p.x === col && p.y === row);

  if (
    state.selectedPiece &&
    clickedPiece &&
    state.selectedPiece === clickedPiece
  ) {
    state.selectedPiece = null;
    state.legalMoves = [];
    state.errorSquare = null;
    return;
  }

  if (clickedPiece && clickedPiece.color === state.myColor) {
    state.selectedPiece = clickedPiece;
    const moves = GameLogic.getLegalMoves(clickedPiece, state.pieces);
    state.legalMoves = moves.map((m) => {
      const target = state.pieces.find((p) => p.x === m.x && p.y === m.y);
      return { ...m, isCapture: !!target };
    });
    state.errorSquare = null;
  } else if (state.selectedPiece) {
    state.errorSquare = { x: col, y: row, time: Date.now() };
  } else {
    state.selectedPiece = null;
    state.legalMoves = [];
  }
});

function executeMove(move) {
  const fromPos = { x: state.selectedPiece.x, y: state.selectedPiece.y };
  const toPos = { x: move.x, y: move.y };

  const targetIndex = state.pieces.findIndex(
    (p) => p.x === move.x && p.y === move.y,
  );
  if (targetIndex !== -1) state.pieces.splice(targetIndex, 1);

  state.selectedPiece.x = move.x;
  state.selectedPiece.y = move.y;

  const newType = GameLogic.checkPromotion(state.selectedPiece);
  if (newType) state.selectedPiece.type = newType;

  state.selectedPiece = null;
  state.legalMoves = [];

  const nextTurn = state.turn === "white" ? "black" : "white";
  lastProcessedMove = { from: fromPos, to: toPos };

  window.Network.sendMove(state.roomId, { from: fromPos, to: toPos }, nextTurn);
  checkGameState();
}

function checkGameState() {
  const myPieces = state.pieces.filter((p) => p.color === state.turn);
  const hasMove = myPieces.some(
    (p) => GameLogic.getLegalMoves(p, state.pieces).length > 0,
  );

  if (!hasMove) {
    if (GameLogic.isKingInCheck(state.turn, state.pieces)) {
      endGame(state.turn === "white" ? "black" : "white", "CHECKMATE");
    } else {
      endGame("draw", "STALEMATE");
    }
  }
}

function endGame(winner, reason) {
  state.gameOver = true;
  clearInterval(state.interval);

  if (winner === "draw") {
    statusDiv.textContent = `GAME OVER - DRAW (${reason})`;
    statusDiv.style.backgroundColor = "#7f8c8d";
  } else {
    const winnerText = winner === "white" ? "WHITE" : "BLACK";
    statusDiv.textContent = `GAME OVER - ${winnerText} WINS (${reason})`;
    statusDiv.style.backgroundColor = "#f39c12";
  }
}
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault(); // Sayfanın kaymasını engelle
    // Mouse click eventini taklit et
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("click", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvas.dispatchEvent(mouseEvent);
  },
  { passive: false },
);
