// --- INIT & AUTH ---
window.addEventListener("load", () => {
  window.Network.initAuth(
    async (user) => {
      document.getElementById("auth-screen").classList.add("hidden");
      document.getElementById("lobby-screen").classList.remove("hidden");

      // Badge Update with Nickname
      const p = await window.Network.getUserProfile();
      document.getElementById("badge-nickname").textContent =
        p.nickname || user.email.split("@")[0];
      document.getElementById("badge-score").textContent =
        "Score: " + (p.score || 1000);

      const urlParams = new URLSearchParams(window.location.search);
      const inviteCode = urlParams.get("room");
      if (inviteCode) {
        document.getElementById("room-code-input").value = inviteCode;
        window.joinRoom();
      }
    },
    () => {
      document.getElementById("auth-screen").classList.remove("hidden");
      document.getElementById("lobby-screen").classList.add("hidden");
      document.getElementById("game-container").classList.add("hidden");
      document.getElementById("ui-panel").classList.add("hidden");
      document.getElementById("room-info").classList.add("hidden");
    },
  );
});

// --- LOBBY FUNCTIONS ---

window.createRoom = async () => {
  const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
  // Radio butonundan değeri al
  const isPublic =
    document.querySelector('input[name="roomType"]:checked').value === "public";

  document.getElementById("lobby-status").textContent = "Creating room...";
  const assignedColor = await window.Network.createGame(roomId, isPublic);

  if (assignedColor) {
    state.myColor = assignedColor;
    state.roomId = roomId;
    startGameUI(roomId);
  } else {
    alert("Error creating room.");
  }
};

window.showPublicRooms = async () => {
  document.getElementById("public-rooms-modal").classList.remove("hidden");
  const list = document.getElementById("public-rooms-list");
  list.innerHTML = "Loading...";

  const games = await window.Network.getPublicGames();
  list.innerHTML = "";

  if (games.length === 0) {
    list.innerHTML =
      "<div style='padding:10px;'>No public rooms found. Create one!</div>";
    return;
  }

  games.forEach((g) => {
    const div = document.createElement("div");
    div.className = "public-room-item";
    div.innerHTML = `<span>Room: <b>${g.id}</b></span> <button class='btn btn-success' style='font-size:12px; padding:5px 10px;'>JOIN</button>`;
    div.onclick = () => {
      document.getElementById("room-code-input").value = g.id;
      document.getElementById("public-rooms-modal").classList.add("hidden");
      window.joinRoom();
    };
    list.appendChild(div);
  });
};

window.joinRoom = async () => {
  const roomId = document
    .getElementById("room-code-input")
    .value.toUpperCase()
    .trim();
  if (!roomId) return alert("Enter room code!");

  document.getElementById("lobby-status").textContent = "Connecting...";
  const result = await window.Network.joinGame(roomId);

  if (result.success) {
    state.myColor = result.color;
    state.roomId = roomId;
    if (result.isRejoin) console.log("Rejoined.");
    startGameUI(roomId);
  } else {
    alert("Error: " + result.reason);
    document.getElementById("lobby-status").textContent = "";
  }
};

window.copyRoomCode = () => {
  const code = state.roomId;
  if (!code) return;
  navigator.clipboard.writeText(code);
  alert("Room Code Copied: " + code);
};

// --- PROFILE & FRIENDS SYSTEM ---

window.openProfile = async () => {
  document.getElementById("profile-modal").classList.remove("hidden");
  switchTab("friends");

  // Load My Nickname
  const p = await window.Network.getUserProfile();
  if (p) {
    document.getElementById("my-nickname-input").value = p.nickname || "";
  }
};

window.saveNickname = async () => {
  const newNick = document.getElementById("my-nickname-input").value.trim();
  if (!newNick) return alert("Nickname cannot be empty");
  await window.Network.setNickname(newNick);
  document.getElementById("badge-nickname").textContent = newNick;
  alert("Nickname saved!");
};

window.switchTab = async (tabName) => {
  // UI Update
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.add("hidden"));
  document.getElementById("tab-" + tabName).classList.remove("hidden");

  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active"); // Basılan butonu aktif yap

  // Data Load
  if (tabName === "friends") loadFriends();
  if (tabName === "requests") loadRequests();
  if (tabName === "history") loadHistory();
};

async function loadFriends() {
  // getFriends yerine getFriendsDetailed kullanıyoruz
  const friends = await window.Network.getFriendsDetailed();
  const list = document.getElementById("friends-list");
  list.innerHTML = "";

  if (friends.length === 0) {
    list.innerHTML =
      "<div style='padding:10px; color:#aaa;'>No friends yet.</div>";
    return;
  }

  friends.forEach((f) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.style.cursor = "pointer";

    // DURUM HESAPLAMA
    let statusHtml =
      "<span style='color:#7f8c8d; font-size:11px;'>Offline</span>";
    if (f.status) {
      const timeDiff = Math.floor((Date.now() - f.status.timestamp) / 60000); // dakika
      if (f.status.state === "playing") {
        statusHtml = `<span style='color:#e74c3c; font-size:11px;'>Playing (${f.status.role}) - ${timeDiff}m</span>`;
      } else if (f.status.state === "waiting") {
        statusHtml = `<span style='color:#f1c40f; font-size:11px;'>Waiting (${f.status.role})</span>`;
      } else if (f.status.state === "online") {
        statusHtml = `<span style='color:#2ecc71; font-size:11px;'>Online</span>`;
      }
    }

    div.innerHTML = `
            <div>
                <div style="font-weight:bold; color:white;">${f.nickname || f.email.split("@")[0]}</div>
                ${statusHtml}
            </div>
            <div style="font-size:20px;">ℹ️</div>
        `;

    // Tıklayınca Detay Kartı Aç
    div.onclick = () => openFriendDetail(f);
    list.appendChild(div);
  });
}

window.openFriendDetail = (f) => {
  document.getElementById("friend-detail-modal").classList.remove("hidden");
  document.getElementById("fd-nickname").textContent = f.nickname || "Unknown";
  document.getElementById("fd-email").textContent = f.email;
  document.getElementById("fd-wins").textContent = f.wins || 0;
  document.getElementById("fd-score").textContent = f.score || 1000;

  const statusDiv = document.getElementById("fd-status");
  if (f.status && f.status.state === "playing") {
    statusDiv.innerHTML = `Currently playing in a match.<br><span style="color:#e74c3c">Busy</span>`;
  } else if (f.status && f.status.state === "online") {
    statusDiv.innerHTML = `Currently in lobby.<br><span style="color:#2ecc71">Available</span>`;
  } else {
    statusDiv.innerHTML = `Offline or Unknown.`;
  }

  const actionsDiv = document.getElementById("fd-actions");
  actionsDiv.innerHTML = "";

  // Eğer ben bir odadaysam ve arkadaş online ise Invite butonu koy
  if (state.roomId && f.status && f.status.state === "online") {
    actionsDiv.innerHTML += `<button onclick="window.Network.inviteFriend('${f.uid}', '${state.roomId}'); alert('Invite Sent!');" class="btn btn-success" style="width:100%; margin-bottom:10px;">INVITE TO GAME</button>`;
  }

  actionsDiv.innerHTML += `<button onclick="window.Network.removeFriend('${f.uid}'); document.getElementById('friend-detail-modal').classList.add('hidden'); openProfile();" class="btn" style="background:#c0392b; width:100%;">REMOVE FRIEND</button>`;
};

async function loadRequests() {
  const reqs = await window.Network.getFriendRequests();
  const list = document.getElementById("requests-list");
  list.innerHTML = "";

  if (reqs.length === 0) {
    list.innerHTML =
      "<div style='padding:10px; color:#aaa;'>No pending requests.</div>";
    return;
  }

  reqs.forEach((r) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
            <span>${r.email}</span>
            <div>
                <button onclick="window.Network.respondToFriendRequest('${r.uid}', true); loadRequests();" class="btn btn-success" style="font-size:10px; padding:5px;">✔</button>
                <button onclick="window.Network.respondToFriendRequest('${r.uid}', false); loadRequests();" class="btn" style="background:#c0392b; font-size:10px; padding:5px;">✖</button>
            </div>`;
    list.appendChild(div);
  });
}

async function loadHistory() {
  const history = await window.Network.getUserHistory();
  const list = document.getElementById("match-history-list");
  list.innerHTML = "";

  // Stats Update
  const p = await window.Network.getUserProfile();
  if (p) {
    document.getElementById("stat-wins").textContent = p.wins;
    document.getElementById("stat-losses").textContent = p.losses;
    document.getElementById("stat-score").textContent = p.score;
  }

  if (history.length === 0) {
    list.innerHTML =
      "<div style='padding:10px; color:#aaa;'>No matches played.</div>";
    return;
  }

  history.forEach((h) => {
    const resultColor = h.result === "WIN" ? "#2ecc71" : "#e74c3c";
    list.innerHTML += `
            <div class="list-item" style="border-left:3px solid ${resultColor}">
                <span>${new Date(h.date).toLocaleDateString()}</span>
                <span>${h.result}</span>
                <span>${h.scoreChange}</span>
            </div>`;
  });
}

window.sendFriendRequestUI = async () => {
  const email = document.getElementById("friend-email-input").value;
  const msg = document.getElementById("friend-req-msg");
  if (!email) return;

  msg.textContent = "Sending...";
  const res = await window.Network.sendFriendRequest(email);
  if (res.success) {
    msg.textContent = "Request Sent!";
    msg.style.color = "#2ecc71";
    document.getElementById("friend-email-input").value = "";
  } else {
    msg.textContent = res.error;
    msg.style.color = "#e74c3c";
  }
};

window.closeProfile = () => {
  document.getElementById("profile-modal").classList.add("hidden");
};

// --- AUTH UI ---
window.doGoogleLogin = async () => window.Network.loginGoogle();
window.doLogin = async () => {
  const r = await window.Network.login(
    document.getElementById("login-email").value,
    document.getElementById("login-pass").value,
  );
  if (!r.success) alert(r.error);
};
window.doRegister = async () => {
  const r = await window.Network.register(
    document.getElementById("reg-email").value,
    document.getElementById("reg-pass").value,
  );
  if (r.success) alert("Registered! You can login now.");
  else alert(r.error);
};
window.toggleAuth = (mode) => {
  if (mode === "register") {
    document.getElementById("login-form").classList.add("hidden");
    document.getElementById("register-form").classList.remove("hidden");
  } else {
    document.getElementById("register-form").classList.add("hidden");
    document.getElementById("login-form").classList.remove("hidden");
  }
};
window.doLogout = () => {
  window.Network.logout();
  location.reload();
};

// --- GAME LOGIC (UNCHANGED MOSTLY) ---
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

function startGameUI(roomId) {
  document.getElementById("lobby-screen").classList.add("hidden");
  document.getElementById("room-info").classList.remove("hidden");
  document.getElementById("ui-panel").classList.remove("hidden");
  document.getElementById("game-container").classList.remove("hidden");
  document.getElementById("display-room-id").textContent = roomId;
  document.getElementById("my-role").textContent =
    state.myColor === "white" ? "WHITE" : "BLACK";

  const myVoiceId = `${roomId}_${state.myColor}`;
  window.Voice.init(myVoiceId).then(() =>
    window.Network.savePeerId(roomId, state.myColor, myVoiceId),
  );
  initGame();
}

window.setMyReady = () => {
  document.getElementById("btn-set-ready").disabled = true;
  document.getElementById("btn-set-ready").textContent = "Waiting...";
  window.Network.setReady(state.roomId, state.myColor);
};
window.leaveRoom = async () => {
  if (!confirm("Leave game?")) return;
  await window.Network.leaveGame(state.roomId, state.myColor);
  location.reload();
};

function initGame() {
  state.pieces = CONFIG.INITIAL_SETUP.map((d) => new Piece(d.t, d.c, d.x, d.y));
  window.Network.listenGame(state.roomId, (d) => handleServerUpdate(d));
  gameLoop();
}

let lastProcessedMove = null;
function handleServerUpdate(data) {
  if (!data) return;
  // Ready UI
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

  if (state.myColor === "white" && data.peerBlack && !window.Voice.call)
    window.Voice.connectToPeer(data.peerBlack);

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

function updateStatusText() {
  statusDiv.textContent =
    state.turn === state.myColor ? "YOUR TURN" : "OPPONENT'S TURN";
  statusDiv.style.background =
    state.turn === state.myColor ? "#27ae60" : "#c0392b";
}

function startTimer() {
  if (state.interval) clearInterval(state.interval);
  state.interval = setInterval(() => {
    if (!state.gameStarted || state.gameOver) return;
    state.timers[state.turn]--;
    formatTime("timer-white", state.timers.white);
    formatTime("timer-black", state.timers.black);
    if (state.timers[state.turn] <= 0)
      endGame(state.turn === "white" ? "black" : "white", "Time Up");
  }, 1000);
}
function formatTime(id, s) {
  document.getElementById(id).textContent = `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

// --- GAME LOOP & INPUT (Shortened for brevity but logic is same) ---
function gameLoop() {
  const now = Date.now();
  renderer.setPerspective(state.myColor || "white");
  renderer.clear();
  renderer.drawBoard();
  if (state.hoverSquare)
    renderer.drawPulseSquare(
      state.hoverSquare,
      CONFIG.THEME.COLOR_HOVER,
      now,
      "hover",
    );
  state.legalMoves.forEach((m) =>
    renderer.drawPulseSquare(
      m,
      m.isCapture ? CONFIG.THEME.COLOR_CAPTURE : CONFIG.THEME.COLOR_VALID,
      now,
      "move",
    ),
  );
  if (state.errorSquare)
    renderer.drawSolidSquare(
      state.errorSquare,
      CONFIG.THEME.COLOR_INVALID,
      0.6,
    );

  let kPos = null;
  if (GameLogic.isKingInCheck(state.turn, state.pieces)) {
    const k = state.pieces.find(
      (p) =>
        (p.type === "king" || p.type === "prince") && p.color === state.turn,
    );
    if (k) kPos = { x: k.x, y: k.y };
  }
  renderer.drawHighlights(state.selectedPiece, kPos);
  state.pieces.forEach((p) => renderer.drawPiece(p));
  requestAnimationFrame(gameLoop);
}

// Input Handlers (Coordinates & Clicks)
function getLogicalPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX || evt.touches[0].clientX) - rect.left;
  const y = (evt.clientY || evt.touches[0].clientY) - rect.top;
  const sc = canvas.width / rect.width;
  let col = Math.floor(
    (x * sc - CONFIG.BOARD.OFFSET_X) / CONFIG.BOARD.TILE_SIZE,
  );
  let row = Math.floor(
    (y * sc - CONFIG.BOARD.OFFSET_Y) / CONFIG.BOARD.TILE_SIZE,
  );
  if (state.myColor === "black") {
    col = CONFIG.BOARD.COLS - 1 - col;
    row = CONFIG.BOARD.ROWS - 1 - row;
  }
  return { col, row };
}
canvas.addEventListener("mousemove", (e) => {
  const p = getLogicalPos(e);
  if (
    (p.col >= 0 &&
      p.col < CONFIG.BOARD.COLS &&
      p.row >= 0 &&
      p.row < CONFIG.BOARD.ROWS) ||
    (p.col === -1 && p.row === 2) ||
    (p.col === 11 && p.row === 7)
  )
    state.hoverSquare = { x: p.col, y: p.row };
  else state.hoverSquare = null;
});
canvas.addEventListener("click", (e) => {
  if (state.gameOver || !state.gameStarted || state.turn !== state.myColor)
    return;
  const p = getLogicalPos(e);
  const move = state.legalMoves.find((m) => m.x === p.col && m.y === p.row);
  if (state.selectedPiece && move) {
    executeMove(move);
    return;
  }
  const clicked = state.pieces.find(
    (piece) => piece.x === p.col && piece.y === p.row,
  );
  if (state.selectedPiece === clicked) {
    state.selectedPiece = null;
    state.legalMoves = [];
    return;
  }
  if (clicked && clicked.color === state.myColor) {
    state.selectedPiece = clicked;
    state.legalMoves = GameLogic.getLegalMoves(clicked, state.pieces);
    state.errorSquare = null;
  } else if (state.selectedPiece) {
    state.errorSquare = { x: p.col, y: p.row, time: Date.now() };
  }
});

function executeMove(move) {
  const from = { x: state.selectedPiece.x, y: state.selectedPiece.y };
  const targetIdx = state.pieces.findIndex(
    (p) => p.x === move.x && p.y === move.y,
  );
  if (targetIdx !== -1) state.pieces.splice(targetIdx, 1);
  state.selectedPiece.x = move.x;
  state.selectedPiece.y = move.y;
  const promo = GameLogic.checkPromotion(state.selectedPiece);
  if (promo) state.selectedPiece.type = promo;
  state.selectedPiece = null;
  state.legalMoves = [];
  window.Network.sendMove(
    state.roomId,
    { from, to: move },
    state.turn === "white" ? "black" : "white",
  );
  checkGameState();
}
function checkGameState() {
  const myP = state.pieces.filter((p) => p.color === state.turn);
  if (!myP.some((p) => GameLogic.getLegalMoves(p, state.pieces).length > 0)) {
    if (GameLogic.isKingInCheck(state.turn, state.pieces))
      endGame(state.turn === "white" ? "black" : "white", "CHECKMATE");
    else endGame("draw", "STALEMATE");
  }
}
function endGame(winner, reason) {
  state.gameOver = true;
  clearInterval(state.interval);
  if (state.gameStarted)
    window.Network.recordGameResult(
      winner === state.myColor,
      "Online Opponent",
    );
  statusDiv.textContent = `GAME OVER: ${reason}`;
}
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    canvas.dispatchEvent(
      new MouseEvent("click", {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
      }),
    );
  },
  { passive: false },
);
