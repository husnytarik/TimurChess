window.openProfile = async () => {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;
  modal.classList.remove("hidden");

  try {
    const p = await window.Network.getUserProfile();
    if (p) {
      document.getElementById("my-nickname-input").value = p.nickname || "";
      const idLabel = document.getElementById("my-friend-id");
      // FriendID yoksa (eski hesapsa), sayfayı yenileyince initAuth oluşturacak.
      if (idLabel) idLabel.textContent = `ID: ${p.friendId || "Reload Page"}`;
    }
  } catch (e) {
    console.error(e);
  }
  window.switchTab("friends");
};

window.closeProfile = () => {
  document.getElementById("profile-modal").classList.add("hidden");
};

window.switchTab = (tabName) => {
  document.getElementById("tab-friends").classList.add("hidden");
  document.getElementById("tab-requests").classList.add("hidden");
  document.getElementById("tab-history").classList.add("hidden");
  const selectedContent = document.getElementById(`tab-${tabName}`);
  if (selectedContent) selectedContent.classList.remove("hidden");

  const buttons = document.querySelectorAll(".profile-tabs .tab-btn");
  buttons.forEach((btn) => {
    if (btn.getAttribute("onclick").includes(tabName))
      btn.classList.add("active");
    else btn.classList.remove("active");
  });

  if (tabName === "friends") window.loadFriends();
  else if (tabName === "requests") window.loadRequests();
  else if (tabName === "history") window.loadHistory();
};

window.saveNickname = async () => {
  const input = document.getElementById("my-nickname-input");
  const name = input.value.trim();
  if (!name) return alert("Please enter a nickname.");
  await window.Network.updateProfile({ nickname: name });
  document.getElementById("badge-nickname").textContent = name;
  document.getElementById("badge-nickname-game").textContent = name;
  alert("Saved!");
};

window.sendFriendRequestUI = async () => {
  const input = document.getElementById("friend-email-input");
  const msgDiv = document.getElementById("friend-req-msg");
  const val = input.value.trim();

  msgDiv.textContent = "";
  if (!val) {
    msgDiv.textContent = "Enter ID or Email";
    msgDiv.style.color = "#e74c3c";
    return;
  }

  msgDiv.textContent = "Sending...";
  try {
    const result = await window.Network.sendFriendRequest(val);
    if (result.success) {
      msgDiv.textContent = "Request Sent!";
      msgDiv.style.color = "#2ecc71";
      input.value = "";
    } else {
      msgDiv.textContent = result.error || "Not found.";
      msgDiv.style.color = "#e74c3c";
    }
  } catch (err) {
    console.error(err);
    msgDiv.textContent = "Error.";
    msgDiv.style.color = "#e74c3c";
  }
};

window.loadFriends = async () => {
  const list = document.getElementById("friends-list");
  list.innerHTML =
    "<div style='text-align:center; padding:10px;'>Loading...</div>";
  try {
    const friends = await window.Network.getFriendsDetailed();
    list.innerHTML = "";
    if (!friends || friends.length === 0) {
      list.innerHTML =
        "<div style='text-align:center; padding:10px; color:#95a5a6;'>No friends yet.</div>";
      return;
    }

    friends.forEach((f) => {
      const item = document.createElement("div");
      item.className = "list-item friend-item";

      let statusHtml =
        "<span style='color:#95a5a6; font-size:11px;'>Offline</span>";
      let inviteBtnHtml = "";

      if (f.status) {
        const color =
          f.status.state === "playing"
            ? "#e74c3c"
            : f.status.state === "online"
              ? "#2ecc71"
              : "#f1c40f";
        statusHtml = `<span style='color:${color}; font-size:11px; font-weight:bold;'>${f.status.state ? f.status.state.toUpperCase() : "UNKNOWN"}</span>`;
      }

      // Davet Butonu (Eğer bir odadaysak HER ZAMAN göster)
      if (window.state && window.state.roomId && !window.state.isVsComputer) {
        inviteBtnHtml = `<button class="btn-success" style="padding:4px 8px; font-size:10px;" onclick="window.inviteUser('${f.uid}')">INVITE</button>`;
      }

      item.innerHTML = `
                <div class="friend-info" onclick="window.openFriendDetail('${f.uid}')">
                    <div class="friend-name">${f.nickname} <span style="color:#7f8c8d; font-size:10px;">#${f.friendId || "..."}</span></div>
                    <div class="friend-status">${statusHtml}</div>
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    ${inviteBtnHtml}
                    <div onclick="window.openFriendDetail('${f.uid}')" style="color:#7f8c8d; font-size:18px; cursor:pointer;">›</div>
                </div>
            `;
      // Modal için f'i sakla
      item.onclick = (e) => {
        if (e.target.tagName !== "BUTTON") window.openFriendDetailModal(f);
      };

      list.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "Error loading friends.";
  }
};

window.inviteUser = async (uid) => {
  if (!window.state.roomId) return;
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = "...";
  btn.disabled = true;
  try {
    await window.Network.sendInvite(uid, window.state.roomId);
    btn.textContent = "SENT";
    btn.style.background = "#7f8c8d";
  } catch (e) {
    btn.textContent = "FAIL";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  }
};

window.loadRequests = async () => {
  const list = document.getElementById("requests-list");
  list.innerHTML = "Loading...";
  const requests = await window.Network.getFriendRequests();
  list.innerHTML = "";
  if (!requests || requests.length === 0) {
    list.innerHTML =
      "<div style='padding:10px; text-align:center; color:#95a5a6;'>No requests.</div>";
    return;
  }
  requests.forEach((req) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.innerHTML = `
            <span style="font-size:13px;">${req.nickname}</span>
            <div>
                <button class="btn-icon-small" style="background:#2ecc71; border:none; margin-right:5px;" onclick="window.respondToRequestUI('${req.uid}', true)"><i class="fa-solid fa-check"></i></button>
                <button class="btn-icon-small" style="background:#e74c3c; border:none;" onclick="window.respondToRequestUI('${req.uid}', false)"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
    list.appendChild(item);
  });
};
window.respondToRequestUI = async (uid, accept) => {
  await window.Network.respondToFriendRequest(uid, accept);
  window.loadRequests();
  if (accept) window.loadFriends();
};

window.loadHistory = async () => {
  const list = document.getElementById("match-history-list");
  list.innerHTML = "Loading...";
  const p = await window.Network.getUserProfile();
  if (p) {
    document.getElementById("stat-wins").textContent = p.wins || 0;
    document.getElementById("stat-losses").textContent = p.losses || 0;
    document.getElementById("stat-score").textContent = p.score || 1000;
  }
  const history = await window.Network.getUserHistory();
  list.innerHTML = "";
  if (!history || history.length === 0) {
    list.innerHTML =
      "<div style='padding:10px; text-align:center; color:#95a5a6;'>No history.</div>";
    return;
  }
  history.forEach((h) => {
    const isWin = h.result === "WIN";
    const color = isWin ? "#2ecc71" : "#e74c3c";
    const item = document.createElement("div");
    item.className = "history-item";
    item.style.borderLeft = `4px solid ${color}`;
    item.innerHTML = `<span style="color:#bdc3c7; font-size:11px;">${new Date(h.date).toLocaleDateString()}</span><span style="font-weight:bold; color:${color}">${h.result}</span><span style="font-weight:bold; color:#fff;">${h.scoreChange > 0 ? "+" : ""}${h.scoreChange}</span>`;
    list.appendChild(item);
  });
};

window.openFriendDetailModal = (f) => {
  const modal = document.getElementById("friend-detail-modal");
  modal.classList.remove("hidden");
  document.getElementById("fd-nickname").textContent = f.nickname;
  document.getElementById("fd-email").textContent = `#${f.friendId || "..."}`;
  document.getElementById("fd-wins").textContent = f.wins || 0;
  document.getElementById("fd-losses").textContent = f.losses || 0;
  document.getElementById("fd-score").textContent = f.score || 1000;
  const statusDiv = document.getElementById("fd-status");
  if (f.status) {
    const color =
      f.status.state === "playing"
        ? "#e74c3c"
        : f.status.state === "online"
          ? "#2ecc71"
          : "#f1c40f";
    statusDiv.innerHTML = `Currently: <b style="color:${color}">${f.status.state ? f.status.state.toUpperCase() : "UNKNOWN"}</b>`;
  } else
    statusDiv.innerHTML = `Currently: <b style="color:#95a5a6">OFFLINE</b>`;

  const actionsDiv = document.getElementById("fd-actions");
  actionsDiv.innerHTML = "";
  if (window.state && window.state.roomId && !window.state.isVsComputer) {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.style.width = "100%";
    btn.textContent = "Invite to Game";
    btn.onclick = async () => {
      btn.textContent = "Sending...";
      await window.Network.sendInvite(f.uid, window.state.roomId);
      btn.textContent = "Invite Sent!";
      btn.disabled = true;
    };
    actionsDiv.appendChild(btn);
  }
};
