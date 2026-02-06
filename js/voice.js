class VoiceManager {
  constructor() {
    this.peer = null;
    this.myStream = null;
    this.call = null;
    this.isMicOn = false;
  }

  async init(myId) {
    this.peer = new Peer(myId);

    try {
      this.myStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.setMicStatus(false);

      this.peer.on("call", (incomingCall) => {
        console.log("Incoming voice call...");
        incomingCall.answer(this.myStream);
        incomingCall.on("stream", (remoteStream) => {
          this.playAudio(remoteStream);
        });
        this.call = incomingCall;
      });
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Microphone access denied! Voice chat may not work.");
    }
  }

  connectToPeer(remotePeerId) {
    if (!this.peer || !this.myStream || this.call) return;

    console.log("Calling:", remotePeerId);
    const outgoingCall = this.peer.call(remotePeerId, this.myStream);

    outgoingCall.on("stream", (remoteStream) => {
      this.playAudio(remoteStream);
    });

    this.call = outgoingCall;
  }

  playAudio(stream) {
    let audio = document.getElementById("remote-audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "remote-audio";
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;
    audio
      .play()
      .catch((e) => console.log("Auto-play prevented, interaction required."));
  }

  toggleMic() {
    if (!this.myStream) return false;

    this.isMicOn = !this.isMicOn;
    this.setMicStatus(this.isMicOn);
    return this.isMicOn;
  }

  setMicStatus(isOpen) {
    if (this.myStream) {
      this.myStream.getAudioTracks()[0].enabled = isOpen;
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
