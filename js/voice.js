class VoiceManager {
  constructor() {
    this.peer = null;
    this.myStream = null;
    this.call = null;
    this.isMicOn = false;
    this.connectionStatus = "disconnected";
  }

  init(myId) {
    return new Promise((resolve, reject) => {
      const peerConfig = {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        },
        debug: 2,
      };

      this.peer = new Peer(myId, peerConfig);

      this.peer.on("open", (id) => {
        console.log("PeerJS Connected:", id);
        this.updateStatus("Waiting for connection...");

        navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then((stream) => {
            this.myStream = stream;
            // IMPORTANT: Start unmuted for testing, but let UI control it
            this.setMicStatus(false);
            resolve();
          })
          .catch((err) => {
            console.error("Mic Error:", err);
            this.updateStatus("Mic Error!");
            reject(err);
          });
      });

      this.peer.on("call", (incomingCall) => {
        console.log("Incoming call...");
        this.updateStatus("Connecting...");
        incomingCall.answer(this.myStream);
        this.handleCallStream(incomingCall);
      });
    });
  }

  connectToPeer(remotePeerId) {
    if (!this.peer || !this.myStream || this.call) return;
    console.log("Calling:", remotePeerId);
    this.updateStatus("Calling...");
    const outgoingCall = this.peer.call(remotePeerId, this.myStream);
    this.handleCallStream(outgoingCall);
  }

  handleCallStream(call) {
    this.call = call;

    call.on("stream", (remoteStream) => {
      console.log("Stream received!");
      this.updateStatus("CONNECTED ✅");
      this.playAudio(remoteStream);
    });

    call.on("close", () => {
      this.updateStatus("Ended");
      this.removeAudioPlayer();
      this.call = null;
    });

    call.on("error", (err) => {
      this.updateStatus("Error");
      console.error(err);
    });
  }

  playAudio(stream) {
    this.removeAudioPlayer(); // Remove old player if exists

    const audio = document.createElement("audio");
    audio.id = "remote-audio";
    audio.srcObject = stream;

    // --- DEBUG CONTROLS ---
    audio.controls = true; // Show player controls
    audio.autoplay = true;
    audio.playsInline = true;

    // Style to make it visible on bottom right
    audio.style.position = "fixed";
    audio.style.bottom = "20px";
    audio.style.right = "20px";
    audio.style.zIndex = "9999";
    audio.style.width = "300px";
    audio.style.height = "50px";
    audio.style.boxShadow = "0 0 20px rgba(0,0,0,0.5)";
    audio.style.borderRadius = "10px";

    document.body.appendChild(audio);

    // Try to play
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.log("Autoplay blocked. User must click play on the player.");
        this.updateStatus("CLICK PLAY BUTTON ->");
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
