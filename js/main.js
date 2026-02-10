window.addEventListener("load", () => {
  window.Network.initAuth(
    async (user) => {
      document.getElementById("auth-screen").classList.add("hidden");
      document.getElementById("lobby-screen").classList.remove("hidden");

      // Profil Bilgisi
      const p = await window.Network.getUserProfile();
      document.getElementById("badge-nickname").textContent =
        (p && p.nickname) || user.email.split("@")[0];
      document.getElementById("badge-score").textContent =
        "Score: " + ((p && p.score) || 1000);

      // URL ile Oda Katılımı
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
// Global: Davet Popup Göster
window.showInvitePopup = (invite, inviteKey) => {
  const popup = document.getElementById("invite-popup");
  const msg = document.getElementById("invite-msg");
  const btn = document.getElementById("btn-accept-invite");

  msg.textContent = `${invite.fromName} invited you to a game!`;
  popup.classList.remove("hidden");

  // Ses çal (Opsiyonel)
  // const audio = new Audio('notify.mp3'); audio.play();

  btn.onclick = async () => {
    btn.textContent = "Joining...";
    // Odaya gir
    document.getElementById("room-code-input").value = invite.roomId;
    await window.joinRoom();

    // Daveti sil ve popup'ı kapat
    popup.classList.add("hidden");
    window.Network.removeInvite(inviteKey);
  };

  // 10 saniye sonra otomatik kapan
  setTimeout(() => {
    popup.classList.add("hidden");
  }, 10000);
};
