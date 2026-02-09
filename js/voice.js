class VoiceManager {
  constructor() {
    this.peer = null;
    this.myStream = null;
    this.call = null;
    this.isMicOn = true;
    this.connectionStatus = "disconnected";
    // AudioContext'i hemen oluşturma, init'te oluştur (Tarayıcı politikası)
    this.audioContext = null;
  }

  init(myId) {
    // 1. AudioContext Hazırlığı
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();

    return new Promise((resolve, reject) => {
      const peerConfig = {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        },
        debug: 1,
      };

      this.peer = new Peer(myId, peerConfig);

      this.peer.on("open", (id) => {
        console.log("My Peer ID:", id);
        this.updateStatus("Hazır");

        // 2. Yankı İptali ve Gürültü Engelleyici
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        };

        navigator.mediaDevices
          .getUserMedia(constraints)
          .then((stream) => {
            this.myStream = stream;
            this.setMicStatus(true);
            resolve();
          })
          .catch((err) => {
            console.error("Mic Fail:", err);
            this.updateStatus("Mikrofon Yok");
            reject(err);
          });
      });

      this.peer.on("call", (incomingCall) => {
        this.updateStatus("Bağlanıyor...");
        incomingCall.answer(this.myStream);
        this.handleCallStream(incomingCall);
      });

      this.peer.on("error", (err) => {
        console.error("Peer Error:", err);
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

    if (call.peerConnection) {
      call.peerConnection.oniceconnectionstatechange = () => {
        const state = call.peerConnection.iceConnectionState;
        if (state === "failed" || state === "disconnected") {
          this.updateStatus("Koptu");
          this.call = null;
        }
      };
    }

    call.on("stream", (remoteStream) => {
      console.log("Ses Akışı Geldi!");
      this.updateStatus("BAĞLANDI 🔊");
      this.playAudio(remoteStream);
    });

    call.on("close", () => {
      this.removeAudioPlayer();
      this.call = null;
      this.updateStatus("Sonlandı");
    });
  }

  playAudio(stream) {
    // Tarayıcı Ses Motorunu Canlandır
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    this.removeAudioPlayer();

    const audio = document.createElement("audio");
    audio.id = "remote-audio";
    audio.srcObject = stream;
    // audio.controls = true; // Ekranda player görünmesin istersen bunu kapat
    audio.autoplay = true;
    audio.playsInline = true;

    // Gizli ama çalışır vaziyette ekle
    audio.style.display = "none";
    document.body.appendChild(audio);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.updateStatus("SES İÇİN DOKUN 👉");

        // Kullanıcı etkileşimi bekle
        const unlockAudio = () => {
          audio.play();
          if (this.audioContext && this.audioContext.state === "suspended") {
            this.audioContext.resume();
          }
          this.updateStatus("BAĞLANDI 🔊");
          document.body.removeEventListener("click", unlockAudio);
          document.body.removeEventListener("touchstart", unlockAudio);
        };

        document.body.addEventListener("click", unlockAudio);
        document.body.addEventListener("touchstart", unlockAudio);
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
    // UI Paneldeki durum yazısını güncelleme (İsteğe bağlı)
    // const statusDiv = document.getElementById("status");
    // if (statusDiv) statusDiv.innerText = msg;
    console.log("[VOICE]:", msg);
  }
}

// Global olarak başlat
window.Voice = new VoiceManager();

// HTML onclick için global fonksiyon
window.toggleMic = function () {
  const isOpen = window.Voice.toggleMic();
  const btn = document.getElementById("voice-indicator");
  if (btn) {
    if (isOpen) {
      btn.classList.add("active");
      // SVG: Mic On
      btn.innerHTML = `<svg class="svg-icon"><use href="#icon-mic"></use></svg>`;
    } else {
      btn.classList.remove("active");
      // SVG: Mic Off
      btn.innerHTML = `<svg class="svg-icon"><use href="#icon-mic-off"></use></svg>`;
    }
  }
};
