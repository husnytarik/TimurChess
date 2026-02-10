window.Bot = {
  difficulty: "easy",

  // Taş Puanları (Zekayı belirler)
  pieceValues: {
    pawn: 10,
    war_engine: 30,
    camel: 40,
    elephant: 25,
    knight: 45,
    ferz: 20,
    giraffe: 50,
    picket: 35,
    rook: 60,
    prince: 20,
    general: 80,
    king: 10000,
  },

  // --- BAŞLATMA FONKSİYONU (HATA VEREN KISIM BURASIYDI, ARTIK VAR) ---
  init: function (diff) {
    this.difficulty = diff || "easy";
    console.log("Bot initialized! Level:", this.difficulty);
  },

  playTurn: async (myColor) => {
    // İnsan gibi görünsün diye azıcık bekle
    await new Promise((r) => setTimeout(r, 600));

    const pieces = window.state.pieces;
    let bestMove = null;

    try {
      if (window.Bot.difficulty === "easy") {
        // KOLAY: Tamamen rastgele
        bestMove = window.Bot.getRandomMove(pieces, myColor);
      } else {
        // ORTA ve ZOR: Puanlı sistem
        bestMove = window.Bot.calculateBestMove(pieces, myColor);
      }

      if (bestMove) {
        // Taşı seç ve oynat
        const piece = pieces.find(
          (p) => p.x === bestMove.from.x && p.y === bestMove.from.y,
        );
        if (piece) {
          window.state.selectedPiece = piece;
          window.executeMove(bestMove.to);
        }
      } else {
        console.log("Bot: Hamle bulunamadı (Pat/Mat).");
      }
    } catch (e) {
      console.error("Bot Hatası:", e);
    }
  },

  // --- RASTGELE HAMLE ---
  getRandomMove: (pieces, color) => {
    const moves = window.Bot.getAllMoves(pieces, color);
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  },

  // --- AKILLI HAMLE HESAPLAYICI ---
  calculateBestMove: (pieces, myColor) => {
    const moves = window.Bot.getAllMoves(pieces, myColor);
    if (moves.length === 0) return null;

    // 1. DÜŞMANIN TEHLİKE BÖLGESİNİ ÇIKAR
    const oppColor = myColor === "white" ? "black" : "white";
    // Zor moddaysak tehlike haritasını hesapla, orta modda boş geç
    const dangerZones =
      window.Bot.difficulty === "hard"
        ? window.Bot.getDangerMap(pieces, oppColor)
        : new Set();

    let bestMove = null;
    let maxScore = -Infinity;

    // Hamleleri karıştır (Aynı puanda hep aynısını oynamasın)
    moves.sort(() => Math.random() - 0.5);

    for (const move of moves) {
      let score = 0;
      const myPieceValue = window.Bot.pieceValues[move.pieceType] || 0;

      // A) SALDIRI PUANI
      if (move.to.isCapture) {
        const target = pieces.find(
          (p) => p.x === move.to.x && p.y === move.to.y,
        );
        if (target) {
          const victimValue = window.Bot.pieceValues[target.type] || 0;
          // Değerli taşı ye
          score += victimValue * 10;

          // Eğer yediğim taş beni koruyorsa ve onu yiyerek ölüyorsam dikkat et
          if (victimValue > myPieceValue) score += 50;
        }
      }

      // B) GÜVENLİK PUANI (Sadece HARD modda)
      const destKey = `${move.to.x},${move.to.y}`;
      if (dangerZones.has(destKey)) {
        // Eğer oraya gidersem beni yerler!
        score -= myPieceValue * 2;
      }

      // C) POZİSYON PUANI (Merkeze git)
      const dist = Math.abs(move.to.x - 5) + Math.abs(move.to.y - 5);
      score -= dist;

      // D) ŞAH GÜVENLİĞİ
      if (move.pieceType === "king") {
        score -= 10;
      }

      if (score > maxScore) {
        maxScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  },

  // --- TEHLİKE HARİTASI ---
  getDangerMap: (pieces, enemyColor) => {
    const dangerSet = new Set();
    const enemies = pieces.filter((p) => p.color === enemyColor);

    for (const enemy of enemies) {
      const moves = GameLogic.getLegalMoves(enemy, pieces);
      for (const m of moves) {
        dangerSet.add(`${m.x},${m.y}`);
      }
    }
    return dangerSet;
  },

  // Tüm hamleleri listele
  getAllMoves: (pieces, color) => {
    const moves = [];
    const myPieces = pieces.filter((p) => p.color === color);

    for (const p of myPieces) {
      const legal = GameLogic.getLegalMoves(p, pieces);
      for (const m of legal) {
        moves.push({
          from: { x: p.x, y: p.y },
          to: m,
          pieceType: p.type,
        });
      }
    }
    return moves;
  },
};
