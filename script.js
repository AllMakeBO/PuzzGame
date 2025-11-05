// ==================== PuzzGame - script.js ====================
// Versão adaptada com: temporizador, pause overlay, recorde com nome salvo no localStorage
// ===============================================================

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
const elTempo = document.getElementById("tempo");
const elFinalTime = document.getElementById("final-time");

const pauseBtn = document.getElementById("pause-btn");
const resumeBtn = document.getElementById("resume-btn");
const pauseOverlay = document.getElementById("pause-overlay");
const pausedText = document.getElementById("paused-text");

const recordDisplay = document.getElementById("record-display");
const recordNameSpan = document.getElementById("record-name");

// gameover dialog elements
const gameoverDialog = document.getElementById("gameover");
const finalScoreEl = document.getElementById("final-score");
const newRecordBlock = document.getElementById("new-record-block");
const newRecordNameInput = document.getElementById("new-record-name");
const saveRecordBtn = document.getElementById("save-record-btn");
const replayBtn = document.getElementById("replay-btn");

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

// Cronômetro
let tempoInicio = null;
let tempoInterval = null;

// LocalStorage keys
const LS_KEY_SCORE = "gp_highscore";
const LS_KEY_NAME  = "gp_recordname";
const LS_KEY_PLAYER = "gp_playername";

// load record
let highScore = parseInt(localStorage.getItem(LS_KEY_SCORE)) || 0;
let recordName = localStorage.getItem(LS_KEY_NAME) || "-";
recordNameSpan.textContent = recordName;
if(recordDisplay) recordDisplay.textContent = `${highScore} (${recordName})`;

// player name (if not set, will prompt on first start)
let playerName = localStorage.getItem(LS_KEY_PLAYER) || null;

// ==================== Helpers ====================

function makeBoard(rows, cols){
  return Array.from({length: rows}, () => Array(cols).fill(0));
}
function rand(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function clone(m){ return m.map(r => r.slice()); }

// ==================== Temporizador ====================

function formatarTempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function iniciarTemporizador() {
  if (!tempoInicio) tempoInicio = Date.now();
  if (tempoInterval) clearInterval(tempoInterval);

  tempoInterval = setInterval(() => {
    if (!running || paused || isGameOver) return;
    const segundos = Math.floor((Date.now() - tempoInicio) / 1000);
    if (elTempo) elTempo.textContent = formatarTempo(segundos);
  }, 1000);
}

function pararTemporizador() {
  if (tempoInterval) {
    clearInterval(tempoInterval);
    tempoInterval = null;
  }
}

// ==================== Jogo ====================

function spawnPiece(){
  const shape = clone(rand(SHAPES));
  const color = rand(PALETTE);
  return {
    shape,
    color,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0 
  };
}

function resetGameState(){
  // ask player name first time
  if (!playerName) {
    const n = prompt("Digite seu nome (será usado para recorde):", "Jogador");
    playerName = (n && n.trim()) ? n.trim() : "Jogador";
    localStorage.setItem(LS_KEY_PLAYER, playerName);
  }

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

  // Reinicia o cronômetro
  pararTemporizador();
  if (elTempo) elTempo.textContent = "00:00";
  tempoInicio = Date.now();
  iniciarTemporizador();

  // ensure timers
  if (timer) { clearInterval(timer); timer = null; }
  startLoop();
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
  if(recordDisplay) recordDisplay.textContent = `${highScore} (${recordName})`;
}

// ==================== Render & GameOver ====================

function render(){
  drawBoard();
  drawPiece(current);
}

function gameOver() {
  running = false;
  paused = true;
  isGameOver = true;

  pararTemporizador();

  const tempoFinalSeg = Math.floor((Date.now() - tempoInicio) / 1000);
  if (elFinalTime) elFinalTime.textContent = formatarTempo(tempoFinalSeg);

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  finalScoreEl.textContent = score;

  // Se novo record, mostra bloco para salvar nome
  if (score > highScore) {
    newRecordBlock.style.display = "block";
    newRecordNameInput.value = playerName || "";
  } else {
    newRecordBlock.style.display = "none";
  }

  try {
    if (!gameoverDialog.open) gameoverDialog.showModal();
  } catch(e) {
    try { gameoverDialog.show(); } catch(e2){}
  }
}

// ==================== Loop, start/restart ====================

function tick(){
  if(!running || paused || isGameOver) return;

  if(!collide(current, 0, 1)){
    current.y++;
  } else {
    merge(current);
    clearLines();

    current = nextPiece;
    nextPiece = spawnPiece();

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

// ==================== Pause control ====================

function togglePause(){
  if (!running || isGameOver) return;

  paused = !paused;

  if (paused) {
    // pause: stop fall loop and tempo
    if (timer) { clearInterval(timer); timer = null; }
    pararTemporizador();
    if (pauseOverlay) pauseOverlay.style.display = "flex";
    if (pausedText) pausedText.style.display = "block";
    if (pauseBtn) pauseBtn.textContent = "▶ Continuar";
  } else {
    // resume: restart timers; preserve elapsed time
    // tempoInicio ajusta para continuar do ponto certo
    const elapsed = parseTempo(elTempo.textContent) * 1000;
    tempoInicio = Date.now() - elapsed;
    iniciarTemporizador();
    startLoop();
    if (pauseOverlay) pauseOverlay.style.display = "none";
    if (pausedText) pausedText.style.display = "none";
    if (pauseBtn) pauseBtn.textContent = "⏸ Pausar";
  }
}

function parseTempo(texto) {
  const parts = (texto || "00:00").split(':').map(n => parseInt(n,10) || 0);
  return parts[0]*60 + parts[1];
}

// ==================== Controles ====================

document.addEventListener("keydown",(e)=>{
  if(e.key.toLowerCase()==="r"){
      if(timer) { clearInterval(timer); timer = null; }
      resetGameState();
      return;
  }

  if(e.key.toLowerCase()==="p"){
    togglePause();
    return;
  }

  if(!running || isGameOver || paused) return;

  if(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)){
    e.preventDefault();
  }

  if(e.key === "ArrowLeft"){
    if(!collide(current, -1, 0)) current.x--;
  }else if(e.key === "ArrowRight"){
    if(!collide(current, 1, 0)) current.x++;
  }else if(e.key === "ArrowDown"){
    if(!collide(current, 0, 1)) current.y++;
  }else if(e.key === " "){
    let steps = 0;
    while(!collide(current, 0, 1)){ current.y++; steps++; }
    score += steps * 2; updateHUD();
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
  }
  render();
});

// Pause / resume buttons
if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
if (resumeBtn) resumeBtn.addEventListener('click', togglePause);

// Save new record button
if (saveRecordBtn) {
  saveRecordBtn.addEventListener('click', () => {
    const name = (newRecordNameInput.value || playerName || "Jogador").trim();
    highScore = score;
    recordName = name || "Jogador";
    localStorage.setItem(LS_KEY_SCORE, String(highScore));
    localStorage.setItem(LS_KEY_NAME, recordName);
    recordNameSpan.textContent = recordName;
    if(recordDisplay) recordDisplay.textContent = `${highScore} (${recordName})`;
    newRecordBlock.style.display = "none";
    // fecha dialog e reinicia
    try { gameoverDialog.close(); } catch(e){}
  });
}

// replay button
if (replayBtn) {
  replayBtn.addEventListener('click', () => {
    try { gameoverDialog.close(); } catch(e){}
    resetGameState();
  });
}

// ==================== Inicialização ====================

function init(){
  canvas.width  = COLS * SIZE;
  canvas.height = ROWS * SIZE;

  if (nextCanvas && !nextCanvas.width) nextCanvas.width = 150;
  if (nextCanvas && !nextCanvas.height) nextCanvas.height = 100;

  resetGameState();

  // instructions handling (preserve your original logic)
  const instructions = document.getElementById('instructions');
  const close_button = document.getElementById('close');

  if(instructions && close_button){
    try { instructions.showModal(); } catch(e) { try { instructions.show(); } catch(e2) {} }
    close_button.addEventListener('click', () => { instructions.close(); });
    instructions.addEventListener('click', (event) => {
      if(event.target === instructions){ instructions.close(); }
    });
    instructions.addEventListener('close', () => {
      if(document.getElementById("game")){
        // startLoop already called in resetGameState
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});
