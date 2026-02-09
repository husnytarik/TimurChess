// --- PROFİL PENCERESİ YÖNETİMİ ---

// Profili Aç
window.openProfile = async () => {
  const modal = document.getElementById("profile-modal");
  if (!modal) return;

  modal.classList.remove("hidden");

  // Mevcut ismi getir
  const p = await window.Network.getUserProfile();
  if (p && p.nickname) {
    document.getElementById("my-nickname-input").value = p.nickname;
  }

  // Varsayılan olarak arkadaşlar sekmesini aç
  window.switchTab("friends");
};

// Profili Kapat
window.closeProfile = () => {
  document.getElementById("profile-modal").classList.add("hidden");
};

// Sekme Değiştirme (Friends - Requests - History)
window.switchTab = (tabName) => {
  // 1. Tüm içerikleri gizle
  document.getElementById("tab-friends").classList.add("hidden");
  document.getElementById("tab-requests").classList.add("hidden");
  document.getElementById("tab-history").classList.add("hidden");

  // 2. Seçileni göster
  const selectedContent = document.getElementById(`tab-${tabName}`);
  if (selectedContent) selectedContent.classList.remove("hidden");

  // 3. Buton aktifliğini güncelle
  const buttons = document.querySelectorAll(".profile-tabs .tab-btn");
  buttons.forEach((btn) => {
    if (btn.getAttribute("onclick").includes(tabName)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 4. Verileri Yükle
  if (tabName === "friends") window.loadFriends();
  else if (tabName === "requests") window.loadRequests();
  else if (tabName === "history") window.loadHistory();
};

// İsmi Kaydet
window.saveNickname = async () => {
  const input = document.getElementById("my-nickname-input");
  const name = input.value.trim();
  if (!name) return alert("Please enter a nickname.");

  await window.Network.updateProfile({ nickname: name });

  // UI Güncelle
  const badge = document.getElementById("badge-nickname");
  if (badge) badge.textContent = name;

  const gameBadge = document.getElementById("badge-nickname-game");
  if (gameBadge) gameBadge.textContent = name;

  alert("Nickname Saved!");
};

// --- ARKADAŞ EKLEME (DÜZELTİLDİ) ---
window.sendFriendRequestUI = async () => {
  const input = document.getElementById("friend-email-input");
  const msgDiv = document.getElementById("friend-req-msg");

  // Temizlik: Boşlukları sil ve küçük harfe çevir
  const email = input.value.trim().toLowerCase();

  // Mesajı sıfırla
  msgDiv.textContent = "";
  msgDiv.style.color = "#bdc3c7";

  if (!email) {
    msgDiv.textContent = "Please enter an email address.";
    msgDiv.style.color = "#e74c3c";
    return;
  }

  // Kendi kendine istek atmayı engelle
  const me = await window.Network.getUserProfile();
  if (me && me.email && me.email.toLowerCase() === email) {
    msgDiv.textContent = "You cannot add yourself!";
    msgDiv.style.color = "#e74c3c";
    return;
  }

  msgDiv.textContent = "Sending request...";

  try {
    const result = await window.Network.sendFriendRequest(email);

    if (result.success) {
      msgDiv.textContent = "Friend request sent successfully!";
      msgDiv.style.color = "#2ecc71"; // Yeşil
      input.value = "";
    } else {
      // Hata mesajını göster (User not found vb.)
      msgDiv.textContent = result.error || "User not found.";
      msgDiv.style.color = "#e74c3c";
    }
  } catch (err) {
    console.error(err);
    msgDiv.textContent = "Error sending request.";
    msgDiv.style.color = "#e74c3c";
  }
};

// --- ARKADAŞ LİSTESİ ---
window.loadFriends = async () => {
  const list = document.getElementById("friends-list");
  list.innerHTML =
    "<div style='text-align:center; color:#7f8c8d;'>Loading...</div>";

  const friends = await window.Network.getFriendsDetailed();
  list.innerHTML = "";

  if (!friends || friends.length === 0) {
    list.innerHTML =
      "<div style='text-align:center; padding:10px; color:#95a5a6;'>No friends added yet.</div>";
    return;
  }

  friends.forEach((f) => {
    const item = document.createElement("div");
    item.className = "list-item friend-item";
    item.style.cursor = "pointer";

    let statusHtml =
      "<span style='color:#95a5a6; font-size:11px;'>Offline</span>";
    if (f.status && f.status.state !== "offline") {
      const color =
        f.status.state === "playing"
          ? "#e74c3c"
          : f.status.state === "online"
            ? "#2ecc71"
            : "#f1c40f";
      statusHtml = `<span style='color:${color}; font-size:11px; font-weight:bold;'>${f.status.state.toUpperCase()}</span>`;
    }

    item.innerHTML = `
            <div class="friend-info">
                <div class="friend-name">${f.nickname || f.email}</div>
                <div class="friend-status">${statusHtml}</div>
            </div>
            <div style="color:#7f8c8d; font-size:18px;">›</div>
        `;

    item.onclick = () => window.openFriendDetail(f);
    list.appendChild(item);
  });
};

// --- İSTEKLER (REQUESTS) ---
window.loadRequests = async () => {
  const list = document.getElementById("requests-list");
  list.innerHTML = "Loading...";

  const requests = await window.Network.getFriendRequests();
  list.innerHTML = "";

  if (!requests || requests.length === 0) {
    list.innerHTML =
      "<div style='text-align:center; padding:10px; color:#95a5a6;'>No pending requests.</div>";
    return;
  }

  requests.forEach((req) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";

    item.innerHTML = `
            <span style="font-size:13px; color:white;">${req.fromEmail}</span>
            <div>
                <button class="btn-icon-small" style="background:#2ecc71; border:none; margin-right:5px;" onclick="window.respondToRequestUI('${req.uid}', true)">✔</button>
                <button class="btn-icon-small" style="background:#e74c3c; border:none;" onclick="window.respondToRequestUI('${req.uid}', false)">✖</button>
            </div>
        `;
    list.appendChild(item);
  });
};

window.respondToRequestUI = async (uid, accept) => {
  await window.Network.respondToFriendRequest(uid, accept);
  window.loadRequests();
  if (accept) window.loadFriends();
};

// --- GEÇMİŞ (HISTORY) ---
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
      "<div style='text-align:center; padding:10px; color:#95a5a6;'>No matches played.</div>";
    return;
  }

  history.forEach((h) => {
    const isWin = h.result === "WIN";
    const color = isWin ? "#2ecc71" : "#e74c3c";

    const item = document.createElement("div");
    item.className = "history-item";
    item.style.borderLeft = `4px solid ${color}`;

    item.innerHTML = `
            <span style="color:#bdc3c7; font-size:11px;">${new Date(h.date).toLocaleDateString()}</span>
            <span style="font-weight:bold; color:${color}">${h.result}</span>
            <span style="font-weight:bold; color:#fff;">${h.scoreChange > 0 ? "+" : ""}${h.scoreChange} pts</span>
        `;
    list.appendChild(item);
  });
};

// --- DETAY PENCERESİ ---
window.openFriendDetail = (f) => {
  const modal = document.getElementById("friend-detail-modal");
  modal.classList.remove("hidden");

  document.getElementById("fd-nickname").textContent = f.nickname || "Unknown";
  document.getElementById("fd-email").textContent = f.email;

  document.getElementById("fd-wins").textContent = f.wins || 0;
  document.getElementById("fd-losses").textContent = f.losses || 0;
  document.getElementById("fd-score").textContent = f.score || 1000;

  const statusDiv = document.getElementById("fd-status");
  if (f.status && f.status.state !== "offline") {
    const color = f.status.state === "playing" ? "#e74c3c" : "#2ecc71";
    statusDiv.innerHTML = `Currently: <b style="color:${color}">${f.status.state.toUpperCase()}</b>`;
  } else {
    statusDiv.innerHTML = `Currently: <b style="color:#95a5a6">OFFLINE</b>`;
  }

  const actionsDiv = document.getElementById("fd-actions");
  actionsDiv.innerHTML = "";

  if (
    window.state &&
    window.state.roomId &&
    f.status &&
    f.status.state !== "offline"
  ) {
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
