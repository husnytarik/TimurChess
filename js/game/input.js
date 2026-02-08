const canvasEl = document.getElementById("gameCanvas");

function getLogicalPos(evt) {
  const rect = canvasEl.getBoundingClientRect();

  // 1. Tıklanan noktanın Canvas içindeki piksel konumu (0,0 sol üst)
  const clientX = evt.clientX || (evt.touches && evt.touches[0].clientX);
  const clientY = evt.clientY || (evt.touches && evt.touches[0].clientY);

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  // 2. Ölçekleme Faktörü (Canvas'ın çizim boyutu / Ekrandaki boyutu)
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;

  // 3. Gerçek Oyun Koordinatları (Config'deki Offsetleri hesaba katarak)
  // Mouse kordinatını ölçekle çarpıp offset'i çıkarıyoruz
  let col = Math.floor(
    (x * scaleX - CONFIG.BOARD.OFFSET_X) / CONFIG.BOARD.TILE_SIZE,
  );
  let row = Math.floor(
    (y * scaleY - CONFIG.BOARD.OFFSET_Y) / CONFIG.BOARD.TILE_SIZE,
  );

  if (window.state.myColor === "black") {
    col = CONFIG.BOARD.COLS - 1 - col;
    row = CONFIG.BOARD.ROWS - 1 - row;
  }
  return { col, row };
}

canvasEl.addEventListener("mousemove", (e) => {
  const p = getLogicalPos(e);
  // Sadece tahta sınırları içindeyse hover yap
  if (
    (p.col >= 0 &&
      p.col < CONFIG.BOARD.COLS &&
      p.row >= 0 &&
      p.row < CONFIG.BOARD.ROWS) ||
    (p.col === -1 && p.row === 2) ||
    (p.col === 11 && p.row === 7)
  )
    window.state.hoverSquare = { x: p.col, y: p.row };
  else window.state.hoverSquare = null;
});

canvasEl.addEventListener("click", (e) => {
  if (
    window.state.gameOver ||
    !window.state.gameStarted ||
    window.state.turn !== window.state.myColor
  )
    return;
  const p = getLogicalPos(e);

  // Tıklanan kare geçerli mi?
  const isValidMain =
    p.col >= 0 &&
    p.col < CONFIG.BOARD.COLS &&
    p.row >= 0 &&
    p.row < CONFIG.BOARD.ROWS;
  const isCitadel =
    (p.col === -1 && p.row === 2) || (p.col === 11 && p.row === 7);

  if (!isValidMain && !isCitadel) return; // Geçersiz alana tıklayınca işlem yapma

  const move = window.state.legalMoves.find(
    (m) => m.x === p.col && m.y === p.row,
  );

  if (window.state.selectedPiece && move) {
    window.executeMove(move);
    return;
  }

  const clicked = window.state.pieces.find(
    (piece) => piece.x === p.col && piece.y === p.row,
  );

  if (window.state.selectedPiece === clicked) {
    window.state.selectedPiece = null;
    window.state.legalMoves = [];
    return;
  }

  if (clicked && clicked.color === window.state.myColor) {
    window.state.selectedPiece = clicked;
    window.state.legalMoves = GameLogic.getLegalMoves(
      clicked,
      window.state.pieces,
    );
    window.state.errorSquare = null;
  } else if (window.state.selectedPiece) {
    window.state.errorSquare = { x: p.col, y: p.row, time: Date.now() };
  }
});

canvasEl.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault(); // Kaydırmayı engelle
    // Dokunma olayını Click olayına çevir
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("click", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    canvasEl.dispatchEvent(mouseEvent);
  },
  { passive: false },
);
