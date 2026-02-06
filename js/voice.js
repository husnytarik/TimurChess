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
        console.log("PeerJS Connected, ID:", id);
        this.updateStatus("Waiting for connection...");

        navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .then((stream) => {
            this.myStream = stream;
            this.setMicStatus(false);
            resolve();
          })
          .catch((err) => {
            console.error("Microphone error:", err);
            this.updateStatus("Microphone Error!");
            reject(err);
          });
      });

      this.peer.on("error", (err) => {
        console.error("PeerJS Error:", err);
        this.updateStatus("Error Occurred");
      });
      this.peer.on("call", (incomingCall) => {
        console.log("Incoming voice call...");
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
      console.log("Remote stream received!");
      this.updateStatus("VOICE CONNECTED ✅");
      this.playAudio(remoteStream);
    });

    call.on("close", () => {
      this.updateStatus("Connection Lost");
      this.call = null;
    });

    call.on("error", (err) => {
      console.error("Call error:", err);
      this.updateStatus("Connection Error");
    });
  }

  playAudio(stream) {
    let audio = document.getElementById("remote-audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "remote-audio";
      document.body.appendChild(audio);
    }

    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.volume = 1.0;

    const startPlay = async () => {
      try {
        await audio.play();
        console.log("Audio playing started successfully.");
      } catch (err) {
        console.error("Autoplay prevented:", err);
        this.updateStatus("CLICK SCREEN TO HEAR AUDIO! 👆");

        document.body.addEventListener(
          "click",
          () => {
            audio.play();
            this.updateStatus("VOICE CONNECTED ✅");
          },
          { once: true },
        );
      }
    };

    startPlay();
  }

  toggleMic() {
    if (!this.myStream) return false;

    this.isMicOn = !this.isMicOn;
    this.setMicStatus(this.isMicOn);
    return this.isMicOn;
  }

  setMicStatus(isOpen) {
    if (this.myStream && this.myStream.getAudioTracks().length > 0) {
      this.myStream.getAudioTracks()[0].enabled = isOpen;
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
