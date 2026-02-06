class VoiceManager {
  constructor() {
    this.peer = null;
    this.myStream = null;
    this.call = null;
    this.isMicOn = true; // TEST İÇİN: Başlangıçta AÇIK olsun
    this.connectionStatus = "disconnected";
  }

  init(myId) {
    return new Promise((resolve, reject) => {
      // 1. DAHA GÜÇLÜ SUNUCU LİSTESİ (Bağlantı şansını artırır)
      const peerConfig = {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        },
        debug: 2,
      };

      this.peer = new Peer(myId, peerConfig);

      this.peer.on("open", (id) => {
        console.log("My Peer ID:", id);
        this.updateStatus("Hazır. Rakip Bekleniyor...");

        navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then((stream) => {
            this.myStream = stream;
            // TEST: Mikrofonu direkt açıyoruz
            this.setMicStatus(true);
            resolve();
          })
          .catch((err) => {
            console.error("Mic Fail:", err);
            this.updateStatus("Mikrofon Hatası!");
            reject(err);
          });
      });

      this.peer.on("call", (incomingCall) => {
        this.updateStatus("Arama Geliyor...");
        incomingCall.answer(this.myStream);
        this.handleCallStream(incomingCall);
      });
    });
  }

  connectToPeer(remotePeerId) {
    if (!this.peer || !this.myStream || this.call) return;
    this.updateStatus("Aranıyor...");
    const outgoingCall = this.peer.call(remotePeerId, this.myStream);
    this.handleCallStream(outgoingCall);
  }

  handleCallStream(call) {
    this.call = call;

    // 2. BAĞLANTI DURUMUNU DETAYLI İZLE (ICE STATE)
    // Bu kısım sorunun nerede olduğunu bize söyleyecek
    if (call.peerConnection) {
      call.peerConnection.oniceconnectionstatechange = () => {
        const state = call.peerConnection.iceConnectionState;
        console.log("Bağlantı Durumu:", state);
        this.updateStatus("Durum: " + state.toUpperCase());

        if (state === "disconnected" || state === "failed") {
          this.updateStatus("Bağlantı Koptu/Engellendi ❌");
          this.removeAudioPlayer();
        }
      };
    }

    call.on("stream", (remoteStream) => {
      console.log("Stream Geldi!");
      this.playAudio(remoteStream);
    });

    call.on("close", () => {
      this.removeAudioPlayer();
      this.call = null;
    });
  }

  playAudio(stream) {
    this.removeAudioPlayer();

    const audio = document.createElement("audio");
    audio.id = "remote-audio";
    audio.srcObject = stream;

    // Oynatıcı Ayarları
    audio.controls = true;
    audio.autoplay = true;
    audio.playsInline = true;

    // Sağ altta görünsün
    audio.style.position = "fixed";
    audio.style.bottom = "20px";
    audio.style.right = "20px";
    audio.style.zIndex = "9999";
    audio.style.width = "300px";

    document.body.appendChild(audio);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.updateStatus("Sesi duymak için OYNAT'a bas ->");
      });
    }
  }

  removeAudioPlayer() {
    const existing = document.getElementById("remote-audio");
    if (existing) existing.remove();
  }

  toggleMic() {
    if (!this.myStream) return false;
    this.isMicOn = !this.isMicOn;
    this.setMicStatus(this.isMicOn);
    return this.isMicOn;
  }

  setMicStatus(isOpen) {
    if (this.myStream) {
      this.myStream
        .getAudioTracks()
        .forEach((track) => (track.enabled = isOpen));
    }
  }

  updateStatus(msg) {
    this.connectionStatus = msg;
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
      const currentText = statusDiv.innerText.split(" | ")[0];
      statusDiv.innerText = `${currentText} | 🔊 ${msg}`;
    }
  }
}

window.Voice = new VoiceManager();

window.toggleMic = function () {
  const isOpen = window.Voice.toggleMic();
  const btn = document.getElementById("mic-btn");
  if (isOpen) {
    btn.classList.add("active");
    btn.innerHTML = "🎙️";
    btn.style.backgroundColor = "#27ae60";
  } else {
    btn.classList.remove("active");
    btn.innerHTML = "🔇";
    btn.style.backgroundColor = "#c0392b";
  }
};
