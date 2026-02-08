window.openProfile = async () => {
  document.getElementById("profile-modal").classList.remove("hidden");
  window.switchTab("friends");
  const p = await window.Network.getUserProfile();
  if (p) document.getElementById("my-nickname-input").value = p.nickname || "";
};

window.closeProfile = () => {
  document.getElementById("profile-modal").classList.add("hidden");
};

window.saveNickname = async () => {
  const newNick = document.getElementById("my-nickname-input").value.trim();
  if (!newNick) return alert("Nickname cannot be empty");
  await window.Network.setNickname(newNick);
  document.getElementById("badge-nickname").textContent = newNick;
  alert("Nickname saved!");
};

window.switchTab = async (tabName) => {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.add("hidden"));
  document.getElementById("tab-" + tabName).classList.remove("hidden");
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  if (tabName === "friends") loadFriends();
  if (tabName === "requests") loadRequests();
  if (tabName === "history") loadHistory();
};

async function loadFriends() {
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
    let statusHtml =
      "<span style='color:#7f8c8d; font-size:11px;'>Offline</span>";

    if (f.status) {
      const timeDiff = Math.floor((Date.now() - f.status.timestamp) / 60000);
      if (f.status.state === "playing")
        statusHtml = `<span style='color:#e74c3c; font-size:11px;'>Playing (${f.status.role}) - ${timeDiff}m</span>`;
      else if (f.status.state === "waiting")
        statusHtml = `<span style='color:#f1c40f; font-size:11px;'>Waiting (${f.status.role})</span>`;
      else if (f.status.state === "online")
        statusHtml = `<span style='color:#2ecc71; font-size:11px;'>Online</span>`;
    }

    div.innerHTML = `<div><div style="font-weight:bold; color:white;">${f.nickname || f.email.split("@")[0]}</div>${statusHtml}</div><div style="font-size:20px;">ℹ️</div>`;
    div.onclick = () => window.openFriendDetail(f);
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
  if (f.status && f.status.state === "playing")
    statusDiv.innerHTML = `Currently playing in a match.<br><span style="color:#e74c3c">Busy</span>`;
  else if (f.status && f.status.state === "online")
    statusDiv.innerHTML = `Currently in lobby.<br><span style="color:#2ecc71">Available</span>`;
  else statusDiv.innerHTML = `Offline or Unknown.`;

  const actionsDiv = document.getElementById("fd-actions");
  actionsDiv.innerHTML = "";

  if (window.state.roomId && f.status && f.status.state === "online") {
    actionsDiv.innerHTML += `<button onclick="window.Network.inviteFriend('${f.uid}', '${window.state.roomId}'); alert('Invite Sent!');" class="btn btn-success" style="width:100%; margin-bottom:10px;">INVITE TO GAME</button>`;
  }
  actionsDiv.innerHTML += `<button onclick="window.Network.removeFriend('${f.uid}'); document.getElementById('friend-detail-modal').classList.add('hidden'); window.openProfile();" class="btn" style="background:#c0392b; width:100%;">REMOVE FRIEND</button>`;
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
    div.innerHTML = `<span>${r.email}</span><div><button onclick="window.Network.respondToFriendRequest('${r.uid}', true); window.switchTab('requests');" class="btn btn-success" style="font-size:10px; padding:5px;">✔</button><button onclick="window.Network.respondToFriendRequest('${r.uid}', false); window.switchTab('requests');" class="btn" style="background:#c0392b; font-size:10px; padding:5px;">✖</button></div>`;
    list.appendChild(div);
  });
}

async function loadHistory() {
  const history = await window.Network.getUserHistory();
  const list = document.getElementById("match-history-list");
  list.innerHTML = "";
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
    list.innerHTML += `<div class="list-item" style="border-left:3px solid ${resultColor}"><span>${new Date(h.date).toLocaleDateString()}</span><span>${h.result}</span><span>${h.scoreChange}</span></div>`;
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
