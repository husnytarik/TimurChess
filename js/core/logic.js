class GameLogic {
  static isSquareUnderAttack(x, y, defenderColor, allPieces) {
    const enemyColor = defenderColor === "white" ? "black" : "white";
    const enemies = allPieces.filter((p) => p.color === enemyColor);
    for (const enemy of enemies) {
      const moves = enemy.getRawMoves(allPieces);
      if (moves.some((m) => m.x === x && m.y === y)) return true;
    }
    return false;
  }

  static isKingInCheck(color, allPieces) {
    const king = allPieces.find(
      (p) => (p.type === "king" || p.type === "prince") && p.color === color,
    );
    if (!king) return false;
    return this.isSquareUnderAttack(king.x, king.y, color, allPieces);
  }

  static getLegalMoves(piece, allPieces) {
    const rawMoves = piece.getRawMoves(allPieces);
    const validMoves = [];

    rawMoves.forEach((move) => {
      const originalX = piece.x;
      const originalY = piece.y;
      const captured = allPieces.find((p) => p.x === move.x && p.y === move.y);

      piece.x = move.x;
      piece.y = move.y;

      let simPieces = [...allPieces];
      if (captured) simPieces = simPieces.filter((p) => p !== captured);

      if (!this.isKingInCheck(piece.color, simPieces)) {
        validMoves.push(move);
      }

      piece.x = originalX;
      piece.y = originalY;
    });
    return validMoves;
  }

  static checkPromotion(piece) {
    if (piece.type !== "pawn") return null;
    const isLastRank =
      (piece.color === "white" && piece.y === 0) ||
      (piece.color === "black" && piece.y === 9);
    if (isLastRank) {
      return CONFIG.PROMOTION_MAP[piece.x] || "vizier";
    }
    return null;
  }
}
