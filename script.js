// script.js (CORRIGIDO: O spawn da peça foi ajustado para y:0)

const COLS = 12;
const ROWS = 24;
const SIZE = 25;
const DROP_MS_START = 700;
const LINES_PER_LEVEL = 10;
const SPEED_STEP = 70;

const PALETTE = ["#53e4df","#f1b84b","#f25f5c","#b97cf6","#5cc06c","#6fb5ff","#ff8ad6","#a3f77b"];

const SHAPES = [
  [[1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[1,0],[1,0],[1,1]],
  [[1,1,0],[0,1,1]],
  [[0,1,1],[1,1,0]],
];

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("canvanext") || null;
const nctx = nextCanvas ? nextCanvas.getContext("2d") : null;

const elScore  = document.getElementById("score");
const elLinhas = document.getElementById("linhas");

let isGameOver = false;

let board;
let current;
let nextPiece;

let score = 0;
let lines = 0;
let level = 1;
let dropMs = DROP_MS_START;

let paused = false;
let running = false;
let timer = null;

// helpers
function makeBoard(rows, cols){
  return Array.from({length: rows}, () => Array(cols).fill(0));
}
function rand(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function clone(m){ return m.map(r => r.slice()); }

// =================================================================
// CORREÇÃO ESTÁ AQUI
// =================================================================
function spawnPiece(){
  const shape = clone(rand(SHAPES));
  const color = rand(PALETTE);
  return {
    shape,
    color,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0 // A peça DEVE nascer em y:0 para o "collide(0,0)" funcionar
  };
}
// =================================================================

function resetGameState(){
  board = makeBoard(ROWS, COLS);
  current = spawnPiece();
  nextPiece = spawnPiece();
  score = 0;
  lines = 0;
  level = 1;
  dropMs = DROP_MS_START;
  paused = false;
  running = true;
  isGameOver = false;
  updateHUD();
  drawNext();
  render();
}

function drawCell(x, y, color){
  ctx.fillStyle = color;
  ctx.fillRect(x*SIZE, y*SIZE, SIZE, SIZE);
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.strokeRect(x*SIZE, y*SIZE, SIZE, SIZE);
}

function drawBoard(){
  ctx.clearRect(0,0,canvas.width, canvas.height);
  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if(board[y][x]) drawCell(x,y,board[y][x]);
    }
  }
}

function drawPiece(p){
  for(let y=0;y<p.shape.length;y++){
    for(let x=0;x<p.shape[y].length;x++){
      if(p.shape[y][x]){
        const gx = p.x + x;
        const gy = p.y + y;
        if(gy>=0) drawCell(gx, gy, p.color);
      }
    }
  }
}

function drawNext(){
  if(!nctx) return;
  const s = 18;
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  
  const canvasWidth = nextCanvas.width;
  const canvasHeight = nextCanvas.height;

  const pw = nextPiece.shape[0].length * s;
  const ph = nextPiece.shape.length * s;
  const offX = Math.floor((canvasWidth - pw)/2);
  const offY = Math.floor((canvasHeight - ph)/2);

  for(let y=0;y<nextPiece.shape.length;y++){
    for(let x=0;x<nextPiece.shape[y].length;x++){
      if(nextPiece.shape[y][x]){
        nctx.fillStyle = nextPiece.color;
        nctx.fillRect(offX+x*s, offY+y*s, s, s);
        nctx.strokeStyle = "rgba(0,0,0,.35)";
        nctx.strokeRect(offX+x*s, offY+y*s, s, s);
      }
    }
  }
}

function collide(p, dx=0, dy=0, shape=p.shape){
  for(let y=0;y<shape.length;y++){
    for(let x=0;x<shape[y].length;x++){
      if(!shape[y][x]) continue;
      const nx = p.x + x + dx;
      const ny = p.y + y + dy;
      if(nx<0 || nx>=COLS || ny>=ROWS) return true;
      if(ny>=0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function merge(p){
  for(let y=0;y<p.shape.length;y++){
    for(let x=0;x<p.shape[y].length;x++){
      if(p.shape[y][x]){
        const gx = p.x + x;
        const gy = p.y + y;
        if(gy>=0) board[gy][gx] = p.color;
      }
    }
  }
}

function rotateMatrix(mat){
  const h = mat.length, w = mat[0].length;
  const out = Array.from({length:w},()=>Array(h).fill(0));
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      out[x][h-1-y] = mat[y][x];
    }
  }
  return out;
}

function rotatePiece(){
  const rotated = rotateMatrix(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for(const k of kicks){
    if(!collide(current, k, 0, rotated)){
      current.shape = rotated;
      current.x += k;
      return;
    }
  }
}

function clearLines(){
  let cleared = 0;
  for(let y=ROWS-1; y>=0; y--){
    if(board[y].every(c=>c)){
      board.splice(y,1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++;
    }
  }
  if(cleared){
    let add = 0;
    if(cleared === 1) add = 10;
    else if(cleared === 2) add = 20;
    else if(cleared === 3) add = 30;
    else if(cleared >= 4) add = 40;

    score += add;
    lines += cleared;

    const newLevel = Math.floor(lines / LINES_PER_LEVEL) + 1;
    if(newLevel !== level){
      level = newLevel;
      dropMs = Math.max(120, DROP_MS_START - (level-1)*SPEED_STEP);
      restartLoop();
    }
    updateHUD();
  }
}

function updateHUD(){
  if(elScore)  elScore.textContent  = score;
  if(elLinhas) elLinhas.textContent = lines;
}

function render(){
  drawBoard();
  drawPiece(current);
}

function gameOver() {
  running = false;
  paused = true;
  isGameOver = true;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  const gameOverDialog = document.getElementById("gameover");
  const finalScore = document.getElementById("final-score");

  render(); // Desenha o último estado

  if (gameOverDialog && finalScore) {
    finalScore.textContent = score;
    try {
      if (!gameOverDialog.open) gameOverDialog.showModal();
    } catch(e) {
      try { gameOverDialog.show(); } catch(e2){}
    }
  } else {
    alert("Game Over! Sua pontuação: " + score);
  }
}

function tick(){
  if(!running || paused || isGameOver) return;

  if(!collide(current, 0, 1)){
    current.y++;
  } else {
    // Peça aterrisou
    merge(current);
    clearLines();

    // Pega a próxima peça (que já estava na "next")
    current = nextPiece;
    // Gera uma nova "next"
    nextPiece = spawnPiece();

    // AGORA SIM: Checa colisão com a nova peça no spawn (em y:0)
    if (collide(current, 0, 0)) {
      gameOver();
      return;
    }

    drawNext();
  }

  render();
}

function startLoop(){
  if(!running || isGameOver) return;
  if(timer) clearInterval(timer);
  timer = setInterval(tick, dropMs);
}
function restartLoop(){
  if(timer) clearInterval(timer);
  timer = setInterval(tick, dropMs);
}

document.addEventListener("keydown",(e)=>{
  if(e.key.toLowerCase()==="r"){
      // Permitir Reset a qualquer momento (mesmo pausado ou game over)
      if(timer) { clearInterval(timer); timer = null; }
      resetGameState();
      startLoop();
      return; // Importante para não processar o resto
  }

  // Bloqueia ações se não estiver rodando ou se já foi game over
  if(!running || isGameOver) {
      return;
  }
  
  // Se pausado, só permite despausar (P)
  if(paused){
      if(e.key.toLowerCase()==="p"){
          paused = !paused;
      }
      return; // Bloqueia outros comandos se pausado
  }

  if(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)){
    e.preventDefault();
  }

  if(e.key === "ArrowLeft"){
    if(!collide(current, -1, 0)) current.x--;
  }else if(e.key === "ArrowRight"){
    if(!collide(current, 1, 0)) current.x++;
  }else if(e.key === "ArrowDown"){
    if(!collide(current, 0, 1)){
      current.y++;
    }
  }else if(e.key === " "){
    // hard drop
    let steps = 0;
    while(!collide(current, 0, 1)){ current.y++; steps++; }
    score += steps * 2; updateHUD();
    
    // Ações do Hard Drop (são as mesmas do "else" do tick)
    merge(current);
    clearLines();

    current = nextPiece;
    nextPiece = spawnPiece();

    if (collide(current, 0, 0)) {
      gameOver();
      return;
    }

    drawNext();
  }else if(e.key === "ArrowUp" || e.key.toLowerCase()==="e"){
    rotatePiece();
  }else if(e.key.toLowerCase()==="p"){
    paused = !paused;
  }
  render();
});

function init(){
  canvas.width  = COLS * SIZE;
  canvas.height = ROWS * SIZE;

  if (nextCanvas && !nextCanvas.width) {
      nextCanvas.width = 150;
  }
  if (nextCanvas && !nextCanvas.height) {
      nextCanvas.height = 100;
  }

  resetGameState();

  const gameOverDialog = document.getElementById("gameover");
  if(gameOverDialog){
    const btns = gameOverDialog.getElementsByTagName("button");
    for(const b of btns){
      if(b.textContent.toLowerCase().includes("jogar") || b.textContent.toLowerCase().includes("novamente")){
        b.addEventListener('click', () => {
          try { gameOverDialog.close(); } catch(e){}
          if(timer) { clearInterval(timer); timer = null; }
          resetGameState();
          startLoop();
        });
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const instructions = document.getElementById('instructions');
  const close_button = document.getElementById('close');

  if(instructions && close_button){
    try {
        instructions.showModal();
    } catch(e) {
        try { instructions.show(); } catch(e2) {}
    }

    close_button.addEventListener('click', () => {
      instructions.close();
    });

    instructions.addEventListener('click', (event) => {
      if(event.target === instructions){
        instructions.close();
      }
    });

    instructions.addEventListener('close', () => {
      if(document.getElementById("game")){
        init();
        startLoop();
      }
    });
  } else {
    if(document.getElementById("game")){
      init();
      startLoop();
    }
  }
});
