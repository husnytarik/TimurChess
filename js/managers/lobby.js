window.createRoom = async () => {
  const isPrivate =
    document.querySelector('input[name="roomType"]:checked').value ===
    "private";
  const btn = document.querySelector(".lobby-box .btn-primary");
  btn.disabled = true;
  btn.textContent = "Creating...";

  // 1. Odayı oluştur ve ID'yi al
  const roomId = await window.Network.createGame(null, !isPrivate);

  btn.disabled = false;
  btn.textContent = "Create Room";

  if (roomId) {
    window.state.isVsComputer = false;
    window.state.myColor = "white";
    window.state.roomId = roomId; // ID'yi state'e kaydet

    // 2. Oyunu başlat ve ID'yi göster
    window.startGameUI(roomId);
  } else {
    alert("Error creating room. Try refreshing.");
  }
};

window.joinRoom = async () => {
  const input = document.getElementById("room-code-input");
  const roomId = input.value.trim().toUpperCase();
  if (!roomId) return alert("Enter Room Code");

  const btn = document.querySelector(".join-container .btn-success");
  btn.disabled = true;
  btn.textContent = "...";

  const res = await window.Network.joinGame(roomId);

  btn.disabled = false;
  btn.textContent = "Join";

  if (res.success) {
    window.state.isVsComputer = false;
    window.state.myColor = res.color;
    window.state.roomId = roomId;
    window.startGameUI(roomId);
  } else {
    alert("Error: " + res.reason);
  }
};

window.startBotGame = () => {
  const diff = document.getElementById("bot-difficulty").value;
  window.state.isVsComputer = true;
  window.state.myColor = "white";
  window.state.roomId = "BOT-MATCH";
  window.state.gameStarted = true;
  window.state.isReady = true;

  if (window.Bot && window.Bot.init) {
    window.Bot.init(diff);
  }
  window.startGameUI("Bot Game");
};

window.showPublicRooms = async () => {
  const modal = document.getElementById("public-rooms-modal");
  const list = document.getElementById("public-rooms-list");
  modal.classList.remove("hidden");
  list.innerHTML = "Loading...";

  const rooms = await window.Network.getPublicGames();
  list.innerHTML = "";

  if (rooms.length === 0) {
    list.innerHTML =
      "<div style='padding:10px; text-align:center; color:#95a5a6'>No public rooms found.</div>";
    return;
  }

  rooms.forEach((r) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.cursor = "pointer";
    item.innerHTML = `
            <div>
                <span style="font-weight:bold; color:#f1c40f">${r.id}</span>
                <span style="color:#bdc3c7; font-size:12px; margin-left:10px;">Host: ${r.whiteName || "Unknown"}</span>
            </div>
            <button class="btn-success" style="padding:5px 10px; font-size:12px;">JOIN</button>
        `;
    item.onclick = () => {
      document.getElementById("room-code-input").value = r.id;
      modal.classList.add("hidden");
      window.joinRoom();
    };
    list.appendChild(item);
  });
};
