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
  limitToLast,
  onChildAdded,
  onDisconnect,
  serverTimestamp,
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

// Rastgele ID Üretici (6 Karakter)
function generateId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

window.Network = {
  initAuth: (onLogin, onLogout) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        currentUser = user;
        // Kullanıcı verisini garantile (ID yoksa oluştur)
        await initUserData(user);

        const statusRef = ref(db, `users/${user.uid}/status`);
        onDisconnect(statusRef).set({
          state: "offline",
          timestamp: serverTimestamp(),
        });
        window.Network.updateMyStatus("online", null, null);

        // Davetleri Dinle
        window.Network.listenForInvites(user.uid);

        onLogin(user);
      } else {
        currentUser = null;
        onLogout();
      }
    });
  },

  login: async (email, pass) =>
    signInWithEmailAndPassword(auth, email, pass)
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

  updateMyStatus: async (state, roomId, role) => {
    if (!currentUser) return;
    await update(ref(db, `users/${currentUser.uid}`), {
      status: { state, roomId, role, timestamp: Date.now() },
    });
  },

  setNickname: async (name) => {
    if (!currentUser) return;
    await update(ref(db, `users/${currentUser.uid}`), { nickname: name });
  },

  // --- OYUN KURMA (DÜZELTİLDİ) ---
  createGame: async (customId, isPublic) => {
    if (!currentUser) return null;

    // ID Yoksa Üret
    const roomId = customId || generateId();

    const myProfile = await window.Network.getUserProfile();
    const myName = myProfile ? myProfile.nickname : "Player";

    await set(ref(db, "games/" + roomId), {
      created: Date.now(),
      status: "waiting_ready",
      turn: "white",
      lastMove: null,
      playerWhite: currentUser.uid,
      playerBlack: null,
      whiteName: myName,
      readyWhite: false,
      readyBlack: false,
      isPublic: isPublic === true,
    });

    await window.Network.updateMyStatus("waiting", roomId, "White");
    window.Network.setupDisconnectAction(roomId, "white");

    // ÖNEMLİ: ID'yi geri döndür (Lobi bunu bekliyor)
    return roomId;
  },

  joinGame: async (roomId) => {
    if (!currentUser) return { success: false, reason: "auth_error" };
    const r = ref(db, "games/" + roomId);
    const s = await get(r);
    if (!s.exists()) return { success: false, reason: "not_found" };
    const d = s.val();

    // Süresi geçmiş odaları temizle
    if (Date.now() - d.created > 3600000 && d.status === "waiting_ready") {
      remove(r);
      return { success: false, reason: "room_expired" };
    }

    let myColor = null;
    let isRejoin = false;
    if (d.playerWhite === currentUser.uid) {
      myColor = "white";
      isRejoin = true;
    } else if (d.playerBlack === currentUser.uid) {
      myColor = "black";
      isRejoin = true;
    } else if (!d.playerWhite) {
      const p = await window.Network.getUserProfile();
      await update(r, {
        playerWhite: currentUser.uid,
        whiteName: p.nickname || "P2",
        emptyAt: null,
      });
      myColor = "white";
    } else if (!d.playerBlack) {
      const p = await window.Network.getUserProfile();
      await update(r, {
        playerBlack: currentUser.uid,
        blackName: p.nickname || "P2",
        emptyAt: null,
      });
      myColor = "black";
    } else return { success: false, reason: "full" };

    const statusState = d.playerWhite && d.playerBlack ? "playing" : "waiting";
    await window.Network.updateMyStatus(
      statusState,
      roomId,
      myColor === "white" ? "White" : "Black",
    );
    window.Network.setupDisconnectAction(roomId, myColor);
    return { success: true, color: myColor, isRejoin: isRejoin };
  },

  setupDisconnectAction: (roomId, color) => {
    if (!currentUser) return;
    const gameRef = ref(db, "games/" + roomId);
    const onlineUpdate = {};
    onlineUpdate[`${color}Disconnected`] = null;
    update(gameRef, onlineUpdate);
    const disconnectUpdate = {};
    disconnectUpdate[`${color}Disconnected`] = serverTimestamp();
    onDisconnect(gameRef).update(disconnectUpdate);
  },

  listenGame: (roomId, cb) => {
    const r = ref(db, "games/" + roomId);
    onValue(r, (s) => {
      if (s.val()) cb(s.val());
    });
  },

  leaveGame: async (roomId, color) => {
    if (!currentUser) return;
    const r = ref(db, "games/" + roomId);
    const s = await get(r);
    if (!s.exists()) return;
    const g = s.val();
    onDisconnect(r).cancel();
    const u = {};
    if (color === "white") {
      u.playerWhite = null;
      u.whiteName = null;
      u.whiteDisconnected = null;
    }
    if (color === "black") {
      u.playerBlack = null;
      u.blackName = null;
      u.blackDisconnected = null;
    }
    u.status = "waiting_ready";
    u.readyWhite = false;
    u.readyBlack = false;
    const wGone = color === "white" || !g.playerWhite;
    const bGone = color === "black" || !g.playerBlack;
    if (wGone && bGone) await remove(r);
    else await update(r, u);
    await window.Network.updateMyStatus("online", null, null);
  },

  setReady: (roomId, color, isReady) => {
    const u = {};
    if (color === "white") u.readyWhite = isReady;
    if (color === "black") u.readyBlack = isReady;
    update(ref(db, "games/" + roomId), u);
    if (isReady)
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
  savePeerId: (roomId, c, p) => {
    const u = {};
    u[c === "white" ? "peerWhite" : "peerBlack"] = p;
    update(ref(db, "games/" + roomId), u);
  },

  getMyScore: async () => {
    if (!currentUser) return 0;
    const s = await get(ref(db, "users/" + currentUser.uid + "/score"));
    return s.val() || 1000;
  },
  getUserProfile: async (uid) => {
    const t = uid || (currentUser ? currentUser.uid : null);
    if (!t) return null;
    return (await get(ref(db, "users/" + t))).val();
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

  getPublicGames: async () => {
    const q = query(ref(db, "games"), orderByChild("isPublic"), equalTo(true));
    const s = await get(q);
    if (!s.exists()) return [];
    const g = [];
    const now = Date.now();
    s.forEach((c) => {
      const v = c.val();
      if ((!v.playerBlack || !v.playerWhite) && v.status === "waiting_ready")
        g.push({ id: c.key, ...v });
    });
    return g;
  },

  // --- ARKADAŞ VE DAVET SİSTEMİ (Onarıldı) ---
  sendFriendRequest: async (identifier) => {
    if (!currentUser) return { success: false, error: "Not logged in" };
    // Tüm kullanıcıları tara (Güvenlik kuralı 'users' read açık olmalı)
    const usersRef = ref(db, "users");
    const s = await get(usersRef);
    let targetUid = null;

    s.forEach((child) => {
      const u = child.val();
      // Hem Email hem ID ile arama yap
      if (
        (u.email && u.email.toLowerCase() === identifier.toLowerCase()) ||
        (u.friendId && u.friendId === identifier.toUpperCase())
      ) {
        targetUid = child.key;
      }
    });

    if (!targetUid) return { success: false, error: "User not found" };
    if (targetUid === currentUser.uid)
      return { success: false, error: "Cannot add yourself" };

    const myP = await window.Network.getUserProfile();
    await set(ref(db, `users/${targetUid}/requests/${currentUser.uid}`), {
      email: currentUser.email,
      nickname: myP.nickname || "Unknown",
      timestamp: Date.now(),
    });
    return { success: true };
  },

  sendInvite: async (friendUid, roomId) => {
    if (!currentUser) return;
    const myProfile = await window.Network.getUserProfile();
    await push(ref(db, `users/${friendUid}/invites`), {
      fromUid: currentUser.uid,
      fromName: myProfile.nickname || "Friend",
      roomId: roomId,
      timestamp: Date.now(),
    });
  },

  listenForInvites: (uid) => {
    onChildAdded(ref(db, `users/${uid}/invites`), (s) => {
      const i = s.val();
      if (Date.now() - i.timestamp > 60000) {
        remove(s.ref);
        return;
      }
      if (window.showInvitePopup) window.showInvitePopup(i, s.key);
    });
  },
  removeInvite: async (key) => {
    if (currentUser)
      await remove(ref(db, `users/${currentUser.uid}/invites/${key}`));
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
    const f = [];
    const p = [];
    s.forEach((c) => {
      const uid = c.key;
      p.push(
        get(ref(db, `users/${uid}`)).then((u) => {
          if (u.exists()) f.push({ uid: uid, ...u.val() });
        }),
      );
    });
    await Promise.all(p);
    return f;
  },
  removeFriend: async (uid) => {
    if (!currentUser) return;
    await remove(ref(db, `users/${currentUser.uid}/friends/${uid}`));
    await remove(ref(db, `users/${uid}/friends/${currentUser.uid}`));
  },

  sendChatMessage: async (roomId, msg, senderName) => {
    if (!currentUser || !msg.trim()) return;
    const chatRef = ref(db, `games/${roomId}/chat`);
    await push(chatRef, {
      sender: senderName || "Player",
      text: msg,
      timestamp: Date.now(),
    });
  },
  listenForChat: (roomId, callback) => {
    const chatRef = query(ref(db, `games/${roomId}/chat`), limitToLast(50));
    onChildAdded(chatRef, (snapshot) => {
      callback(snapshot.val());
    });
  },
};

// --- KULLANICI BAŞLATMA (YAMALI) ---
async function initUserData(user) {
  const r = ref(db, "users/" + user.uid);
  const s = await get(r);

  // Kullanıcı yoksa veya EKSİKSE (ID'si yoksa) tamamla
  if (!s.exists() || !s.val().friendId) {
    const d = user.email.split("@")[0];
    await update(r, {
      email: user.email,
      nickname: s.exists() ? s.val().nickname || d : d,
      friendId: generateId(), // ID ÜRET
      score: s.exists() ? s.val().score || 1000 : 1000,
      wins: s.exists() ? s.val().wins || 0 : 0,
      losses: s.exists() ? s.val().losses || 0 : 0,
    });
  }
  update(r, { status: { state: "online", timestamp: Date.now() } });
}
