// ==================== PuzzGame - script.js ====================
// Código do puzgame.html integrado ao layout do Geometry Puzzle
// ===============================================================

const COLS = 12;
const ROWS = 24;
const SIZE = 25;
const DROP_MS_START = 700;
const LINES_PER_LEVEL = 10;
const SPEED_STEP = 70;

const PALETTE = ["#53e4df","#f1b84b","#f25f5c","#b97cf6","#5cc06c","#6fb5ff","#ff8ad6","#a3f77b"];

const SHAPES = [
    [[1,1,1,1]], // I
    [[1,1],[1,1]], // O
    [[0,1,0],[1,1,1]], // T
    [[1,0,0],[1,1,1]], // L
    [[0,0,1],[1,1,1]], // J
    [[1,1,0],[0,1,1]], // S
    [[0,1,1],[1,1,0]], // Z
];

// ===================================
// === MODIFICAÇÕES EASTER EGG (Início) ===
// ===================================

let isClassicMode = false;
const CLASSIC_CODE = ["t", "8", "4"]; // A sequência secreta
let classicCodeProgress = [];        // Onde o usuário está na sequência

const CLASSIC_PALETTE = ["#0f0", "#0e0", "#0d0", "#0c0", "#0b0", "#0a0"]; // Tons de verde
const CLASSIC_BLACK = "#000";
const CLASSIC_STROKE = "#030"; // Contorno verde escuro

// Nomes dos seus arquivos de áudio originais (lidos do HTML)
const originalSounds = {
    music: "soundtrack.mp3",
    line: "line_clear.mp3",
    over: "game-over.mp3"
};

// Arquivos que VOCÊ DEVE CRIAR para o modo retrô
const classicSounds = {
    music: "soundtrack_retro.mp3", // Ex: Um chiptune
    line: "line_clear_retro.mp3",  // Ex: Um "bipe"
    over: "game_over_retro.mp3"    // Ex: Um som de "bipe" descendente
};

// ===================================
// === MODIFICAÇÕES EASTER EGG (Fim) ===
// ===================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("canvanext") || null;
const nctx = nextCanvas ? nextCanvas.getContext("2d") : null;

const elScore = document.getElementById("score");
const elLinhas = document.getElementById("linhas");
const elTempo = document.getElementById("tempo");
const elFinalTime = document.getElementById("final-time");

const pauseBtn = document.getElementById("pause-btn");
const resumeBtn = document.getElementById("resume-btn");
const pauseOverlay = document.getElementById("pause-overlay");

const recordDisplay = document.getElementById("record-display");
const recordNameSpan = document.getElementById("record-name");

// gameover dialog elements
const gameoverDialog = document.getElementById("gameover");
const finalScoreEl = document.getElementById("final-score");
const newRecordBlock = document.getElementById("new-record-block");
const newRecordNameInput = document.getElementById("new-record-name");
const saveRecordBtn = document.getElementById("save-record-btn");
const replayBtn = document.getElementById("replay-btn");

// --- ELEMENTOS DE ÁUDIO E CONFIGURAÇÕES ---
const bgMusic = document.getElementById("bg-music");
const lineClearSound = document.getElementById("line-clear-sound");
const gameOverSound = document.getElementById("game-over-sound");
const allAudio = [bgMusic, lineClearSound, gameOverSound].filter(Boolean);

// Settings elements
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const volumeSlider = document.getElementById("volume-slider");
const volumeValueSpan = document.getElementById("volume-value");
const muteCheckbox = document.getElementById("mute-checkbox");
// --- FIM ELEMENTOS ---

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
const LS_KEY_NAME = "gp_recordname";
const LS_KEY_PLAYER = "gp_playername";
const LS_KEY_VOLUME = "gp_volume";
const LS_KEY_MUTED = "gp_muted";

// load record
let highScore = parseInt(localStorage.getItem(LS_KEY_SCORE)) || 0;
let recordName = localStorage.getItem(LS_KEY_NAME) || "-";
recordNameSpan.textContent = recordName;
if(recordDisplay) recordDisplay.textContent = `${highScore} (${recordName})`;

// player name
let playerName = localStorage.getItem(LS_KEY_PLAYER) || null;

// --- ESTADOS DE ÁUDIO ---
let currentVolume = parseFloat(localStorage.getItem(LS_KEY_VOLUME)) || 0.5;
let isMuted = (localStorage.getItem(LS_KEY_MUTED) === 'true') || false;
let musicStarted = false;
// --- FIM ESTADOS ---

// ==================== Helpers ====================

function makeBoard(rows, cols){
    return Array.from({length: rows}, () => Array(cols).fill(0));
}

function rand(arr){ 
    return arr[Math.floor(Math.random() * arr.length)]; 
}

function clone(m){ 
    return m.map(r => r.slice()); 
}

// ==================== Áudio & Configurações ====================

function applyAudioSettings() {
    const effectiveVolume = isMuted ? 0 : currentVolume;
    allAudio.forEach(audio => {
        if (audio) {
            audio.volume = effectiveVolume;
            audio.muted = isMuted;
        }
    });
    
    if (volumeSlider) volumeSlider.value = currentVolume;
    if (volumeValueSpan) volumeValueSpan.textContent = `${Math.round(currentVolume * 100)}%`;
    if (muteCheckbox) muteCheckbox.checked = isMuted;
}

function saveAudioSettings() {
    localStorage.setItem(LS_KEY_VOLUME, String(currentVolume));
    localStorage.setItem(LS_KEY_MUTED, String(isMuted));
}

function unlockAudio() {
    if (musicStarted) return;
    console.log("Tentando desbloquear áudio...");

    allAudio.forEach(audio => {
        audio.play().catch(e => console.warn("Erro ao 'acordar' áudio:", e.message));
        audio.pause();
        audio.currentTime = 0;
    });
    
    playMusic();
}

function playMusic() {
    if (musicStarted && !bgMusic.paused) return;
    
    if (bgMusic && bgMusic.paused && !paused && running && !isGameOver) {
        applyAudioSettings();
        let promise = bgMusic.play();
        if (promise !== undefined) {
            promise.then(_ => {
                musicStarted = true;
                console.log("Música iniciada!");
            }).catch(e => {
                musicStarted = false;
                console.warn("Autoplay da música bloqueado. Aguardando interação.");
            });
        }
    }
}

function stopMusic() {
    if (bgMusic) bgMusic.pause();
}

function playSound(sound) {
    if (!musicStarted) {
        playMusic();
    }
    
    if (sound && !isMuted) {
        sound.currentTime = 0;
        sound.volume = currentVolume;
        sound.play().catch(e => console.warn("Erro ao tocar som:", e.message));
    }
}

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
    // MODIFICAÇÃO EASTER EGG: Escolhe da paleta correta
    const color = isClassicMode ? rand(CLASSIC_PALETTE) : rand(PALETTE);
    return {
        shape,
        color,
        x: Math.floor((COLS - shape[0].length) / 2),
        y: -shape.length
    };
}

function resetGameState(){
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
    
    stopMusic();
    musicStarted = false;
    if (bgMusic) bgMusic.currentTime = 0;
    
    updateHUD();
    drawNext();
    render();

    pararTemporizador();
    if (elTempo) elTempo.textContent = "00:00";
    tempoInicio = Date.now();
    iniciarTemporizador();
    
    if (timer) { clearInterval(timer); timer = null; }
    startLoop();
}

function drawCell(x, y, color){
    ctx.fillStyle = color;
    ctx.fillRect(x*SIZE, y*SIZE, SIZE, SIZE);
    // MODIFICAÇÃO EASTER EGG: Muda o contorno
    ctx.strokeStyle = isClassicMode ? CLASSIC_STROKE : "rgba(0,0,0,.35)";
    ctx.strokeRect(x*SIZE, y*SIZE, SIZE, SIZE);
}

function drawBoard(){
    ctx.clearRect(0,0,canvas.width, canvas.height);
    
    // MODIFICAÇÃO EASTER EGG: Desenha o fundo preto
    if (isClassicMode) {
        ctx.fillStyle = CLASSIC_BLACK;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
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
    const s = SIZE;
    nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    
    // MODIFICAÇÃO EASTER EGG: Desenha o fundo preto
    if (isClassicMode) {
        nctx.fillStyle = CLASSIC_BLACK;
        nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    }
    
    const canvasWidth = nextCanvas.width;
    const canvasHeight = nextCanvas.height;

    const pw = nextPiece.shape[0].length * s;
    const ph = nextPiece.shape.length * s;
    const offX = Math.floor((canvasWidth - pw)/2);
    const offY = Math.floor((canvasHeight - ph)/2);

    for(let y=0;y<nextPiece.shape.length;y++){
        for(let x=0;x<nextPiece.shape[y].length;x++){
            if(nextPiece.shape[y][x]){
                nctx.fillStyle = nextPiece.color; // Cor já vem correta de spawnPiece
                nctx.fillRect(offX+x*s, offY+y*s, s, s);
                // MODIFICAÇÃO EASTER EGG: Muda o contorno
                nctx.strokeStyle = isClassicMode ? CLASSIC_STROKE : "rgba(0,0,0,.35)";
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
        playSound(lineClearSound);
        
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
    if(elScore) elScore.textContent = score;
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
    isGameOver = true;

    stopMusic();
    playSound(gameOverSound);

    pararTemporizador();

    const tempoFinalSeg = Math.floor((Date.now() - tempoInicio) / 1000);
    if (elFinalTime) elFinalTime.textContent = formatarTempo(tempoFinalSeg);

    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    finalScoreEl.textContent = score;

    if (score > highScore) {
        newRecordBlock.style.display = "block";
        newRecordNameInput.value = playerName || "";
    } else {
        newRecordBlock.style.display = "none";
    }

    try {
        if (!gameoverDialog.open) gameoverDialog.showModal();
    } catch(e) {
        if (!gameoverDialog.open) gameoverDialog.showModal();

    }
}

// ==================== Loop, start/restart ====================

function tick(){
    if(!running || paused || isGameOver) return;

    if(!collide(current, 0, 1)){
        // A peça pode descer
        current.y++;
    } else { 
        // A peça colidiu (não pode descer mais)
        
        // ===================================
        // NOVA LÓGICA DE GAME OVER
        // ===================================
        // Se a peça colidiu, mas sua posição 'y' ainda é negativa,
        // significa que ela não coube inteiramente no tabuleiro.
        if (current.y < 0) {
            gameOver();
            return; // Para o jogo
        }
        // ===================================
        // FIM DA NOVA LÓGICA
        // ===================================

        // Se colidiu, mas y >= 0, é um pouso normal.
        merge(current); // Funde a peça ao tabuleiro
        clearLines(); // Limpa linhas completas

        // Pega a próxima peça
        current = nextPiece;
        nextPiece = spawnPiece();

        // (A lógica de game over original que estava aqui foi removida)

        drawNext();
    }

    render(); // Renderiza o estado atual
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

// ===================================
// === NOVA FUNÇÃO - EASTER EGG ===
// ===================================
function toggleClassicMode() {
    isClassicMode = !isClassicMode;
    console.log("Modo Clássico 1984: " + (isClassicMode ? "ATIVADO" : "DESATIVADO"));
    
    // 1. Alterna a classe CSS no body
    // Usamos document.documentElement (o <html>) para o fundo da página
    document.documentElement.classList.toggle("classic-1984", isClassicMode);
    document.body.classList.toggle("classic-1984", isClassicMode);

    // 2. Troca os sons
    const wasPlaying = musicStarted && !bgMusic.paused;
    const musicTime = bgMusic.currentTime;

    if (isClassicMode) {
        bgMusic.src = classicSounds.music;
        if (lineClearSound) lineClearSound.src = classicSounds.line;
        if (gameOverSound) gameOverSound.src = classicSounds.over;
    } else {
        bgMusic.src = originalSounds.music;
        if (lineClearSound) lineClearSound.src = originalSounds.line;
        if (gameOverSound) gameOverSound.src = originalSounds.over;
    }
    
    // Recarrega e tenta tocar a música
    allAudio.forEach(audio => audio.load());
    bgMusic.currentTime = musicTime;
    if (wasPlaying) {
        playMusic();
    }
    applyAudioSettings(); // Re-aplica volume/mudo

    // 3. Força a re-renderização do jogo com as novas cores
    render();
    drawNext();
}

// ==================== Pause/Settings control ====================

function togglePause(){
    if (!running || isGameOver) return;

    if (settingsOverlay && settingsOverlay.style.display === "flex") {
        settingsOverlay.style.display = "none";
        return;
    }

    paused = !paused;

    if (paused) {
        stopMusic();
        if (timer) { clearInterval(timer); timer = null; }
        pararTemporizador();
        if (pauseOverlay) pauseOverlay.style.display = "flex";
        if (pauseBtn) pauseBtn.textContent = "▶ Continuar";
    } else {
        playMusic();
        const elapsed = parseTempo(elTempo.textContent) * 1000;
        tempoInicio = Date.now() - elapsed;
        iniciarTemporizador();
        startLoop();
        if (pauseOverlay) pauseOverlay.style.display = "none";
        if (pauseBtn) pauseBtn.textContent = "⏸ Pausar";
    }
}

function toggleSettings() {
    if (isGameOver) return;
    const isSettingsOpen = settingsOverlay.style.display === "flex";

    if (isSettingsOpen) {
        settingsOverlay.style.display = "none";
        
        if (pauseOverlay.style.display !== "flex") {
            paused = false;
            playMusic();
            const elapsed = parseTempo(elTempo.textContent) * 1000;
            tempoInicio = Date.now() - elapsed;
            iniciarTemporizador();
            startLoop();
        }
    } else {
        settingsOverlay.style.display = "flex";
        
        if (!paused) {
            paused = true;
            stopMusic();
            if (timer) { clearInterval(timer); timer = null; }
            pararTemporizador();
        }
    }
}

function parseTempo(texto) {
    const parts = (texto || "00:00").split(':').map(n => parseInt(n,10) || 0);
    return parts[0]*60 + parts[1];
}

// ==================== Controles ====================

// (O listener 'keyup' do Easter Egg foi removido)

document.addEventListener("keydown",(e)=>{
    
    // ===================================
    // === CÓDIGO EASTER EGG (Início) ===
    // ===================================
    
    const key = e.key.toLowerCase();

    // Lógica de sequência
    // Se a tecla for a próxima da sequência, adiciona ao progresso
    if (key === CLASSIC_CODE[classicCodeProgress.length]) {
        classicCodeProgress.push(key);
    } else {
        // Se errar, reseta (mas ignora se for a primeira tecla certa de novo)
        classicCodeProgress = (key === CLASSIC_CODE[0]) ? [key] : [];
    }

    // Se o progresso estiver completo, ativa o modo!
    if (classicCodeProgress.length === CLASSIC_CODE.length) {
        console.log("CÓDIGO SECRETO ATIVADO!");
        toggleClassicMode();
        classicCodeProgress = []; // Reseta para poder usar de novo
        e.preventDefault();
        return;
    }
    
    // ===================================
    // === CÓDIGO EASTER EGG (Fim) ===
    // ===================================
    
    
    if (!musicStarted && ["arrowleft", "arrowright", "arrowdown", "arrowup", " ", "e"].includes(e.key.toLowerCase())) {
        unlockAudio();
    }

    if(e.key.toLowerCase()==="r"){
        if(timer) { clearInterval(timer); timer = null; }
        resetGameState();
        return;
    }

    if(e.key.toLowerCase()==="p"){
        togglePause();
        return;
    }
    
    if(e.key === "Escape" && settingsOverlay.style.display === "flex") {
        toggleSettings();
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
    }else if(e.key === "ArrowUp"){
        rotatePiece();
    }
    // MODIFICAÇÃO: Adicionado 'hard drop' com a tecla espaço
    else if(e.key === " "){
        while(!collide(current, 0, 1)){
            current.y++;
        }
        // Após o hard drop, forçamos o 'tick' para travar a peça imediatamente
        tick(); 
    }
    
    render();
});

// Pause / resume buttons
if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
if (resumeBtn) resumeBtn.addEventListener('click', togglePause);

// Settings listeners
if (settingsBtn) settingsBtn.addEventListener('click', toggleSettings);
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', toggleSettings);

if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        currentVolume = parseFloat(e.target.value);
        isMuted = false;
        applyAudioSettings();
        saveAudioSettings();
    });
}

if (muteCheckbox) {
    muteCheckbox.addEventListener('change', (e) => {
        isMuted = e.target.checked;
        applyAudioSettings();
        saveAudioSettings();
    });
}

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
    canvas.width = COLS * SIZE;
    canvas.height = ROWS * SIZE;

    if (nextCanvas && !nextCanvas.width) nextCanvas.width = 150;
    if (nextCanvas && !nextCanvas.height) nextCanvas.height = 100;
    
    applyAudioSettings();
    resetGameState();

    const instructions = document.getElementById('instructions');
    const close_button = document.getElementById('close');

    if(instructions && close_button){
        try { instructions.showModal(); } catch(e) { try { instructions.show(); } catch(e2) {} }
        
        close_button.addEventListener('click', () => { 
            instructions.close(); 
            unlockAudio();
        });
        
        instructions.addEventListener('click', (event) => {
            if(event.target === instructions){ 
                instructions.close(); 
                unlockAudio();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
