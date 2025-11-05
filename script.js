const COLS = 12;
const ROWS = 24;
const SIZE = 25;                // tamanho do quadrado (px)
const DROP_MS_START = 700;      // queda inicial (ms)
const LINES_PER_LEVEL = 10;
const SPEED_STEP = 70;          // aceleração por nível (ms a menos)

const PALETTE = ["#53e4df","#f1b84b","#f25f5c","#b97cf6","#5cc06c","#6fb5ff","#ff8ad6","#a3f77b"];

const SHAPES = [ // Formato das peças
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


let board = makeBoard(ROWS, COLS);
let current = spawnPiece();
let nextPiece = spawnPiece();

let score = 0;
let lines = 0;
let level = 1;
let dropMs = DROP_MS_START;
let paused = false;
let timer = null;

// Ajustes do tamanho da tela do jogo
function makeBoard(rows, cols){
  return Array.from({length: rows}, () => Array(cols).fill(0));
}
function rand(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function clone(m){ return m.map(r => r.slice()); }

function spawnPiece(){
  const shape = clone(rand(SHAPES));
  const color = rand(PALETTE);
  return {
    shape,
    color,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: -shape.length
  };
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
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  const s = SIZE;
  const pw = nextPiece.shape[0].length * s;
  const ph = nextPiece.shape.length * s;
  const offX = Math.floor((nextCanvas.width - pw)/2);
  const offY = Math.floor((nextCanvas.height - ph)/2);
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

// Função para rotação de peças
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
  // Contagem de pontos de acordo com as linhas subtraídas
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
      restartLoop(); // acelera o jogo
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

function tick(){
  if(paused) return;

  if(!collide(current, 0, 1)){
    current.y++;
  } else {
    // fixa a peça no tabuleiro
    merge(current);
    clearLines();

    // nova peça
    current = nextPiece;
    nextPiece = spawnPiece();
    drawNext();

    // se a peça já nasce colidindo: fim de jogo
    if(collide(current, 0, 0)){
      const gameOverDialog = document.getElementById("gameover");
      const finalScore = document.getElementById("final-score");
      if(gameOverDialog && finalScore){
        finalScore.textContent = score;
        gameOverDialog.showModal();
      } else {
        alert("Game Over!"); // Fallback caso o dialog não exista
      }
      clearInterval(timer); // Para o loop do jogo
      // Não reseta o jogo aqui, o reset será feito pelo botão "Jogar Novamente" no dialog
      // board = makeBoard(ROWS, COLS);
      // score = 0;
      // lines = 0;
      // level = 1;
      // dropMs = DROP_MS_START;
      // updateHUD();
    }
  }

  render();
}


function startLoop(){
  if(timer) clearInterval(timer);
  timer = setInterval(tick, dropMs);
}
function restartLoop(){
  startLoop();
}

// Comandos
document.addEventListener("keydown",(e)=>{
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
    // hard drop simples
    let steps = 0;
    while(!collide(current, 0, 1)){ current.y++; steps++; }
    score += steps * 2; updateHUD();
    merge(current);
    clearLines();
    current = nextPiece;
    nextPiece = spawnPiece();
    drawNext();
  }else if(e.key === "ArrowUp" || e.key.toLowerCase()==="e"){
    rotatePiece();
  }else if(e.key.toLowerCase()==="p"){
    paused = !paused;
  }else if(e.key.toLowerCase()==="r"){
    // reset rápido
    board = makeBoard(ROWS, COLS);
    current = spawnPiece();
    nextPiece = spawnPiece();
    score=0; lines=0; level=1; dropMs=DROP_MS_START; paused=false;
    updateHUD(); drawNext(); render(); restartLoop();
  }
  render();
});

function init(){
  canvas.width  = COLS * SIZE;
  canvas.height = ROWS * SIZE;
  updateHUD();
  drawNext();
  render();
  startLoop();
}

document.addEventListener('DOMContentLoaded', () => {
  const instructions = document.getElementById('instructions');
  const close_button = document.getElementById('close');
  
  if(instructions && close_button){
    instructions.showModal();
    
    close_button.addEventListener('click', () => {
      instructions.close();
    });
    
    instructions.addEventListener('click', (event) => {
      if(event.target === instructions){
        instructions.close();
      }
    });
    
    // Inicia o jogo após o pop-up ser fechado
    instructions.addEventListener('close', () => {
      // A função init() só deve ser chamada na página do jogo (puzgame.html)
      if(document.getElementById("game")){
        init();
      }
    });
  } else {
    // Se não houver pop-up (ex: na página do jogo), inicia o jogo imediatamente
    if(document.getElementById("game")){
      init();
    }
  }
});