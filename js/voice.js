class VoiceManager {
  constructor() {
    this.peer = null;
    this.myStream = null;
    this.call = null;
    this.isMicOn = true;
    this.connectionStatus = "disconnected";
    this.audioContext = null; // PC ses motoru için gerekli
  }

  init(myId) {
    // 1. PC İÇİN KRİTİK: AudioContext'i Hazırla
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
        this.updateStatus("Bekleniyor... (PC Hazır)");

        // 2. PC İÇİN İYİLEŞTİRME: Yankı İptali ve Gürültü Engelleyici Açık
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

            // Mikrofonun çalıştığını konsola yaz (Debug)
            this.checkAudioLevel(stream);

            resolve();
          })
          .catch((err) => {
            console.error("Mic Fail:", err);
            this.updateStatus("Mikrofon Bulunamadı (İzin Verin)");
            reject(err);
          });
      });

      this.peer.on("call", (incomingCall) => {
        this.updateStatus("Bağlanıyor...");
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

    // PC Bağlantı Kontrolü
    if (call.peerConnection) {
      call.peerConnection.oniceconnectionstatechange = () => {
        const state = call.peerConnection.iceConnectionState;
        console.log("ICE State:", state);
        if (state === "failed" || state === "disconnected") {
          this.updateStatus("Bağlantı Engellendi (Firewall)");
        }
      };
    }

    call.on("stream", (remoteStream) => {
      console.log("Stream Geldi!");
      this.updateStatus("BAĞLANDI 🔊");
      this.playAudio(remoteStream);
    });

    call.on("close", () => {
      this.removeAudioPlayer();
      this.call = null;
    });
  }

  playAudio(stream) {
    // 3. PC İÇİN KRİTİK: Tarayıcı Ses Motorunu Zorla Başlat
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    this.removeAudioPlayer();

    const audio = document.createElement("audio");
    audio.id = "remote-audio";
    audio.srcObject = stream;

    audio.controls = true;
    audio.autoplay = true;
    audio.playsInline = true;

    // Sağ alt köşeye yerleştir
    audio.style.position = "fixed";
    audio.style.bottom = "10px";
    audio.style.right = "10px";
    audio.style.zIndex = "9999";
    audio.style.width = "250px";
    audio.style.height = "40px"; // Mobilde çok yer kaplamasın

    document.body.appendChild(audio);

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // PC'de autoplay engellendiyse kullanıcıyı uyar
        this.updateStatus("SES İÇİN TIKLA 👉");

        // Sayfaya ilk tıklamada sesi aç
        const unlockAudio = () => {
          audio.play();
          if (this.audioContext.state === "suspended")
            this.audioContext.resume();
          this.updateStatus("BAĞLANDI 🔊");
          document.body.removeEventListener("click", unlockAudio);
          document.body.removeEventListener("touchstart", unlockAudio);
        };

        document.body.addEventListener("click", unlockAudio);
        document.body.addEventListener("touchstart", unlockAudio);
      });
    }
  }

  // Debug: PC Mikrofonunun ses aldığını doğrulamak için
  checkAudioLevel(stream) {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    javascriptNode.onaudioprocess = () => {
      const array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      let values = 0;
      const length = array.length;
      for (let i = 0; i < length; i++) {
        values += array[i];
      }
      const average = values / length;

      // Eğer ses seviyesi yüksekse konsola yaz (Sadece test için)
      if (average > 10) {
        // console.log("Mikrofon Ses Alıyor: " + average);
      }
    };
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
