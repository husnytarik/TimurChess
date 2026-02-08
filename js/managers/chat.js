window.sendChat = () => {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  window.Network.sendChatMessage(
    window.state.roomId,
    msg,
    window.state.nickname || "Player",
  );
  input.value = "";
};

window.handleChatKey = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    window.sendChat();
  }
};

window.renderChatMessages = (message) => {
  if (!message) return;

  // --- AYRIŞTIRMA MANTIĞI ---

  // EĞER SİSTEM MESAJIYSA -> LOG KUTUSUNA
  if (message.sender === "SYSTEM") {
    const logList = document.getElementById("log-list");
    const el = document.createElement("div");
    el.className = "log-item";
    // Mesajın başındaki [GAME] kısmını atıp daha temiz gösterelim
    const cleanText = message.text.replace("[GAME]", "").trim();

    // Saati ekleyelim
    const date = new Date(message.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

    el.innerHTML = `<span style="color:#7f8c8d; font-size:10px;">[${timeStr}]</span> ${cleanText}`;
    logList.appendChild(el);
    logList.scrollTop = logList.scrollHeight; // Otomatik kaydır
  }

  // EĞER NORMAL MESAJSA -> CHAT KUTUSUNA
  else {
    const chatDiv = document.getElementById("chat-messages");
    const el = document.createElement("div");
    const isMine = message.sender === (window.state.nickname || "Player");
    el.className = `chat-msg ${isMine ? "mine" : ""}`;
    el.innerHTML = `<b>${message.sender}:</b> ${message.text}`;
    chatDiv.appendChild(el);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }
};
