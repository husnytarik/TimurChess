import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  onValue,
  update,
  get,
  remove,
  push,
  query,
  orderByChild,
  equalTo,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;

window.Network = {
  initAuth: (onLogin, onLogout) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        window.Network.updateMyStatus("online", null, null);
        onLogin(user);
        window.Network.listenForInvites(user.uid);
      } else {
        currentUser = null;
        onLogout();
      }
    });
  },

  login: async (email, pass) =>
    await signInWithEmailAndPassword(auth, email, pass)
      .then(() => ({ success: true }))
      .catch((e) => ({ success: false, error: e.message })),
  register: async (email, pass) => {
    try {
      const r = await createUserWithEmailAndPassword(auth, email, pass);
      await initUserData(r.user);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
  loginGoogle: async () => {
    try {
      const r = await signInWithPopup(auth, googleProvider);
      await initUserData(r.user);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
  logout: () => {
    if (currentUser) window.Network.updateMyStatus("offline", null, null);
    signOut(auth);
  },

  // --- STATUS & NICKNAME ---
  updateMyStatus: async (state, roomId, role) => {
    if (!currentUser) return;
    await update(ref(db, `users/${currentUser.uid}`), {
      status: {
        state: state,
        roomId: roomId,
        role: role,
        timestamp: Date.now(),
      },
    });
  },

  setNickname: async (name) => {
    if (!currentUser) return;
    await update(ref(db, `users/${currentUser.uid}`), { nickname: name });
  },

  // --- ROOMS ---
  createGame: async (roomId, isPublic) => {
    if (!currentUser) return null;
    await set(ref(db, "games/" + roomId), {
      created: Date.now(),
      status: "waiting_ready",
      turn: "white",
      lastMove: null,
      playerWhite: currentUser.uid,
      playerBlack: null,
      readyWhite: false,
      readyBlack: false,
      isPublic: isPublic === true,
    });
    await window.Network.updateMyStatus("waiting", roomId, "White");
    return "white";
  },

  getPublicGames: async () => {
    const q = query(ref(db, "games"), orderByChild("isPublic"), equalTo(true));
    const s = await get(q);
    if (!s.exists()) return [];

    const g = [];
    const now = Date.now();

    s.forEach((c) => {
      const v = c.val();
      // Süresi dolmuş boş odaları temizle (3 dk)
      if (v.emptyAt && now - v.emptyAt > 180000) {
        remove(c.ref);
        return;
      }
      // Sadece "waiting_ready" durumundaki ve boş yeri olan odaları göster
      // HATA BURADAYDI: child.key yerine c.key yazmalıydık
      if (!v.playerBlack && v.status === "waiting_ready") {
        g.push({ id: c.key, ...v });
      }
    });
    return g;
  },

  joinGame: async (roomId) => {
    if (!currentUser) return { success: false, reason: "auth_error" };
    const r = ref(db, "games/" + roomId);
    const s = await get(r);
    if (!s.exists()) return { success: false, reason: "not_found" };
    const d = s.val();

    if (d.playerWhite === currentUser.uid) {
      await window.Network.updateMyStatus("playing", roomId, "White");
      return { success: true, color: "white", isRejoin: true };
    }
    if (d.playerBlack === currentUser.uid) {
      await window.Network.updateMyStatus("playing", roomId, "Black");
      return { success: true, color: "black", isRejoin: true };
    }

    if (!d.playerWhite) {
      await update(r, { playerWhite: currentUser.uid, emptyAt: null });
      await window.Network.updateMyStatus("waiting", roomId, "White");
      return { success: true, color: "white" };
    } else if (!d.playerBlack) {
      await update(r, { playerBlack: currentUser.uid, emptyAt: null });
      await window.Network.updateMyStatus("playing", roomId, "Black");
      return { success: true, color: "black" };
    } else {
      return { success: false, reason: "full" };
    }
  },

  leaveGame: async (roomId, color) => {
    if (!currentUser) return;
    const r = ref(db, "games/" + roomId);
    const s = await get(r);
    if (!s.exists()) return;
    const g = s.val();

    const u = {};
    if (color === "white") u.playerWhite = null;
    if (color === "black") u.playerBlack = null;
    u.status = "waiting_ready";
    u.readyWhite = false;
    u.readyBlack = false;

    const wGone = color === "white" || !g.playerWhite;
    const bGone = color === "black" || !g.playerBlack;
    if (wGone && bGone) u.emptyAt = Date.now();

    await update(r, u);
    await window.Network.updateMyStatus("online", null, null);
  },

  setReady: (roomId, color) => {
    const u = {};
    if (color === "white") u.readyWhite = true;
    if (color === "black") u.readyBlack = true;
    update(ref(db, "games/" + roomId), u);
    window.Network.updateMyStatus(
      "playing",
      roomId,
      color === "white" ? "White" : "Black",
    );
  },

  startGame: (roomId) =>
    update(ref(db, "games/" + roomId), { status: "playing" }),
  sendMove: (roomId, m, n) =>
    update(ref(db, "games/" + roomId), { lastMove: m, turn: n }),
  listenGame: (roomId, cb) =>
    onValue(ref(db, "games/" + roomId), (s) => {
      if (s.val()) cb(s.val());
    }),
  savePeerId: (roomId, c, p) => {
    const u = {};
    u[c === "white" ? "peerWhite" : "peerBlack"] = p;
    update(ref(db, "games/" + roomId), u);
  },

  // --- USER DATA ---
  getMyScore: async () => {
    if (!currentUser) return 0;
    const s = await get(ref(db, "users/" + currentUser.uid + "/score"));
    return s.val() || 1000;
  },
  getUserProfile: async (uid) => {
    const targetUid = uid || (currentUser ? currentUser.uid : null);
    if (!targetUid) return null;
    return (await get(ref(db, "users/" + targetUid))).val();
  },
  getUserHistory: async () => {
    if (!currentUser) return [];
    const s = await get(ref(db, "history/" + currentUser.uid));
    if (!s.exists()) return [];
    const h = [];
    s.forEach((c) => h.push(c.val()));
    return h.reverse();
  },
  recordGameResult: async (isWin, oppName) => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const uRef = ref(db, "users/" + uid);
    const s = await get(uRef);
    let d = s.val() || { wins: 0, losses: 0, score: 1000 };
    if (isWin) {
      d.wins++;
      d.score += 15;
    } else {
      d.losses++;
      d.score = Math.max(0, d.score - 10);
    }
    await update(uRef, { wins: d.wins, losses: d.losses, score: d.score });
    await set(push(ref(db, "history/" + uid)), {
      date: Date.now(),
      result: isWin ? "WIN" : "LOSS",
      opponent: oppName || "Unknown",
      scoreChange: isWin ? "+15" : "-10",
    });

    await window.Network.updateMyStatus("online", null, null);
  },

  // --- FRIENDS ---
  sendFriendRequest: async (email) => {
    if (!currentUser) return { success: false, error: "Not logged in" };
    const s = await get(ref(db, "users"));
    let tid = null;
    s.forEach((c) => {
      if (c.val().email && c.val().email.toLowerCase() === email.toLowerCase())
        tid = c.key;
    });
    if (!tid) return { success: false, error: "User not found" };
    if (tid === currentUser.uid)
      return { success: false, error: "Cannot add yourself" };
    await set(ref(db, `users/${tid}/requests/${currentUser.uid}`), {
      email: currentUser.email,
      nickname: (await window.Network.getUserProfile()).nickname || "Unknown",
      timestamp: Date.now(),
    });
    return { success: true };
  },
  getFriendRequests: async () => {
    if (!currentUser) return [];
    const s = await get(ref(db, `users/${currentUser.uid}/requests`));
    if (!s.exists()) return [];
    const r = [];
    s.forEach((c) => r.push({ uid: c.key, ...c.val() }));
    return r;
  },
  respondToFriendRequest: async (ruid, accept) => {
    if (!currentUser) return;
    await remove(ref(db, `users/${currentUser.uid}/requests/${ruid}`));
    if (accept) {
      const rData = (await get(ref(db, `users/${ruid}`))).val();
      await set(ref(db, `users/${currentUser.uid}/friends/${ruid}`), {
        email: rData.email,
        addedAt: Date.now(),
      });
      await set(ref(db, `users/${ruid}/friends/${currentUser.uid}`), {
        email: currentUser.email,
        addedAt: Date.now(),
      });
    }
  },
  getFriendsDetailed: async () => {
    if (!currentUser) return [];
    const s = await get(ref(db, `users/${currentUser.uid}/friends`));
    if (!s.exists()) return [];

    const friends = [];
    const promises = [];

    s.forEach((c) => {
      const uid = c.key;
      const p = get(ref(db, `users/${uid}`)).then((userSnap) => {
        if (userSnap.exists()) {
          friends.push({ uid: uid, ...userSnap.val() });
        }
      });
      promises.push(p);
    });

    await Promise.all(promises);
    return friends;
  },
  removeFriend: async (uid) => {
    if (!currentUser) return;
    await remove(ref(db, `users/${currentUser.uid}/friends/${uid}`));
    await remove(ref(db, `users/${uid}/friends/${currentUser.uid}`));
  },

  inviteFriend: async (fuid, rid) => {
    if (!currentUser) return;
    const myProfile = await window.Network.getUserProfile();
    await set(ref(db, `users/${fuid}/invites/${rid}`), {
      from: myProfile.nickname || currentUser.email,
      roomId: rid,
      timestamp: Date.now(),
    });
  },
  listenForInvites: (uid) => {
    onValue(ref(db, `users/${uid}/invites`), (s) => {
      if (s.exists()) {
        s.forEach((c) => {
          const i = c.val();
          if (Date.now() - i.timestamp > 30000) remove(c.ref);
          else {
            if (confirm(`Invite from ${i.from}!\nJoin Room?`)) {
              document.getElementById("room-code-input").value = i.roomId;
              window.joinRoom();
            }
            remove(c.ref);
          }
        });
      }
    });
  },
};

async function initUserData(user) {
  const r = ref(db, "users/" + user.uid);
  const s = await get(r);
  if (!s.exists()) {
    const defaultNick = user.email.split("@")[0];
    await set(r, {
      email: user.email,
      nickname: defaultNick,
      score: 1000,
      wins: 0,
      losses: 0,
      status: { state: "online", timestamp: Date.now() },
    });
  } else {
    update(r, { status: { state: "online", timestamp: Date.now() } });
  }
}
