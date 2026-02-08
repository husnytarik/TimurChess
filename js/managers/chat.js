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

// Bu fonksiyon artık TEK BİR MESAJ alıyor ve ekliyor
window.renderChatMessages = (message) => {
  if (!message) return;
  const div = document.getElementById("chat-messages");

  // Önceki "tümünü silme" satırını (div.innerHTML = "") KALDIRDIK.

  const el = document.createElement("div");

  if (message.sender === "SYSTEM") {
    el.className = "chat-msg system";
    el.innerHTML = `<i>${message.text}</i>`;
    el.style.color = "#f39c12";
    el.style.fontSize = "11px";
    el.style.alignSelf = "center";
    el.style.background = "none";
  } else {
    const isMine = message.sender === (window.state.nickname || "Player");
    el.className = `chat-msg ${isMine ? "mine" : ""}`;
    el.innerHTML = `<b>${message.sender}:</b> ${message.text}`;
  }
  div.appendChild(el);

  div.scrollTop = div.scrollHeight; // Otomatik aşağı kaydır
};
