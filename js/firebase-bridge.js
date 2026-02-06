import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  update,
  get,
  onDisconnect,
  remove,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7-WBfBIN5YwL-c3dua6jCsqpVJxIRfrI",
  authDomain: "timurchess-c2b78.firebaseapp.com",
  projectId: "timurchess-c2b78",
  storageBucket: "timurchess-c2b78.firebasestorage.app",
  messagingSenderId: "756724628338",
  appId: "1:756724628338:web:016b8f717728dc6d4ebbeb",
  databaseURL:
    "https://timurchess-c2b78-default-rtdb.europe-west1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const mySessionId = "USER_" + Math.random().toString(36).substring(2, 9);

window.Network = {
  createGame: async (roomId) => {
    const gameRef = ref(db, "games/" + roomId);
    await set(gameRef, {
      created: Date.now(),
      status: "waiting_ready",
      turn: "white",
      lastMove: null,
      playerWhite: mySessionId,
      playerBlack: null,
      readyWhite: false,
      readyBlack: false,
    });
    onDisconnect(ref(db, `games/${roomId}/playerWhite`)).remove();
    return "white";
  },

  joinGame: async (roomId) => {
    const gameRef = ref(db, "games/" + roomId);
    const snapshot = await get(gameRef);
    if (!snapshot.exists()) return { success: false, reason: "not_found" };

    const data = snapshot.val();
    if (!data.playerWhite) {
      await update(gameRef, { playerWhite: mySessionId });
      onDisconnect(ref(db, `games/${roomId}/playerWhite`)).remove();
      return { success: true, color: "white" };
    } else if (!data.playerBlack) {
      await update(gameRef, { playerBlack: mySessionId });
      onDisconnect(ref(db, `games/${roomId}/playerBlack`)).remove();
      return { success: true, color: "black" };
    } else {
      return { success: false, reason: "full" };
    }
  },

  setReady: (roomId, color) => {
    const updates = {};
    if (color === "white") updates.readyWhite = true;
    if (color === "black") updates.readyBlack = true;
    update(ref(db, "games/" + roomId), updates);
  },

  startGame: (roomId) => {
    update(ref(db, "games/" + roomId), { status: "playing" });
  },

  sendMove: (roomId, moveData, nextTurn) => {
    update(ref(db, "games/" + roomId), { lastMove: moveData, turn: nextTurn });
  },

  listenGame: (roomId, callback) => {
    onValue(ref(db, "games/" + roomId), (snapshot) => {
      const data = snapshot.val();
      if (data) callback(data);
    });
  },

  savePeerId: (roomId, color, peerId) => {
    const updates = {};
    const field = color === "white" ? "peerWhite" : "peerBlack";
    updates[field] = peerId;
    update(ref(db, "games/" + roomId), updates);
  },
};
