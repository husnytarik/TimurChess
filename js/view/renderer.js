class Renderer {
  constructor(canvas) {
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this.perspective = "white";

    this.icons = {
      king: "♚\uFE0E",
      prince: "♔\uFE0E",
      vizier: "♛\uFE0E",
      general: "⚔\uFE0E",
      rook: "♜\uFE0E",
      knight: "♞\uFE0E",
      elephant: "♝\uFE0E",
      camel: "C",
      giraffe: "Z",
      scout: "➹\uFE0E", // Fixed: Uses a monochrome arrow to respect fillStyle
      catapult: "☄\uFE0E",
      pawn: "♟\uFE0E",
    };
    this.colLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    this.rowLabels = [
      "X",
      "IX",
      "VIII",
      "VII",
      "VI",
      "V",
      "IV",
      "III",
      "II",
      "I",
    ];
  }

  setPerspective(color) {
    this.perspective = color || "white";
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  getScreenCoords(logicalX, logicalY) {
    let drawX = logicalX;
    let drawY = logicalY;

    if (this.perspective === "black") {
      drawX = CONFIG.BOARD.COLS - 1 - logicalX;
      drawY = CONFIG.BOARD.ROWS - 1 - logicalY;
    }

    return {
      x: drawX * CONFIG.BOARD.TILE_SIZE + CONFIG.BOARD.OFFSET_X,
      y: drawY * CONFIG.BOARD.TILE_SIZE + CONFIG.BOARD.OFFSET_Y,
    };
  }

  drawBoard() {
    this.drawCoordinates();
    const s = CONFIG.BOARD.TILE_SIZE;

    for (let r = 0; r < CONFIG.BOARD.ROWS; r++) {
      for (let c = 0; c < CONFIG.BOARD.COLS; c++) {
        this.ctx.fillStyle =
          (r + c) % 2 === 0
            ? CONFIG.THEME.BOARD_LIGHT
            : CONFIG.THEME.BOARD_DARK;

        const pos = this.getScreenCoords(c, r);

        this.ctx.fillRect(pos.x, pos.y, s, s);
        this.ctx.strokeStyle = CONFIG.THEME.GRID_LINE;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(pos.x, pos.y, s, s);
      }
    }

    this.ctx.fillStyle = CONFIG.THEME.CITADEL;
    const leftCitadelPos = this.getScreenCoords(-1, 2);
    this.ctx.fillRect(leftCitadelPos.x, leftCitadelPos.y, s, s);
    const rightCitadelPos = this.getScreenCoords(11, 7);
    this.ctx.fillRect(rightCitadelPos.x, rightCitadelPos.y, s, s);
  }

  drawCoordinates() {
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    this.ctx.font = "bold 16px sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    const ts = CONFIG.BOARD.TILE_SIZE;
    const ox = CONFIG.BOARD.OFFSET_X;
    const oy = CONFIG.BOARD.OFFSET_Y;

    let cols = this.colLabels;
    let rows = this.rowLabels;

    if (this.perspective === "black") {
      cols = [...this.colLabels].reverse();
      rows = [...this.rowLabels].reverse();
    }

    for (let c = 0; c < CONFIG.BOARD.COLS; c++) {
      const label = cols[c];
      const x = ox + c * ts + ts / 2;
      this.ctx.fillText(label, x, oy / 2);
      this.ctx.fillText(label, x, this.height - oy / 2);
    }

    for (let r = 0; r < CONFIG.BOARD.ROWS; r++) {
      const label = rows[r];
      const y = oy + r * ts + ts / 2;
      this.ctx.fillText(label, ox / 2, y);
      this.ctx.fillText(label, this.width - ox / 2, y);
    }
  }

  drawPulseSquare(pos, rgbArray, time, type) {
    const s = CONFIG.BOARD.TILE_SIZE;
    const screenPos = this.getScreenCoords(pos.x, pos.y);
    const x = screenPos.x;
    const y = screenPos.y;

    const rgbStr = rgbArray.join(",");
    const speed =
      type === "hover" ? CONFIG.ANIMATION.SPEED * 1.5 : CONFIG.ANIMATION.SPEED;
    const sineWave = (Math.sin(time * speed) + 1) / 2;

    const minBlur = type === "hover" ? 10 : 10;
    const maxBlur = type === "hover" ? 10 : 10;
    const currentBlur = minBlur + sineWave * (maxBlur - minBlur);

    const minAlpha = type === "hover" ? 0 : 0.1;
    const maxAlpha = type === "hover" ? 0.6 : 1;
    const currentAlpha = minAlpha + sineWave * (maxAlpha - minAlpha);

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, s, s);
    this.ctx.clip();

    this.ctx.strokeStyle = `rgba(${rgbStr}, ${currentAlpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = currentBlur;
    this.ctx.shadowColor = `rgba(${rgbStr}, 1)`;
    this.ctx.strokeRect(x, y, s, s);

    if (type !== "hover") {
      this.ctx.fillStyle = `rgba(${rgbStr}, 0.15)`;
      this.ctx.fillRect(x, y, s, s);
    }
    this.ctx.restore();
  }

  drawSolidSquare(pos, rgbArray, alpha) {
    const screenPos = this.getScreenCoords(pos.x, pos.y);
    this.ctx.fillStyle = `rgba(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]}, ${alpha})`;
    this.ctx.fillRect(
      screenPos.x,
      screenPos.y,
      CONFIG.BOARD.TILE_SIZE,
      CONFIG.BOARD.TILE_SIZE,
    );
  }

  drawHighlights(selectedPiece, kingInCheckPos) {
    const ts = CONFIG.BOARD.TILE_SIZE;

    if (selectedPiece) {
      const p = this.getScreenCoords(selectedPiece.x, selectedPiece.y);
      this.ctx.strokeStyle = CONFIG.THEME.COLOR_SELECTED;
      this.ctx.lineWidth = 4;
      this.ctx.strokeRect(p.x, p.y, ts, ts);
    }

    if (kingInCheckPos) {
      const p = this.getScreenCoords(kingInCheckPos.x, kingInCheckPos.y);
      this.ctx.fillStyle = `rgba(${CONFIG.THEME.COLOR_INVALID.join(",")}, 0.7)`;
      this.ctx.fillRect(p.x, p.y, ts, ts);
    }
  }

  drawPiece(piece) {
    const pos = this.getScreenCoords(piece.x, piece.y);
    const ts = CONFIG.BOARD.TILE_SIZE;

    this.ctx.save();
    this.ctx.font = `bold ${ts * 0.75}px "Segoe UI Symbol", Arial`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    if (piece.color === "white") {
      this.ctx.fillStyle = CONFIG.THEME.PIECE_WHITE;
      this.ctx.strokeStyle = CONFIG.THEME.PIECE_WHITE_STROKE;
    } else {
      this.ctx.fillStyle = CONFIG.THEME.PIECE_BLACK;
      this.ctx.strokeStyle = CONFIG.THEME.PIECE_BLACK_STROKE;
    }

    this.ctx.lineWidth = 2;
    const symbol = this.icons[piece.type] || "?";
    this.ctx.strokeText(symbol, pos.x + ts / 2, pos.y + ts / 2 + 4);
    this.ctx.fillText(symbol, pos.x + ts / 2, pos.y + ts / 2 + 4);
    this.ctx.restore();
  }
}
