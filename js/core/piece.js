class Piece {
  constructor(type, color, x, y) {
    this.type = type;
    this.color = color;
    this.x = x;
    this.y = y;
  }

  getRawMoves(allPieces) {
    let moves = [];
    const isOccupied = (tx, ty) =>
      allPieces.find((p) => p.x === tx && p.y === ty);
    const isEnemy = (tx, ty) => {
      const p = isOccupied(tx, ty);
      return p && p.color !== this.color;
    };
    const isValidPos = (tx, ty) => {
      if (tx === -1 && ty === 2) return true;
      if (tx === 11 && ty === 7) return true;
      return (
        tx >= 0 && tx < CONFIG.BOARD.COLS && ty >= 0 && ty < CONFIG.BOARD.ROWS
      );
    };

    const addSlideMoves = (dirs) => {
      dirs.forEach((dir) => {
        for (let i = 1; i < 11; i++) {
          const tx = this.x + dir[0] * i;
          const ty = this.y + dir[1] * i;
          if (!isValidPos(tx, ty)) break;
          const occupant = isOccupied(tx, ty);
          if (!occupant) moves.push({ x: tx, y: ty });
          else {
            if (occupant.color !== this.color) moves.push({ x: tx, y: ty });
            break;
          }
        }
      });
    };

    const addStepMoves = (offsets) => {
      offsets.forEach((off) => {
        const tx = this.x + off[0];
        const ty = this.y + off[1];
        if (isValidPos(tx, ty)) {
          const occupant = isOccupied(tx, ty);
          if (!occupant || occupant.color !== this.color)
            moves.push({ x: tx, y: ty });
        }
      });
    };

    switch (this.type) {
      case "rook":
        addSlideMoves([
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]);
        break;
      case "catapult":
      case "scout":
        addSlideMoves([
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "knight":
        addStepMoves([
          [1, 2],
          [1, -2],
          [-1, 2],
          [-1, -2],
          [2, 1],
          [2, -1],
          [-2, 1],
          [-2, -1],
        ]);
        break;
      case "camel":
        addStepMoves([
          [1, 3],
          [1, -3],
          [-1, 3],
          [-1, -3],
          [3, 1],
          [3, -1],
          [-3, 1],
          [-3, -1],
        ]);
        break;
      case "elephant":
        addStepMoves([
          [2, 2],
          [2, -2],
          [-2, 2],
          [-2, -2],
        ]);
        break;
      case "king":
      case "prince":
        addStepMoves([
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "vizier":
        addStepMoves([
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]);
        break;
      case "general":
        addStepMoves([
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "giraffe":
        addSlideMoves([
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]);
        break;
      case "pawn":
        const dir = this.color === "white" ? -1 : 1;
        if (
          isValidPos(this.x, this.y + dir) &&
          !isOccupied(this.x, this.y + dir)
        )
          moves.push({ x: this.x, y: this.y + dir });
        [
          [1, dir],
          [-1, dir],
        ].forEach((off) => {
          const tx = this.x + off[0];
          const ty = this.y + off[1];
          if (isValidPos(tx, ty) && isEnemy(tx, ty))
            moves.push({ x: tx, y: ty });
        });
        break;
    }
    return moves;
  }
}
