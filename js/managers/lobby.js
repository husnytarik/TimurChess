window.createRoom = async () => {
  const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
  const isPublic =
    document.querySelector('input[name="roomType"]:checked').value === "public";

  document.getElementById("lobby-status").textContent = "Creating room...";
  const assignedColor = await window.Network.createGame(roomId, isPublic);

  if (assignedColor) {
    window.state.myColor = assignedColor;
    window.state.roomId = roomId;
    window.startGameUI(roomId);
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
    window.state.myColor = result.color;
    window.state.roomId = roomId;
    if (result.isRejoin) console.log("Rejoined.");
    window.startGameUI(roomId);
  } else {
    alert("Error: " + result.reason);
    document.getElementById("lobby-status").textContent = "";
  }
};

window.copyRoomCode = () => {
  const code = window.state.roomId;
  if (!code) return;
  navigator.clipboard.writeText(code);
  alert("Room Code Copied: " + code);
};
