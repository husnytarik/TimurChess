// --- GLOBAL STATE ---
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
  isVsComputer: false, // Varsayılan False
  timers: {
    white: CONFIG.GAME.TIME_LIMIT_SECONDS,
    black: CONFIG.GAME.TIME_LIMIT_SECONDS,
  },
  interval: null,
};

window.startGameUI = (roomId) => {
  // 1. Ekran Geçişleri
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("lobby-screen").classList.add("hidden");

  document.getElementById("game-header-bar").classList.remove("hidden");
  document.getElementById("middle-area").classList.remove("hidden");
  document.getElementById("game-container").classList.remove("hidden");
  document.getElementById("ui-panel").classList.remove("hidden");
  document.getElementById("log-container").classList.remove("hidden");
  document.getElementById("chat-container").classList.remove("hidden");

  // 2. İçerik Temizliği
  document.getElementById("log-list").innerHTML = "";
  document.getElementById("display-room-id").textContent = roomId;

  // Profil ismini al
  window.Network.getUserProfile().then((p) => {
    const name = p && p.nickname ? p.nickname : "Player";
    const badge = document.getElementById("badge-nickname-game");
    if (badge) badge.textContent = name;
  });

  // Tahtayı Kur
  initGame();

  // --- BOT MU ONLINE MI? ---
  if (window.state.isVsComputer) {
    console.log("Bot Modu Başlatılıyor...");

    // 1. Lobi/Bekleme Ekranını ZORLA GİZLE
    const overlay = document.getElementById("lobby-waiting-overlay");
    if (overlay) overlay.classList.add("hidden");

    // 2. Oyunu Başlat
    window.state.gameStarted = true;
    window.state.turn = "white";
    window.updateStatusText();

    // 3. Süreyi Başlat
    startTimer();
  } else {
    // ONLINE MOD
    console.log("Online Mod Başlatılıyor...");

    // Lobi Ekranını GÖSTER
    const overlay = document.getElementById("lobby-waiting-overlay");
    if (overlay) overlay.classList.remove("hidden");

    // Chat ve Dinleyicileri Başlat
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
  if (!window.state.isVsComputer) {
    await window.Network.leaveGame(window.state.roomId, window.state.myColor);
  }
  location.reload();
};

window.toggleReadyState = () => {
  if (window.state.isVsComputer) return;

  // Yeni checkbox'ı bul
  const chk = document.getElementById("chk-ready-big");
  window.state.isReady = chk ? chk.checked : !window.state.isReady;

  // Yazıyı Güncelle
  const txt = document.getElementById("ready-text-big");
  if (txt) {
    txt.textContent = window.state.isReady ? "I'M READY!" : "ARE YOU READY?";
    txt.style.color = window.state.isReady ? "#2ecc71" : "#bdc3c7";
  }

  // Sunucuya bildir
  window.Network.setReady(
    window.state.roomId,
    window.state.myColor,
    window.state.isReady,
  );
};

// --- INIT GAME (ARTIK SAF - LISTEN GAME YOK) ---
function initGame() {
  window.state.pieces = CONFIG.INITIAL_SETUP.map(
    (d) => new Piece(d.t, d.c, d.x, d.y),
  );
  // BURADAN window.Network.listenGame KALDIRILDI!
  gameLoop();
}

let lastProcessedMove = null;
// --- SVG İKONLAR (IOS UYUMLU) ---
const ICONS = {
  CHECK: `<svg class="svg-icon" style="color:#2ecc71"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`, // TİK
  CROSS: `<svg class="svg-icon" style="color:#e74c3c"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`, // ÇARPI
  WAIT: `<svg class="svg-icon" style="color:#f1c40f"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v6zm0-8h-2V7h2v2z"/></svg>`, // SAAT
};

function handleServerUpdate(data) {
  if (!data) return;

  // --- LOBİ GÜNCELLEMESİ (İSİMLER & İKONLAR) ---
  const pWhite = document.getElementById("lobby-p-white");
  const sWhite = document.getElementById("lobby-s-white");
  const pBlack = document.getElementById("lobby-p-black");
  const sBlack = document.getElementById("lobby-s-black");

  // Beyaz Oyuncu
  if (data.playerWhite) {
    pWhite.textContent = data.whiteName || "Player 1";
    sWhite.innerHTML = data.readyWhite ? ICONS.CHECK : ICONS.CROSS;
  } else {
    pWhite.textContent = "Waiting...";
    sWhite.innerHTML = ICONS.WAIT;
  }

  // Siyah Oyuncu
  if (data.playerBlack) {
    pBlack.textContent = data.blackName || "Player 2";
    sBlack.innerHTML = data.readyBlack ? ICONS.CHECK : ICONS.CROSS;
  } else {
    pBlack.textContent = "Waiting...";
    sBlack.innerHTML = ICONS.WAIT;
  }

  // --- MİNİ STATUS BAR (NOKTALAR) ---
  const dotWhite = document.getElementById("status-white");
  const dotBlack = document.getElementById("status-black");

  if (dotWhite) {
    if (data.readyWhite) dotWhite.style.background = "#2ecc71";
    else if (data.playerWhite) dotWhite.style.background = "#f1c40f";
    else dotWhite.style.background = "#7f8c8d";
  }
  if (dotBlack) {
    if (data.readyBlack) dotBlack.style.background = "#2ecc71";
    else if (data.playerBlack) dotBlack.style.background = "#f1c40f";
    else dotBlack.style.background = "#7f8c8d";
  }

  // --- OYUN BAŞLAMA ---
  if (data.status === "playing") {
    if (!window.state.gameStarted) {
      window.state.gameStarted = true;
      // Lobiyi Gizle
      document.getElementById("lobby-waiting-overlay").classList.add("hidden");
      // Varsa mini ready butonunu da gizle
      const miniReady = document.getElementById("ready-overlay");
      if (miniReady) miniReady.classList.add("hidden");

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

  // Ses
  if (window.state.myColor === "white" && data.peerBlack && !window.Voice.call)
    window.Voice.connectToPeer(data.peerBlack);

  // Oyun Durumu
  window.state.turn = data.turn;
  window.updateStatusText();

  // Hareket İşleme
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
window.updateStatusText = () => {
  const statusDiv = document.getElementById("status");

  if (window.state.isVsComputer) {
    // BOT MODU
    if (window.state.turn === window.state.myColor) {
      statusDiv.textContent = "YOUR TURN (WHITE)";
      statusDiv.style.background = "#27ae60"; // Yeşil
    } else {
      statusDiv.textContent = "COMPUTER IS THINKING...";
      statusDiv.style.background = "#e67e22"; // Turuncu
    }
  } else {
    // ONLINE MOD
    statusDiv.textContent =
      window.state.turn === window.state.myColor
        ? "YOUR TURN"
        : "OPPONENT'S TURN";
    statusDiv.style.background =
      window.state.turn === window.state.myColor ? "#27ae60" : "#c0392b";
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

  // SEND MOVE (ONLINE OR BOT)
  if (window.state.isVsComputer) {
    // Botta sıra manuel değişir
    window.state.turn = window.state.turn === "white" ? "black" : "white";
    window.updateStatusText();
  } else {
    // Online'da sunucuya gider
    window.Network.sendMove(
      window.state.roomId,
      { from, to: move },
      window.state.turn === "white" ? "black" : "white",
    );
  }

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

  // BOT TETİKLEME
  if (
    window.state.isVsComputer &&
    !window.state.gameOver &&
    window.state.turn === "black"
  ) {
    setTimeout(() => window.Bot.playTurn("black"), 500); // 500ms gecikme ile çağır
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
