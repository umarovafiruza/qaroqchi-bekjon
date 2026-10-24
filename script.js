/**
 * ====================================================================
 * "XAZINA OVCHISI" - 2D Sarguzasht O'yini
 * Toza JavaScript (Vanilla JS), Canvas 2D API va Web Audio API
 * ====================================================================
 */

// --- 1. O'YINNING GLOBALL O'ZGARUVCHILARI VA SOZLAMALARI ---
const TILE_SIZE = 40;     // Har bir katak o'lchami: 40x40 piksel
const COLS = 20;          // Ustunlar soni (800 / 40 = 20)
const ROWS = 14;          // Qatorlar soni (560 / 40 = 14)

// Katak (Tile) turlari
const TILE = {
  GRASS: 0,   // O't (piyoda yura oladi, moshina yura olmaydi)
  ROAD: 1,    // Yo'l (piyoda va moshina yura oladi)
  WALL: 2,    // Daraxt / Tosh (to'siq, hech kim o'ta olmaydi)
  COIN: 3,    // Tanga (+10 ball, +1 tanga)
  KEY: 4,     // Kalit (sandiqni ochish uchun)
  TRAP: 5,    // Tuzoq / Tikan (-1 jon)
  CHEST: 6,   // Xazina sandig'i (yutuq nuqtasi)
  SPAWN: 7,   // Qahramon boshlang'ich nuqtasi
  GEM: 8,     // Noyob Olmos (+50 ball)
  POTION: 9   // Jon dorisi (+1 jon tiklash)
};

// Canvas va uning konteksti
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM Elementlari
const menuScreen = document.getElementById('start-screen');
const instructionsModal = document.getElementById('instructions-modal');
const gamePlayArea = document.getElementById('game-play-area');
const pauseScreen = document.getElementById('pause-screen');
const winScreen = document.getElementById('win-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const damageFlash = document.getElementById('damage-flash');
const toastEl = document.getElementById('game-toast');

// HUD elementlari
const hudLivesIcons = document.getElementById('hud-lives-icons');
const hudCoins = document.getElementById('hud-coins');
const hudGems = document.getElementById('hud-gems');
const hudAmmo = document.getElementById('hud-ammo');
const hudAmmoContainer = document.getElementById('hud-ammo-container');
const hudKeyIcon = document.getElementById('hud-key-icon');
const hudRadarStatus = document.getElementById('hud-radar-status');
const hudRadarContainer = document.getElementById('hud-radar-container');
const hudFuelInner = document.getElementById('fuel-bar-inner');
const hudFuelText = document.getElementById('fuel-text');
const hudScore = document.getElementById('hud-score');
const hudEnemies = document.getElementById('hud-enemies');
const hudLevel = document.getElementById('hud-level');
const menuHighScore = document.getElementById('menu-high-score');
const btnFullscreen = document.getElementById('btn-fullscreen-toggle');
const btnRescueHud = document.getElementById('btn-rescue-hud');
const rescueHudText = document.getElementById('rescue-hud-text');

// Qutqaruv savoli (SOS) elementlari
const rescueModal = document.getElementById('rescue-modal');
const rescueCategoryBadge = document.getElementById('rescue-category-badge');
const rescueTimerNum = document.getElementById('rescue-timer-num');
const rescueTimerProgress = document.getElementById('rescue-timer-progress');
const rescueTitle = document.getElementById('rescue-title');
const rescueDesc = document.getElementById('rescue-desc');
const rescueFlagWrapper = document.getElementById('rescue-flag-wrapper');
const rescueFlagImg = document.getElementById('rescue-flag-img');
const rescueQuestionText = document.getElementById('rescue-question-text');
const rescueOptionsContainer = document.getElementById('rescue-options-container');
const rescueFeedback = document.getElementById('rescue-feedback');

// O'yin holati o'zgaruvchilari
let currentLevelIndex = 0;
let score = 0;
let coins = 0;
let gems = 0;
let lives = 3;
let ammo = 0;                  // O'qlar / patronlar soni
let hasKey = false;
let isPaused = false;
let isGameOver = false;
let isGameWon = false;
let rescueAvailable = true;    // O'yinda 1 marta qutqaruv imkoniyati
let rescueTimerInterval = null;
let rescueTimeLeft = 20;
let rescueMode = 'emergency';  // 'emergency' yoki 'manual'
let isRescueActive = false;
let rescueAnswerLocked = false;
let highScore = parseInt(localStorage.getItem('xazina_high_score') || '0', 10);
let toastTimeout = null;
let animationFrameId = null;
let lastTimestamp = 0;

// Yashirin kalit va Radar (Detektor) tizimi
let hasKeyRadar = false;       // Qaroqchida Sehrli Kalit Radari bormi?
let keyRadars = [];            // Yo'lda yotgan radar vositalari
let keyRadarSpawnTimer = 0;    // Yo'lda yangi radar paydo bo'lish taymeri
let keyRadarSpawnInterval = 12.0; // Har 12 soniyada yo'lda radar tekshiruvi
let radarBeepTimer = 0;        // Masofaga qarab signal berish taymeri
let radarAlertToastTimer = 0;  // "Kalit shu yerda!" xabari chiqish taymeri

// Klaviatura tugmalari holati
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false
};

// Dushman paydo bo'lish taymeri (sekund hisobida)
let enemySpawnTimer = 0;
let enemySpawnInterval = 7.0; // 7 soniyada bir paydo bo'ladi

// Yo'ldagi qurollar va o'qlar tizimi
let weapons = [];             // Yo'llarda yotgan qurollar (to'pponchalar)
let bullets = [];             // Otilgan o'qlar
let particles = [];           // Portlash va zarba uchqunlari
let weaponSpawnTimer = 0;     // Yangi qurol paydo bo'lish taymeri
let weaponSpawnInterval = 10.0; // Har 10 soniyada yo'lda qurol chiqishi

// --- 2. OVOZ EFFEKTLARI TIZIMI (Web Audio API) ---
let audioCtx = null;
let isMuted = false;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Oddiy sintetik tovush generatori
 */
function playSound(type) {
  if (isMuted || !audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'coin') {
      // Tanga yig'ish (chiroyli retro chirp)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12); // E6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'key') {
      // Kalit olish ohangi
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      osc.frequency.setValueAtTime(1046.50, now + 0.24);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === 'hit') {
      // Zarba yeyish / Tuzoqqa tushish
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'car_enter') {
      // Moshinaga o'tirish / o't oldirish
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(220, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'refuel') {
      // Benzin quyish (glug ovozi)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(450, now + 0.1);
      osc.frequency.linearRampToValueAtTime(350, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'crush') {
      // Dushmanni moshina bilan bosib ketish
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'win') {
      // G'alaba qozonish
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, idx) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, now + idx * 0.1);
        g.gain.setValueAtTime(0.2, now + idx * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now + idx * 0.1);
        o.stop(now + idx * 0.1 + 0.35);
      });
    } else if (type === 'gameover') {
      // Mag'lubiyat
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.5);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'shoot') {
      // O'q otish tovushi (Retro punchy pew)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(820, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.12);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'gun_pickup') {
      // Qurol olish va zaryadlash ohangi (Retro reload)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(880, now + 0.16);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (type === 'enemy_hit') {
      // Dushmanga o'q tekkanda portlash tovushi
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'alert') {
      // Dushman o'yinchini sezib qolganda (ogohlantirish !)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.06);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'gem') {
      // Olmos olish ohangi (Chiroyli billur jarang)
      const freqs = [659.25, 880, 1318.51];
      freqs.forEach((f, idx) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, now + idx * 0.06);
        g.gain.setValueAtTime(0.2, now + idx * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.24);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now + idx * 0.06);
        o.stop(now + idx * 0.06 + 0.24);
      });
    } else if (type === 'potion') {
      // Jon dorisi ichish
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.linearRampToValueAtTime(587.33, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'radar_pickup') {
      // Radarni yo'ldan olish ohangi (Yuqori texnologik chiroyli yuklanish)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.22);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.24);
    } else if (type === 'radar_beep') {
      // Radar orqali yaqinlashish signali (sonar bleep)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'radar_ping') {
      // Kalit to'g'ridan-to'g'ri yonida bo'lgandagi o'tkir ping signali!
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1318.5, now);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'rescue_open') {
      // Qutqaruv savoli ochilganda retro fanfara
      const freqs = [330, 440, 550, 660];
      freqs.forEach((f, idx) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, now + idx * 0.07);
        g.gain.setValueAtTime(0.2, now + idx * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now + idx * 0.07);
        o.stop(now + idx * 0.07 + 0.2);
      });
    } else if (type === 'correct') {
      // To'g'ri javob yangraganda g'alabali chiroyli ohang
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, idx) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, now + idx * 0.08);
        g.gain.setValueAtTime(0.25, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(now + idx * 0.08);
        o.stop(now + idx * 0.08 + 0.25);
      });
    } else if (type === 'wrong') {
      // Noto'g'ri javob buzz ohangi
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (e) {
    // Brauzer audio xatoliklarini tinch ushlash
  }
}

// --- 3. DARAJALAR (LEVELS) VA XARITALAR ---
// 20 ustun x 14 qator.
// Katak belgilari: 0=O't, 1=Yo'l, 2=Tosh/Daraxt, 3=Tanga, 4=Kalit, 5=Tuzoq, 6=Sandiq, 7=Qahramon
const LEVEL_CONFIGS = [
  // -------------------------------------------------------------
  // 1-BOSQICH: Boshlang'ich Vodiy (Oson)
  // -------------------------------------------------------------
  {
    name: "1-Bosqich: Boshlang'ich Vodiy",
    maxEnemies: 2,
    enemySpeed: 1.3,
    detectRadius: 95,
    trapsCount: 2,
    cars: [
      { col: 3, row: 4, color: '#E53935' }, // Qizil moshina
      { col: 14, row: 4, color: '#1E88E5' }, // Moviy moshina
      { col: 9, row: 11, color: '#FDD835' }  // Sariq moshina
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 0, 2, 3, 0, 0, 0, 1, 0, 0, 0, 0, 3, 2, 0, 0, 4, 2],
      [2, 0, 0, 0, 2, 0, 2, 0, 0, 1, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2],
      [2, 0, 3, 0, 0, 0, 2, 0, 0, 1, 0, 2, 0, 3, 0, 0, 0, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 3, 2],
      [2, 0, 2, 2, 0, 0, 2, 0, 0, 1, 0, 0, 2, 2, 0, 5, 0, 2, 0, 2],
      [2, 0, 0, 0, 3, 0, 2, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 2, 0, 2],
      [2, 0, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 0, 3, 0, 2, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 2, 0, 0, 2],
      [2, 0, 5, 0, 0, 2, 0, 3, 0, 1, 0, 0, 2, 0, 3, 0, 2, 0, 6, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 2-BOSQICH: Qadimiy Labirint (O'rta)
  // -------------------------------------------------------------
  {
    name: "2-Bosqich: Qadimiy Labirint",
    maxEnemies: 3,
    enemySpeed: 1.45,
    detectRadius: 105,
    trapsCount: 4,
    cars: [
      { col: 4, row: 3, color: '#8E24AA' },
      { col: 11, row: 7, color: '#43A047' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 2, 3, 0, 0, 5, 0, 2, 0, 1, 0, 0, 3, 2, 0, 0, 0, 2],
      [2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 0, 1, 0, 2, 0, 2, 0, 4, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 0, 3, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 2],
      [2, 0, 2, 0, 5, 0, 0, 2, 0, 8, 0, 1, 0, 5, 0, 0, 2, 0, 3, 2], // 8=Gem
      [2, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 1, 0, 2, 2, 0, 0, 0, 0, 2],
      [2, 2, 0, 0, 0, 2, 0, 0, 2, 0, 0, 1, 0, 0, 2, 0, 3, 2, 0, 2],
      [2, 3, 0, 5, 0, 0, 0, 2, 2, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 2],
      [2, 0, 2, 2, 0, 3, 0, 0, 2, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 3, 0, 6, 2],
      [2, 3, 0, 2, 0, 0, 0, 3, 0, 2, 0, 1, 0, 0, 0, 0, 2, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 3-BOSQICH: Zaharli Botqoqlik (Jiddiy)
  // -------------------------------------------------------------
  {
    name: "3-Bosqich: Zaharli Botqoqlik",
    maxEnemies: 4,
    enemySpeed: 1.6,
    detectRadius: 125,
    trapsCount: 5,
    cars: [
      { col: 2, row: 8, color: '#FB8C00' },
      { col: 14, row: 4, color: '#00ACC1' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 2, 5, 0, 1, 0, 3, 2, 4, 0, 0, 2, 1, 0, 5, 0, 8, 2], // 8=Gem
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 0, 0, 1, 0, 5, 0, 0, 2, 0, 0, 1, 0, 0, 2, 0, 2],
      [2, 3, 2, 0, 2, 0, 1, 0, 0, 2, 0, 0, 9, 0, 1, 0, 5, 2, 0, 2], // 9=Potion
      [2, 0, 0, 0, 2, 0, 1, 0, 2, 2, 2, 0, 2, 0, 1, 0, 0, 0, 3, 2],
      [2, 2, 5, 0, 0, 0, 1, 0, 3, 0, 0, 0, 2, 0, 1, 0, 2, 2, 0, 2],
      [2, 0, 0, 2, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 0, 0, 3, 0, 1, 0, 2, 0, 0, 2, 0, 3, 1, 0, 2, 0, 0, 2],
      [2, 0, 2, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 0, 6, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 0, 0, 0, 0, 1, 0, 8, 0, 0, 0, 0, 0, 1, 0, 0, 3, 0, 2], // 8=Gem
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 4-BOSQICH: Oltin Kanyon (Qiyin)
  // -------------------------------------------------------------
  {
    name: "4-Bosqich: Oltin Kanyon",
    maxEnemies: 5,
    enemySpeed: 1.75,
    detectRadius: 140,
    trapsCount: 6,
    cars: [
      { col: 4, row: 5, color: '#D32F2F' },
      { col: 15, row: 9, color: '#1976D2' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 0, 1, 0, 3, 0, 2, 8, 2, 0, 3, 0, 1, 0, 0, 4, 0, 2],
      [2, 0, 2, 0, 1, 0, 2, 0, 2, 0, 2, 0, 2, 0, 1, 0, 2, 2, 0, 2],
      [2, 3, 2, 0, 1, 0, 2, 5, 0, 0, 0, 5, 2, 0, 1, 0, 2, 3, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 2, 3, 2, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 1, 0, 2, 0, 0, 9, 0, 0, 2, 0, 1, 0, 2, 0, 0, 2], // 9=Potion
      [2, 5, 2, 0, 1, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 0, 2, 5, 0, 2],
      [2, 0, 0, 3, 1, 0, 0, 0, 3, 0, 3, 0, 0, 0, 1, 3, 0, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 1, 0, 2, 5, 0, 0, 0, 5, 2, 0, 1, 0, 2, 0, 6, 2],
      [2, 3, 2, 0, 1, 0, 2, 0, 2, 8, 2, 0, 2, 0, 1, 0, 2, 3, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 2, 0, 0, 0, 1, 0, 0, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 5-BOSQICH: Qora Qal'a Magistrali (Murakkab)
  // -------------------------------------------------------------
  {
    name: "5-Bosqich: Qora Qal'a Magistrali",
    maxEnemies: 6,
    enemySpeed: 1.9,
    detectRadius: 155,
    trapsCount: 7,
    cars: [
      { col: 6, row: 3, color: '#388E3C' },
      { col: 13, row: 10, color: '#F57C00' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 2, 3, 0, 1, 0, 0, 2, 4, 2, 0, 1, 0, 3, 2, 0, 0, 2],
      [2, 0, 2, 2, 5, 0, 1, 0, 2, 2, 0, 2, 2, 1, 0, 5, 2, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 0, 3, 1, 0, 0, 8, 0, 0, 0, 1, 3, 0, 0, 2, 0, 2],
      [2, 3, 2, 0, 2, 0, 1, 0, 2, 2, 2, 2, 0, 1, 0, 2, 0, 2, 3, 2],
      [2, 0, 0, 5, 2, 0, 1, 0, 2, 9, 0, 2, 0, 1, 0, 2, 5, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 0, 3, 1, 0, 2, 2, 2, 2, 0, 1, 3, 0, 0, 2, 0, 2],
      [2, 3, 2, 2, 5, 0, 1, 0, 0, 8, 0, 0, 0, 1, 0, 5, 2, 2, 3, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 0, 2, 0, 0, 1, 0, 2, 2, 2, 2, 0, 1, 0, 0, 2, 0, 6, 2],
      [2, 3, 0, 0, 0, 0, 1, 0, 0, 3, 3, 0, 0, 1, 0, 0, 0, 0, 3, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 6-BOSQICH: Yovuzlik Xarobalari (Xavfli)
  // -------------------------------------------------------------
  {
    name: "6-Bosqich: Yovuzlik Xarobalari",
    maxEnemies: 7,
    enemySpeed: 2.05,
    detectRadius: 170,
    trapsCount: 8,
    cars: [
      { col: 3, row: 4, color: '#7B1FA2' },
      { col: 16, row: 8, color: '#C2185B' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 1, 0, 3, 2, 8, 2, 0, 0, 2, 4, 2, 3, 0, 1, 0, 0, 2],
      [2, 0, 2, 1, 2, 0, 2, 0, 2, 5, 5, 2, 0, 2, 0, 2, 1, 2, 0, 2],
      [2, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 3, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 1, 0, 2, 2, 5, 0, 9, 0, 0, 5, 2, 2, 0, 1, 2, 0, 2],
      [2, 0, 2, 1, 0, 2, 3, 0, 2, 2, 2, 2, 0, 3, 2, 0, 1, 2, 0, 2],
      [2, 0, 0, 1, 0, 0, 0, 0, 2, 8, 0, 2, 0, 0, 0, 0, 1, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 1, 0, 2, 2, 0, 0, 5, 5, 0, 0, 2, 2, 0, 1, 2, 5, 2],
      [2, 0, 0, 1, 0, 0, 2, 0, 2, 2, 2, 2, 0, 2, 0, 0, 1, 0, 6, 2],
      [2, 3, 2, 1, 2, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 2, 1, 2, 3, 2],
      [2, 0, 0, 1, 0, 0, 2, 2, 0, 3, 3, 0, 2, 2, 0, 0, 1, 0, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 7-BOSQICH: Vulqon Yo'li (Juda Qiyin)
  // -------------------------------------------------------------
  {
    name: "7-Bosqich: Vulqon Yo'li",
    maxEnemies: 8,
    enemySpeed: 2.2,
    detectRadius: 185,
    trapsCount: 9,
    cars: [
      { col: 5, row: 4, color: '#D84315' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 5, 2, 3, 0, 1, 0, 8, 0, 1, 0, 3, 2, 5, 0, 4, 0, 2],
      [2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 0, 2, 2, 0, 2],
      [2, 3, 2, 0, 0, 0, 0, 1, 0, 5, 0, 1, 0, 0, 0, 0, 2, 3, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 5, 2, 0, 2, 1, 0, 9, 0, 1, 2, 0, 2, 5, 2, 0, 0, 2],
      [2, 0, 2, 0, 2, 0, 2, 1, 2, 2, 2, 1, 2, 0, 2, 0, 2, 0, 0, 2],
      [2, 0, 0, 0, 0, 3, 0, 1, 0, 0, 0, 1, 0, 3, 0, 0, 0, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 0, 2, 0, 2, 1, 0, 8, 0, 1, 2, 0, 2, 0, 2, 5, 0, 2],
      [2, 0, 2, 3, 2, 0, 2, 1, 2, 5, 2, 1, 2, 0, 2, 3, 2, 0, 6, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 0, 0, 0, 0, 0, 1, 0, 3, 3, 1, 0, 0, 0, 0, 0, 0, 3, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 8-BOSQICH: Kiber Qafas (Ekstremal)
  // -------------------------------------------------------------
  {
    name: "8-Bosqich: Kiber Qafas",
    maxEnemies: 9,
    enemySpeed: 2.4,
    detectRadius: 205,
    trapsCount: 10,
    cars: [
      { col: 2, row: 3, color: '#00E676' },
      { col: 17, row: 10, color: '#00B0FF' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 1, 0, 8, 2, 5, 0, 2, 4, 2, 0, 5, 2, 8, 1, 0, 0, 2],
      [2, 0, 2, 1, 2, 0, 2, 0, 2, 2, 0, 2, 2, 0, 2, 0, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 1, 0, 3, 2, 0, 0, 9, 0, 0, 0, 2, 3, 0, 1, 2, 0, 2],
      [2, 5, 2, 1, 2, 0, 2, 2, 5, 2, 2, 5, 2, 2, 0, 2, 1, 2, 5, 2],
      [2, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 2, 1, 2, 3, 2, 2, 0, 1, 1, 0, 2, 2, 3, 2, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 1, 0, 0, 0, 5, 0, 1, 1, 0, 5, 0, 0, 0, 1, 2, 5, 2],
      [2, 0, 2, 1, 2, 0, 2, 2, 0, 1, 1, 0, 2, 2, 0, 2, 1, 2, 6, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 0, 1, 0, 3, 0, 8, 0, 1, 1, 0, 8, 0, 3, 0, 1, 0, 3, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 9-BOSQICH: Ajdaho Darvozasi (Qaqshatqich)
  // -------------------------------------------------------------
  {
    name: "9-Bosqich: Ajdaho Darvozasi",
    maxEnemies: 10,
    enemySpeed: 2.6,
    detectRadius: 225,
    trapsCount: 11,
    cars: [
      { col: 10, row: 6, color: '#FFD600' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 5, 0, 1, 0, 3, 2, 5, 5, 2, 3, 0, 1, 0, 5, 0, 4, 2],
      [2, 0, 2, 2, 0, 1, 0, 2, 2, 8, 8, 2, 2, 0, 1, 0, 2, 2, 0, 2],
      [2, 3, 2, 0, 0, 1, 0, 0, 2, 0, 0, 2, 0, 0, 1, 0, 0, 2, 3, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 0, 2, 1, 2, 0, 0, 9, 0, 0, 2, 1, 2, 0, 2, 5, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 2, 1, 2, 5, 0, 0, 0, 5, 2, 1, 2, 0, 2, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 2, 0, 0, 1, 0, 0, 2, 8, 8, 2, 0, 0, 1, 0, 0, 2, 3, 2],
      [2, 0, 2, 2, 5, 1, 0, 2, 2, 5, 5, 2, 2, 0, 1, 5, 2, 2, 6, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 0, 0, 0, 1, 0, 3, 0, 3, 3, 0, 3, 0, 1, 0, 0, 0, 3, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 10-BOSQICH: Qaroqchilar Qirolining Qasri (MID-BOSS)
  // -------------------------------------------------------------
  {
    name: "10-Bosqich: Qaroqchilar Qirolining Qasri (MID-BOSS)",
    maxEnemies: 11,
    enemySpeed: 2.35,
    detectRadius: 185,
    trapsCount: 8,
    cars: [
      { col: 10, row: 8, color: '#E040FB' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 1, 0, 8, 0, 5, 2, 4, 0, 2, 5, 0, 8, 0, 1, 0, 0, 2],
      [2, 0, 2, 1, 2, 5, 2, 0, 2, 2, 2, 2, 0, 2, 5, 2, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 1, 0, 3, 0, 2, 8, 9, 8, 2, 0, 3, 0, 1, 2, 0, 0, 2],
      [2, 5, 2, 1, 2, 0, 2, 2, 0, 0, 0, 2, 2, 0, 2, 1, 2, 5, 0, 2],
      [2, 0, 0, 1, 0, 0, 0, 5, 0, 3, 0, 5, 0, 0, 0, 1, 0, 0, 0, 2],
      [2, 0, 2, 1, 2, 0, 2, 2, 0, 0, 0, 2, 2, 0, 2, 1, 2, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 1, 0, 3, 0, 2, 8, 9, 8, 2, 0, 3, 0, 1, 2, 5, 0, 2],
      [2, 0, 2, 1, 2, 5, 2, 0, 2, 2, 2, 2, 0, 2, 5, 2, 1, 2, 6, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 0, 1, 0, 8, 0, 5, 0, 3, 3, 0, 5, 0, 8, 0, 1, 0, 3, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 11-BOSQICH: Muzlagan Cho'qqi
  // -------------------------------------------------------------
  {
    name: "11-Bosqich: Muzlagan Cho'qqi",
    maxEnemies: 12,
    enemySpeed: 2.45,
    detectRadius: 195,
    trapsCount: 8,
    cars: [
      { col: 2, row: 4, color: '#00E5FF' },
      { col: 17, row: 8, color: '#00B0FF' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 0, 2, 8, 0, 1, 0, 3, 0, 1, 0, 0, 2, 8, 0, 0, 4, 2],
      [2, 0, 2, 0, 2, 5, 0, 1, 0, 2, 0, 1, 0, 5, 2, 0, 2, 0, 0, 2],
      [2, 3, 2, 0, 0, 0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 0, 2, 3, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 5, 2, 0, 2, 1, 0, 9, 0, 1, 2, 0, 2, 5, 2, 0, 0, 2],
      [2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 0, 2, 0, 0, 2],
      [2, 0, 0, 0, 0, 3, 0, 1, 0, 0, 0, 1, 0, 3, 0, 0, 0, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 0, 2, 0, 2, 1, 0, 8, 0, 1, 2, 0, 2, 0, 2, 5, 0, 2],
      [2, 0, 2, 3, 2, 0, 2, 1, 2, 5, 2, 1, 2, 0, 2, 3, 2, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 0, 0, 0, 0, 0, 1, 0, 3, 3, 1, 0, 0, 0, 0, 0, 0, 6, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 12-BOSQICH: Zulmat Shaxtasi
  // -------------------------------------------------------------
  {
    name: "12-Bosqich: Zulmat Shaxtasi",
    maxEnemies: 13,
    enemySpeed: 2.55,
    detectRadius: 205,
    trapsCount: 9,
    cars: [
      { col: 10, row: 3, color: '#FF9100' },
      { col: 4, row: 9, color: '#795548' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 1, 0, 3, 2, 5, 0, 1, 1, 0, 5, 2, 3, 0, 1, 0, 4, 2],
      [2, 0, 2, 1, 2, 0, 2, 0, 2, 1, 1, 2, 0, 2, 0, 2, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 1, 0, 8, 2, 0, 0, 9, 0, 0, 0, 2, 8, 0, 1, 2, 0, 2],
      [2, 5, 2, 1, 2, 0, 2, 2, 5, 2, 2, 5, 2, 2, 0, 2, 1, 2, 5, 2],
      [2, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 0, 2, 1, 2, 3, 2, 2, 0, 1, 1, 0, 2, 2, 3, 2, 1, 2, 0, 2],
      [2, 0, 2, 1, 0, 0, 0, 5, 0, 1, 1, 0, 5, 0, 0, 0, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 1, 2, 0, 2, 2, 0, 1, 1, 0, 2, 2, 0, 2, 1, 2, 0, 2],
      [2, 3, 0, 1, 0, 8, 0, 5, 0, 1, 1, 0, 5, 0, 8, 0, 1, 0, 6, 2],
      [2, 0, 2, 1, 2, 0, 0, 3, 0, 1, 1, 0, 3, 0, 0, 2, 1, 2, 0, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 13-BOSQICH: Qadimiy Piramida
  // -------------------------------------------------------------
  {
    name: "13-Bosqich: Qadimiy Piramida",
    maxEnemies: 14,
    enemySpeed: 2.65,
    detectRadius: 215,
    trapsCount: 9,
    cars: [
      { col: 5, row: 5, color: '#FFD700' },
      { col: 14, row: 9, color: '#FF6D00' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 0, 1, 0, 3, 2, 5, 0, 0, 5, 2, 3, 0, 1, 0, 0, 4, 2],
      [2, 0, 2, 0, 1, 0, 2, 2, 0, 8, 8, 0, 2, 2, 0, 1, 0, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 1, 0, 2, 0, 2, 2, 2, 2, 0, 2, 0, 1, 0, 2, 0, 2],
      [2, 3, 2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 2, 3, 2],
      [2, 0, 0, 5, 1, 0, 2, 0, 2, 9, 0, 2, 0, 2, 0, 1, 5, 0, 0, 2],
      [2, 0, 2, 0, 1, 0, 2, 0, 2, 2, 2, 2, 0, 2, 0, 1, 0, 2, 0, 2],
      [2, 3, 2, 0, 1, 0, 0, 5, 0, 8, 8, 0, 5, 0, 0, 1, 0, 2, 3, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 2, 1, 0, 2, 0, 2, 2, 2, 2, 0, 2, 0, 1, 2, 2, 0, 2],
      [2, 0, 0, 0, 1, 0, 0, 3, 0, 3, 3, 0, 3, 0, 0, 1, 0, 0, 6, 2],
      [2, 5, 2, 0, 1, 0, 2, 0, 0, 8, 8, 0, 0, 2, 0, 1, 0, 2, 5, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 14-BOSQICH: Qonli Kanyon
  // -------------------------------------------------------------
  {
    name: "14-Bosqich: Qonli Kanyon",
    maxEnemies: 15,
    enemySpeed: 2.75,
    detectRadius: 225,
    trapsCount: 10,
    cars: [
      { col: 3, row: 4, color: '#D50000' },
      { col: 16, row: 7, color: '#C51162' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 5, 0, 1, 0, 8, 2, 5, 5, 2, 8, 0, 1, 0, 5, 0, 4, 2],
      [2, 0, 2, 2, 0, 1, 0, 2, 2, 0, 0, 2, 2, 0, 1, 0, 2, 2, 0, 2],
      [2, 3, 2, 0, 0, 1, 0, 0, 2, 9, 9, 2, 0, 0, 1, 0, 0, 2, 3, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 0, 2, 1, 2, 0, 0, 3, 3, 0, 0, 2, 1, 2, 0, 2, 5, 2],
      [2, 0, 2, 0, 2, 1, 2, 5, 0, 2, 2, 0, 5, 2, 1, 2, 0, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 2, 1, 2, 0, 0, 8, 8, 0, 0, 2, 1, 2, 0, 2, 0, 2],
      [2, 5, 2, 0, 0, 1, 0, 0, 2, 5, 5, 2, 0, 0, 1, 0, 0, 2, 5, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 2, 5, 1, 0, 2, 2, 0, 0, 2, 2, 0, 1, 5, 2, 2, 0, 2],
      [2, 3, 0, 0, 0, 1, 0, 3, 0, 3, 3, 0, 3, 0, 1, 0, 0, 0, 6, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 15-BOSQICH: Titanlar Maydoni
  // -------------------------------------------------------------
  {
    name: "15-Bosqich: Titanlar Maydoni",
    maxEnemies: 16,
    enemySpeed: 2.85,
    detectRadius: 235,
    trapsCount: 10,
    cars: [
      { col: 9, row: 4, color: '#6200EA' },
      { col: 9, row: 10, color: '#00C853' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 1, 0, 8, 0, 2, 5, 3, 3, 5, 2, 0, 8, 0, 1, 0, 4, 2],
      [2, 0, 2, 1, 2, 0, 2, 2, 0, 1, 1, 0, 2, 2, 0, 2, 1, 2, 0, 2],
      [2, 3, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 3, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 1, 0, 2, 2, 5, 0, 9, 9, 0, 5, 2, 2, 0, 1, 2, 0, 2],
      [2, 5, 2, 1, 0, 2, 8, 0, 2, 1, 1, 2, 0, 8, 2, 0, 1, 2, 5, 2],
      [2, 0, 0, 1, 0, 0, 0, 0, 2, 1, 1, 2, 0, 0, 0, 0, 1, 0, 0, 2],
      [2, 5, 2, 1, 0, 2, 8, 0, 2, 1, 1, 2, 0, 8, 2, 0, 1, 2, 5, 2],
      [2, 0, 2, 1, 0, 2, 2, 5, 0, 5, 5, 0, 5, 2, 2, 0, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 3, 2],
      [2, 0, 2, 1, 2, 0, 2, 2, 0, 3, 3, 0, 2, 2, 0, 2, 1, 2, 6, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 16-BOSQICH: Kiber Neon Shaharcha
  // -------------------------------------------------------------
  {
    name: "16-Bosqich: Kiber Neon Shaharcha",
    maxEnemies: 17,
    enemySpeed: 2.95,
    detectRadius: 245,
    trapsCount: 11,
    cars: [
      { col: 4, row: 2, color: '#00E676' },
      { col: 15, row: 11, color: '#FF4081' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 4, 2],
      [2, 0, 2, 2, 1, 0, 3, 0, 2, 8, 8, 2, 0, 3, 0, 1, 2, 2, 0, 2],
      [2, 3, 0, 0, 1, 0, 2, 5, 0, 0, 0, 0, 5, 2, 0, 1, 0, 0, 3, 2],
      [2, 0, 2, 0, 1, 0, 2, 2, 0, 9, 9, 0, 2, 2, 0, 1, 0, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 0, 1, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 1, 0, 2, 5, 2],
      [2, 0, 2, 0, 1, 0, 2, 0, 2, 5, 5, 2, 0, 2, 0, 1, 0, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 1, 0, 2, 2, 0, 8, 8, 0, 2, 2, 0, 1, 0, 2, 0, 2],
      [2, 3, 0, 0, 1, 0, 2, 5, 0, 0, 0, 0, 5, 2, 0, 1, 0, 0, 3, 2],
      [2, 0, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 0, 2],
      [2, 5, 0, 0, 0, 0, 3, 0, 0, 3, 3, 0, 0, 3, 0, 0, 0, 0, 6, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 17-BOSQICH: Zaharli Vulqon O'chog'i
  // -------------------------------------------------------------
  {
    name: "17-Bosqich: Zaharli Vulqon O'chog'i",
    maxEnemies: 18,
    enemySpeed: 3.05,
    detectRadius: 255,
    trapsCount: 11,
    cars: [
      { col: 2, row: 7, color: '#DD2C00' },
      { col: 17, row: 7, color: '#FFAB00' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 1, 0, 5, 2, 3, 0, 8, 8, 0, 3, 2, 5, 0, 1, 0, 4, 2],
      [2, 0, 2, 1, 2, 0, 2, 0, 2, 5, 5, 2, 0, 2, 0, 2, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 1, 0, 2, 2, 0, 0, 9, 9, 0, 0, 2, 2, 0, 1, 2, 5, 2],
      [2, 0, 2, 1, 0, 2, 3, 0, 2, 2, 2, 2, 0, 3, 2, 0, 1, 2, 0, 2],
      [2, 0, 0, 1, 0, 0, 0, 0, 2, 8, 8, 2, 0, 0, 0, 0, 1, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 1, 0, 2, 2, 0, 0, 5, 5, 0, 0, 2, 2, 0, 1, 2, 5, 2],
      [2, 0, 0, 1, 0, 0, 2, 0, 2, 2, 2, 2, 0, 2, 0, 0, 1, 0, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 2, 1, 2, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 2, 1, 2, 3, 2],
      [2, 0, 0, 1, 0, 5, 2, 2, 0, 8, 8, 0, 2, 2, 5, 0, 1, 0, 6, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 18-BOSQICH: Soya Shahri
  // -------------------------------------------------------------
  {
    name: "18-Bosqich: Soya Shahri",
    maxEnemies: 19,
    enemySpeed: 3.15,
    detectRadius: 265,
    trapsCount: 12,
    cars: [
      { col: 6, row: 4, color: '#37474F' },
      { col: 13, row: 9, color: '#263238' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 2, 3, 0, 1, 0, 8, 2, 4, 2, 8, 0, 1, 0, 3, 2, 0, 2],
      [2, 0, 2, 2, 5, 0, 1, 0, 2, 2, 0, 2, 2, 0, 1, 0, 5, 2, 2, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 0, 3, 1, 0, 0, 9, 9, 0, 0, 0, 1, 3, 0, 0, 2, 2],
      [2, 3, 2, 0, 2, 0, 1, 0, 2, 2, 2, 2, 0, 0, 1, 0, 2, 0, 2, 2],
      [2, 5, 0, 5, 2, 0, 1, 0, 2, 5, 5, 2, 0, 0, 1, 0, 2, 5, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 0, 3, 1, 0, 2, 2, 2, 2, 0, 0, 1, 3, 0, 0, 2, 2],
      [2, 3, 2, 2, 5, 0, 1, 0, 0, 8, 8, 0, 0, 0, 1, 0, 5, 2, 3, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 0, 2, 0, 0, 1, 0, 2, 2, 2, 2, 0, 0, 1, 0, 0, 2, 0, 2],
      [2, 3, 0, 0, 5, 0, 1, 0, 0, 3, 3, 0, 0, 0, 1, 0, 5, 0, 6, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 19-BOSQICH: O'lim Vodiyi
  // -------------------------------------------------------------
  {
    name: "19-Bosqich: O'lim Vodiyi",
    maxEnemies: 21,
    enemySpeed: 3.25,
    detectRadius: 275,
    trapsCount: 13,
    cars: [
      { col: 10, row: 2, color: '#4A148C' },
      { col: 10, row: 11, color: '#D500F9' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 5, 0, 8, 2, 1, 0, 3, 3, 0, 1, 2, 8, 0, 5, 0, 4, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 0, 2, 1, 2, 0, 2, 0, 2, 0, 2],
      [2, 3, 2, 0, 0, 5, 0, 1, 0, 9, 9, 0, 1, 0, 5, 0, 0, 2, 3, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 5, 2, 0, 2, 1, 0, 5, 5, 0, 1, 2, 0, 2, 5, 2, 0, 2],
      [2, 0, 2, 0, 2, 0, 2, 1, 2, 2, 2, 2, 1, 2, 0, 2, 0, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 0, 2, 0, 2, 1, 0, 8, 8, 0, 1, 2, 0, 2, 0, 2, 5, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 3, 2, 5, 2, 1, 2, 5, 5, 2, 1, 2, 5, 2, 3, 2, 0, 2],
      [2, 3, 0, 0, 0, 0, 0, 1, 0, 3, 3, 0, 1, 0, 0, 0, 0, 0, 6, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  },

  // -------------------------------------------------------------
  // 20-BOSQICH: Qaroqchilar Imperatori Qasri (IMPERATOR BOSS FINAL!)
  // -------------------------------------------------------------
  {
    name: "20-Bosqich: Qaroqchilar Imperatori Qasri (IMPERATOR BOSS FINAL!)",
    maxEnemies: 24,
    enemySpeed: 3.45,
    detectRadius: 300,
    trapsCount: 15,
    cars: [
      { col: 5, row: 6, color: '#FFD700' },
      { col: 14, row: 6, color: '#FF1744' }
    ],
    map: [
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      [2, 7, 0, 1, 0, 8, 5, 2, 3, 4, 0, 3, 2, 5, 8, 0, 1, 0, 0, 2],
      [2, 0, 2, 1, 2, 0, 2, 2, 0, 2, 2, 0, 2, 2, 0, 2, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 1, 0, 3, 2, 5, 0, 9, 9, 0, 5, 2, 3, 0, 1, 2, 0, 2],
      [2, 5, 2, 1, 2, 0, 2, 2, 5, 2, 2, 5, 2, 2, 0, 2, 1, 2, 5, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 0, 2, 1, 2, 3, 2, 2, 0, 1, 1, 0, 2, 2, 3, 2, 1, 2, 0, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 5, 2, 1, 0, 8, 0, 5, 0, 1, 1, 0, 5, 0, 8, 0, 1, 2, 5, 2],
      [2, 0, 2, 1, 2, 0, 2, 2, 0, 1, 1, 0, 2, 2, 0, 2, 1, 2, 6, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [2, 3, 0, 1, 0, 8, 0, 5, 0, 3, 3, 0, 5, 0, 8, 0, 1, 0, 3, 2],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
    ]
  }
];

// O'yin xaritasi ishchi nusxasi (tanga olinganda yoki o'zgarganda yangilanadi)
let currentMap = [];

// --- 4. ASOSIY OBYEKTLAR: QAHRAMON, MOSHINALAR, DUSHMANLAR ---

// Qahramon (Piyoda holati)
const player = {
  x: 0,
  y: 0,
  width: 26,
  height: 26,
  speed: 2.6,                // Piyoda harakat tezligi
  inCar: false,              // Moshinadami yoki piyoda?
  currentCar: null,          // Boshqarayotgan moshina obyekti
  facing: 'down',            // Qaragan yo'nalishi ('up', 'down', 'left', 'right')
  invulnerableTime: 0,       // Zarbadan keyingi daxlsizlik vaqti (soniya)
  walkAnimTimer: 0,          // Qadam tashlash animatsiyasi
  isMoving: false
};

// Moshinalar massivi
let cars = [];

// Dushmanlar massivi
let enemies = [];

// Animatsiya uchun tanga va effektlar taymeri
let globalTick = 0;

/**
 * Toast bildirishnoma chiqarish funksiyasi
 */
function showToast(msg) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2600);
}

/**
 * HUD ko'rsatkichlarini yangilash
 */
function updateHUD() {
  // Jonlar
  let hearts = '';
  for (let i = 0; i < lives; i++) hearts += '❤️';
  hudLivesIcons.textContent = hearts || '💀';

  // Tangalar, Olmoslar, Ball va Dushmanlar
  hudCoins.textContent = coins;
  if (hudGems) hudGems.textContent = gems;
  hudScore.textContent = score;
  if (hudEnemies) {
    const lvl = LEVEL_CONFIGS[currentLevelIndex];
    hudEnemies.textContent = `${enemies.length}/${lvl ? lvl.maxEnemies : '?'}`;
  }
  hudLevel.textContent = `${currentLevelIndex + 1}/${LEVEL_CONFIGS.length}`;

  // Kalit
  if (hasKey) {
    hudKeyIcon.className = 'key-active';
  } else {
    hudKeyIcon.className = 'key-inactive';
  }

  // Radar holati
  if (hudRadarStatus) {
    if (hasKey) {
      hudRadarStatus.textContent = "Topildi! 🔑";
      hudRadarStatus.className = 'radar-off';
    } else if (!hasKeyRadar) {
      hudRadarStatus.textContent = "Yo'q";
      hudRadarStatus.className = 'radar-off';
    }
  }

  // Benzin
  if (player.inCar && player.currentCar) {
    const fuelPercent = Math.max(0, Math.floor(player.currentCar.fuel));
    hudFuelInner.style.width = `${fuelPercent}%`;
    hudFuelText.textContent = `${fuelPercent}%`;

    if (fuelPercent <= 20) {
      hudFuelInner.classList.add('low-fuel');
    } else {
      hudFuelInner.classList.remove('low-fuel');
    }
  } else {
    hudFuelInner.style.width = '0%';
    hudFuelText.textContent = '--%';
    hudFuelInner.classList.remove('low-fuel');
  }

  // O'qlar / Qurollar
  if (hudAmmo) {
    hudAmmo.textContent = ammo;
  }
  if (hudAmmoContainer) {
    if (ammo > 0) {
      hudAmmoContainer.classList.add('ammo-has-bullets');
    } else {
      hudAmmoContainer.classList.remove('ammo-has-bullets');
    }
  }

  // Yuqori ball
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('xazina_high_score', highScore);
  }
  if (menuHighScore) {
    menuHighScore.textContent = highScore;
  }

  // Qutqaruv tugmasi holatini yangilash
  updateRescueUI();

  // Agar mobil burger menyu ochiq bo'lsa uning statistikasini yangilash
  if (typeof updateBurgerStats === 'function') {
    updateBurgerStats();
  }
}

/**
 * Ekranni qizartirish zarba effekti
 */
function triggerDamageFlash() {
  damageFlash.classList.add('active');
  setTimeout(() => {
    damageFlash.classList.remove('active');
  }, 220);
}

// --- 5. O'YIN BOSQICHLARINI BOSHQARISH FUNKSIYALARI ---

/**
 * O'yinni noldan boshlash
 */
function startGame() {
  initAudio();
  currentLevelIndex = 0;
  score = 0;
  coins = 0;
  gems = 0;
  lives = 3;
  ammo = 0;
  isGameOver = false;
  isGameWon = false;
  isPaused = false;
  rescueAvailable = true;
  isRescueActive = false;
  if (rescueTimerInterval) {
    clearInterval(rescueTimerInterval);
    rescueTimerInterval = null;
  }
  updateRescueUI();

  menuScreen.classList.remove('active');
  menuScreen.classList.add('hidden');
  winScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  if (burgerModal) burgerModal.classList.add('hidden');
  gamePlayArea.classList.remove('hidden');

  loadLevel(currentLevelIndex);

  lastTimestamp = performance.now();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Muayyan darajani yuklash
 */
function loadLevel(levelIndex) {
  if (levelIndex >= LEVEL_CONFIGS.length) {
    // Barcha darajalar tugadi - Chempion!
    showFinalVictory();
    return;
  }

  const level = LEVEL_CONFIGS[levelIndex];
  hasKey = false;
  player.inCar = false;
  player.currentCar = null;
  player.invulnerableTime = 0;
  enemySpawnTimer = 0;

  // Xarita nusxasini olish (chuqur nusxa)
  currentMap = level.map.map(row => [...row]);

  // Qahramon boshlang'ich joyini aniqlash
  let spawnFound = false;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap[r][c] === TILE.SPAWN) {
        player.x = c * TILE_SIZE + (TILE_SIZE - player.width) / 2;
        player.y = r * TILE_SIZE + (TILE_SIZE - player.height) / 2;
        currentMap[r][c] = TILE.GRASS; // Spawn o'rnini o'tga aylantiramiz
        spawnFound = true;
        break;
      }
    }
    if (spawnFound) break;
  }

  // Moshinalarni joylashtirish
  cars = level.cars.map((carConf, index) => {
    // Benzin 60 dan 100 gacha tasodifiy
    const startFuel = Math.floor(Math.random() * 41) + 60;
    return {
      id: index + 1,
      x: carConf.col * TILE_SIZE + 2,
      y: carConf.row * TILE_SIZE + 4,
      width: 36,
      height: 32,
      color: carConf.color,
      fuel: startFuel,
      maxFuel: 100,
      occupied: false,
      facing: 'right', // Boshlang'ich yo'nalish
      speed: player.speed * 2.5 // Moshina 2.5 baravar tezroq
    };
  });

  // Dushmanlarni bo'shatish va daraja bo'yicha dushmanlarni yo'lga chiqarish
  enemies = [];
  enemySpawnTimer = 0;
  // Har bir bosqich oshgani sari dushmanlar tezroq qayta paydo bo'ladi (20 bosqich uchun)
  enemySpawnInterval = Math.max(1.2, 5.0 - currentLevelIndex * 0.2);

  // Darajadagi barcha dushmanlarni dastlab xaritaga joylashtirish
  for (let i = 0; i < level.maxEnemies; i++) {
    spawnEnemy();
  }

  // Yo'llarga dastlabki qurollarni joylashtirish
  weapons = [];
  bullets = [];
  particles = [];
  weaponSpawnTimer = 0;
  for (let i = 0; i < 2; i++) {
    spawnWeapon();
  }

  // Kalitni o'tlar orasida tasodifiy (random) joyga yashirish
  randomizeKeyLocation();

  // Sehrli Kalit Radari (detektor) tizimini ishga tushirish
  hasKeyRadar = false;
  keyRadars = [];
  keyRadarSpawnTimer = 0;
  radarBeepTimer = 0;
  radarAlertToastTimer = 0;
  spawnKeyRadar();

  updateHUD();
  showToast(`${level.name}! Kalit tasodifiy o'tlar tagida! Yo'ldan radarni 📡 toping!`);
}

/**
 * Kalitni xaritadagi o'tlar orasida tasodifiy (random) joyga yashirish
 */
function randomizeKeyLocation() {
  // 1. Xaritada avvaldan bor bo'lgan barcha kalitlarni tozalash (o'tga aylantirish)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap[r][c] === TILE.KEY) {
        currentMap[r][c] = TILE.GRASS;
      }
    }
  }

  // 2. Kalit yashirish uchun mos bo'lgan o't kataklarini yig'ish
  const eligibleTiles = [];
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;

  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (currentMap[r][c] === TILE.GRASS) {
        const tx = c * TILE_SIZE + TILE_SIZE / 2;
        const ty = r * TILE_SIZE + TILE_SIZE / 2;
        const dist = Math.hypot(tx - px, ty - py);

        // Moshina turgan katak bo'lmasligi
        const hasCar = cars.some(car => {
          const cCol = Math.floor((car.x + car.width / 2) / TILE_SIZE);
          const cRow = Math.floor((car.y + car.height / 2) / TILE_SIZE);
          return cCol === c && cRow === r;
        });

        // O'yinchidan kamida 110px masofada va kirish yo'li bor o't katak
        if (dist > 110 && !hasCar) {
          const neighbors = [
            currentMap[r - 1][c],
            currentMap[r + 1][c],
            currentMap[r][c - 1],
            currentMap[r][c + 1]
          ];
          const hasPassage = neighbors.some(n => n === TILE.GRASS || n === TILE.ROAD || n === TILE.COIN || n === TILE.GEM || n === TILE.POTION);
          if (hasPassage) {
            eligibleTiles.push({ r, c });
          }
        }
      }
    }
  }

  // Agar qat'iy shart bilan topilmasa, o'yinchidan 70px uzoqdagi istalgan o'tdan olamiz
  if (eligibleTiles.length === 0) {
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (currentMap[r][c] === TILE.GRASS) {
          const tx = c * TILE_SIZE + TILE_SIZE / 2;
          const ty = r * TILE_SIZE + TILE_SIZE / 2;
          if (Math.hypot(tx - px, ty - py) > 70) {
            eligibleTiles.push({ r, c });
          }
        }
      }
    }
  }

  // Tasodifiy bir katakni kalit joyi sifatida tanlash
  if (eligibleTiles.length > 0) {
    const chosen = eligibleTiles[Math.floor(Math.random() * eligibleTiles.length)];
    currentMap[chosen.r][chosen.c] = TILE.KEY;
  }
}

/**
 * Yangi dushman paydo qilish (Yo'llar bo'ylab, o'yinchidan xavfsiz masofada)
 */
function spawnEnemy() {
  const level = LEVEL_CONFIGS[currentLevelIndex];
  if (!level) return;
  if (enemies.length >= level.maxEnemies) return;

  const playerTarget = player.inCar && player.currentCar ? player.currentCar : player;
  const px = playerTarget.x;
  const py = playerTarget.y;

  // Xaritadagi yo'llar kataklarini yig'ish (o'yinchidan kamida 100px uzoqda bo'lgan)
  const candidateRoads = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap[r][c] === TILE.ROAD) {
        const tileX = c * TILE_SIZE + 6;
        const tileY = r * TILE_SIZE + 6;
        const distToPlayer = Math.hypot(tileX - px, tileY - py);

        // O'yinchidan xavfsiz masofa (kamida 100px)
        if (distToPlayer > 100) {
          // Boshqa mavjud dushmanlar bilan ustma-ust tushmasligi
          const tooCloseToEnemy = enemies.some(e => Math.hypot(e.x - tileX, e.y - tileY) < 32);
          if (!tooCloseToEnemy) {
            candidateRoads.push({ col: c, row: r, x: tileX, y: tileY });
          }
        }
      }
    }
  }

  // Agar qat'iy shart bilan topilmasa, o'yinchidan 60px uzoqdagi istalgan yo'ldan olamiz
  if (candidateRoads.length === 0) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (currentMap[r][c] === TILE.ROAD) {
          const tileX = c * TILE_SIZE + 6;
          const tileY = r * TILE_SIZE + 6;
          if (Math.hypot(tileX - px, tileY - py) > 60) {
            candidateRoads.push({ col: c, row: r, x: tileX, y: tileY });
          }
        }
      }
    }
  }

  if (candidateRoads.length === 0) return;

  const chosen = candidateRoads[Math.floor(Math.random() * candidateRoads.length)];

  // Yo'l bo'yicha to'g'ri harakat yo'nalishini tanlash
  const validDirs = [];
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];
  for (const d of dirs) {
    const nr = chosen.row + d.dy;
    const nc = chosen.col + d.dx;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && currentMap[nr][nc] === TILE.ROAD) {
      validDirs.push(d);
    }
  }
  const chosenDir = validDirs.length > 0 ? validDirs[Math.floor(Math.random() * validDirs.length)] : { dx: 1, dy: 0 };

  const isFinalBoss = (currentLevelIndex === LEVEL_CONFIGS.length - 1);
  const isMidBoss = (currentLevelIndex === 9);
  const shouldBeBoss = (isFinalBoss || isMidBoss) && !enemies.some(e => e.isBoss);

  // Bosqichga mos dushman turi (Tier) - 20 bosqich uchun
  let enemyType = 'scout';
  if (currentLevelIndex >= 3 && currentLevelIndex < 7) {
    enemyType = 'hunter'; // Zumrad yashil (4-7 bosqichlar)
  } else if (currentLevelIndex >= 7 && currentLevelIndex < 11) {
    enemyType = 'cyborg'; // Kiber oltin zirhli (8-11 bosqichlar)
  } else if (currentLevelIndex >= 11 && currentLevelIndex < 15) {
    enemyType = 'berserker'; // Qonli qizil Berserk (12-15 bosqichlar)
  } else if (currentLevelIndex >= 15) {
    enemyType = shouldBeBoss ? 'boss' : 'shadow'; // Soya va Buyuk Imperator Boss (16-20 bosqichlar)
  }

  enemies.push({
    x: chosen.x,
    y: chosen.y,
    width: shouldBeBoss ? 36 : 28,
    height: shouldBeBoss ? 36 : 28,
    speed: shouldBeBoss ? level.enemySpeed * 1.15 : level.enemySpeed,
    dirX: chosenDir.dx,
    dirY: chosenDir.dy,
    animTick: Math.random() * 10,
    state: 'patrol',
    detectRadius: shouldBeBoss ? (level.detectRadius || 240) + 35 : (level.detectRadius || 120),
    isBoss: shouldBeBoss,
    type: enemyType
  });
}

/**
 * Yo'llarda yangi qurol paydo qilish (Faqat yo'l kataklariga)
 */
function spawnWeapon() {
  const roadTiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap[r][c] === TILE.ROAD) {
        // Bu katakda qurol bormi yo'qmi tekshirish
        const hasWeapon = weapons.some(w => {
          const wCol = Math.floor(w.x / TILE_SIZE);
          const wRow = Math.floor(w.y / TILE_SIZE);
          return wCol === c && wRow === r;
        });

        // Moshinalar turgan joyni tekshirish
        const hasCar = cars.some(car => {
          const carCol = Math.floor((car.x + car.width / 2) / TILE_SIZE);
          const carRow = Math.floor((car.y + car.height / 2) / TILE_SIZE);
          return carCol === c && carRow === r;
        });

        if (!hasWeapon && !hasCar) {
          roadTiles.push({ col: c, row: r });
        }
      }
    }
  }

  if (roadTiles.length === 0) return;
  const chosen = roadTiles[Math.floor(Math.random() * roadTiles.length)];
  weapons.push({
    x: chosen.col * TILE_SIZE + 8,
    y: chosen.row * TILE_SIZE + 8,
    width: 24,
    height: 24,
    seed: Math.random() * Math.PI * 2
  });
}

/**
 * Yo'llarda Sehrli Kalit Radari (detektor) paydo qilish
 */
function spawnKeyRadar() {
  if (hasKeyRadar || hasKey) return;
  if (keyRadars.length > 0) return; // Allaqachon yo'lda radar mavjud

  const roadTiles = [];
  const px = player.inCar && player.currentCar ? player.currentCar.x : player.x;
  const py = player.inCar && player.currentCar ? player.currentCar.y : player.y;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (currentMap[r][c] === TILE.ROAD) {
        const tx = c * TILE_SIZE + 8;
        const ty = r * TILE_SIZE + 8;

        // Qurollar va o'yinchidan masofani tekshirish
        const distToPlayer = Math.hypot(tx - px, ty - py);
        const nearWeapon = weapons.some(w => Math.hypot(w.x - tx, w.y - ty) < 30);
        const nearRadar = keyRadars.some(kr => Math.hypot(kr.x - tx, kr.y - ty) < 30);

        if (distToPlayer > 80 && !nearWeapon && !nearRadar) {
          roadTiles.push({ col: c, row: r, x: tx, y: ty });
        }
      }
    }
  }

  if (roadTiles.length === 0) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (currentMap[r][c] === TILE.ROAD) {
          const tx = c * TILE_SIZE + 8;
          const ty = r * TILE_SIZE + 8;
          if (Math.hypot(tx - px, ty - py) > 40) {
            roadTiles.push({ col: c, row: r, x: tx, y: ty });
          }
        }
      }
    }
  }

  if (roadTiles.length === 0) return;

  const chosen = roadTiles[Math.floor(Math.random() * roadTiles.length)];
  keyRadars.push({
    x: chosen.x,
    y: chosen.y,
    width: 24,
    height: 24,
    seed: Math.random() * Math.PI * 2
  });
}

/**
 * Kalit radari mantiqi, yo'lda chiqishi va kalitni sezish signali
 */
function updateKeyRadar(dt) {
  // 1. Agar o'yinchida radar yo'q bo'lsa va kalit hali topilmagan bo'lsa, vaqti-vaqti bilan yo'lda chiqarish
  if (!hasKeyRadar && !hasKey && keyRadars.length === 0) {
    keyRadarSpawnTimer += dt;
    if (keyRadarSpawnTimer >= keyRadarSpawnInterval) {
      keyRadarSpawnTimer = 0;
      spawnKeyRadar();
    }
  }

  // 2. Agar o'yinchida radar bor bo'lsa va kalit hali olinmagan bo'lsa - sezish tizimi!
  if (hasKeyRadar && !hasKey) {
    if (radarAlertToastTimer > 0) {
      radarAlertToastTimer -= dt;
    }

    // Xaritadagi kalit koordinatasini topish
    let keyCol = -1, keyRow = -1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (currentMap[r][c] === TILE.KEY) {
          keyCol = c;
          keyRow = r;
          break;
        }
      }
      if (keyCol !== -1) break;
    }

    if (keyCol !== -1) {
      const playerTarget = player.inCar && player.currentCar ? player.currentCar : player;
      const px = playerTarget.x + playerTarget.width / 2;
      const py = playerTarget.y + playerTarget.height / 2;
      const kx = keyCol * TILE_SIZE + TILE_SIZE / 2;
      const ky = keyRow * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(px - kx, py - ky);

      radarBeepTimer += dt;

      if (dist < 58) {
        // TO'G'RIDAN-TO'G'RI YONIDA! "KALIT SHU YERDA!" signali
        if (hudRadarStatus) {
          hudRadarStatus.textContent = "SHU YERDA! 🔑";
          hudRadarStatus.className = 'radar-here';
        }

        // Juda tezkor ogohlantiruvchi signal (har 0.22 soniyada)
        if (radarBeepTimer >= 0.22) {
          radarBeepTimer = 0;
          playSound('radar_ping');
        }

        if (radarAlertToastTimer <= 0) {
          showToast("📡 SIGNAL: Kalit shu o'tning tagida! Qazib oling!");
          radarAlertToastTimer = 4.0;
        }
      } else if (dist < 110) {
        // JUDA YAQIN
        if (hudRadarStatus) {
          hudRadarStatus.textContent = "Yaqin! 📶📶📶";
          hudRadarStatus.className = 'radar-near';
        }

        if (radarBeepTimer >= 0.42) {
          radarBeepTimer = 0;
          playSound('radar_beep');
        }
      } else if (dist < 190) {
        // SIGNAL BOR (Yaqinlashmoqda)
        if (hudRadarStatus) {
          hudRadarStatus.textContent = "Signal bor 📶";
          hudRadarStatus.className = 'radar-active';
        }

        if (radarBeepTimer >= 0.85) {
          radarBeepTimer = 0;
          playSound('radar_beep');
        }
      } else {
        // UZOQDA (Qidirmoqda)
        if (hudRadarStatus) {
          hudRadarStatus.textContent = "Qidirmoqda 📡";
          hudRadarStatus.className = 'radar-active';
        }
      }
    }
  }
}

/**
 * Dushmanlarga qarata o'q otish
 */
function shootBullet() {
  if (isGameOver || isGameWon || isPaused) return;

  if (ammo <= 0) {
    showToast("O'q tugadi! Yo'ldan qurol 🔫 toping!");
    return;
  }

  ammo--;
  updateHUD();
  playSound('shoot');

  const inCar = player.inCar && player.currentCar;
  const dir = inCar ? player.currentCar.facing : player.facing;
  const cx = inCar ? player.currentCar.x + player.currentCar.width / 2 : player.x + player.width / 2;
  const cy = inCar ? player.currentCar.y + player.currentCar.height / 2 : player.y + player.height / 2;

  let vx = 0;
  let vy = 0;
  const speed = 7.5;
  let spawnX = cx;
  let spawnY = cy;

  if (dir === 'up') {
    vy = -speed;
    spawnY -= 14;
  } else if (dir === 'down') {
    vy = speed;
    spawnY += 14;
  } else if (dir === 'left') {
    vx = -speed;
    spawnX -= 14;
  } else {
    vx = speed;
    spawnX += 14;
  }

  bullets.push({
    x: spawnX - 3,
    y: spawnY - 3,
    width: 6,
    height: 6,
    vx: vx,
    vy: vy,
    dir: dir,
    life: 2.2
  });

  createMuzzleEffect(spawnX, spawnY, dir);
}

/**
 * O'q otilgandagi alanga zarrachalari
 */
function createMuzzleEffect(x, y, dir) {
  let ox = 0, oy = 0;
  if (dir === 'up') oy = -6;
  else if (dir === 'down') oy = 6;
  else if (dir === 'left') ox = -6;
  else ox = 6;

  for (let i = 0; i < 5; i++) {
    particles.push({
      x: x + ox,
      y: y + oy,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 3 + 1,
      color: '#FFF59D',
      life: 0.12,
      maxLife: 0.12
    });
  }
}

/**
 * Devorga o'q tekkandagi uchqunlar
 */
function createSparkEffect(x, y, color) {
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 0.5;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 2 + 1,
      color: color || '#FFEB3B',
      life: 0.2 + Math.random() * 0.15,
      maxLife: 0.35
    });
  }
}

/**
 * Dushman portlagandagi portlash effekti
 */
function createExplosionEffect(x, y) {
  const colors = ['#FF1744', '#FF9100', '#FFEA00', '#BA68C8', '#FFFFFF'];
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3.5 + 1.0;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.6
    });
  }
}

/**
 * O'qlar harakati va dushmanlar bilan to'qnashuvini tekshirish
 */
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * (dt * 60);
    b.y += b.vy * (dt * 60);
    b.life -= dt;

    // Ekrandan chiqish
    if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height || b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    // Devor bilan to'qnashuv
    const col = Math.floor((b.x + b.width / 2) / TILE_SIZE);
    const row = Math.floor((b.y + b.height / 2) / TILE_SIZE);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      if (currentMap[row][col] === TILE.WALL) {
        createSparkEffect(b.x, b.y, '#FFD54F');
        bullets.splice(i, 1);
        continue;
      }
    }

    // Dushmanlar bilan to'qnashuv
    let hitEnemy = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (rectsIntersect(b.x, b.y, b.width, b.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
        createExplosionEffect(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
        enemies.splice(j, 1);
        score += 30;
        playSound('enemy_hit');
        showToast("Dushman yo'q qilindi! (+30 ball 🎯)");
        updateHUD();
        hitEnemy = true;
        break;
      }
    }

    if (hitEnemy) {
      bullets.splice(i, 1);
      continue;
    }
  }
}

/**
 * Zarrachalarni yangilash
 */
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * (dt * 60);
    p.y += p.vy * (dt * 60);
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// --- 6. HARAKAT VA BOSHQARUV TIZIMI ---

/**
 * Piyoda qahramon harakati
 */
function movePlayer(dt) {
  let dx = 0;
  let dy = 0;

  if (keys.ArrowUp || keys.KeyW) { dy -= 1; player.facing = 'up'; }
  if (keys.ArrowDown || keys.KeyS) { dy += 1; player.facing = 'down'; }
  if (keys.ArrowLeft || keys.KeyA) { dx -= 1; player.facing = 'left'; }
  if (keys.ArrowRight || keys.KeyD) { dx += 1; player.facing = 'right'; }

  if (dx !== 0 && dy !== 0) {
    // Diagonal harakatda tezlikni normallashtirish
    dx *= 0.7071;
    dy *= 0.7071;
  }

  player.isMoving = (dx !== 0 || dy !== 0);
  if (player.isMoving) {
    player.walkAnimTimer += dt * 8;
  }

  const moveDist = player.speed * (dt * 60);

  // X o'qi bo'yicha harakat va to'qnashuv
  if (dx !== 0) {
    const nextX = player.x + dx * moveDist;
    if (!checkObstacleCollision(nextX, player.y, player.width, player.height, false)) {
      player.x = nextX;
    }
  }

  // Y o'qi bo'yicha harakat va to'qnashuv
  if (dy !== 0) {
    const nextY = player.y + dy * moveDist;
    if (!checkObstacleCollision(player.x, nextY, player.width, player.height, false)) {
      player.y = nextY;
    }
  }

  // Ekran chegaralaridan chiqib ketmaslik
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
}

/**
 * Moshinani haydash (faqat YO'L kataklarida yura oladi)
 */
function driveCar(dt) {
  const car = player.currentCar;
  if (!car) return;

  let dx = 0;
  let dy = 0;

  if (keys.ArrowUp || keys.KeyW) { dy -= 1; car.facing = 'up'; }
  if (keys.ArrowDown || keys.KeyS) { dy += 1; car.facing = 'down'; }
  if (keys.ArrowLeft || keys.KeyA) { dx -= 1; car.facing = 'left'; }
  if (keys.ArrowRight || keys.KeyD) { dx += 1; car.facing = 'right'; }

  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  const isMoving = (dx !== 0 || dy !== 0);

  // Agar benzin 0 bo'lsa moshina yurmaydi
  if (car.fuel <= 0) {
    if (isMoving) {
      showToast("Benzin tugadi! Moshinadan tush va tanga yig'");
    }
    return;
  }

  if (isMoving) {
    const moveDist = car.speed * (dt * 60);

    // Moshina FAQAT yo'l katagida yura oladi! (isCar = true)
    let moved = false;

    // X harakati
    if (dx !== 0) {
      const nextX = car.x + dx * moveDist;
      if (!checkObstacleCollision(nextX, car.y, car.width, car.height, true)) {
        car.x = nextX;
        moved = true;
      }
    }

    // Y harakati
    if (dy !== 0) {
      const nextY = car.y + dy * moveDist;
      if (!checkObstacleCollision(car.x, nextY, car.width, car.height, true)) {
        car.y = nextY;
        moved = true;
      }
    }

    // Agar harakatlangan bo'lsa benzin sarflaymiz (1 katakka taxminan 1.5 birlik)
    // 1 katak = 40px => 1.5 / 40 = 0.0375 birlik / px
    if (moved) {
      const fuelCost = moveDist * 0.038;
      car.fuel = Math.max(0, car.fuel - fuelCost);
      if (car.fuel <= 0) {
        showToast("Benzin tugadi! Moshinadan tush va tanga yig'");
      }
      updateHUD();
    }
  }

  // Ekran chegarasi
  car.x = Math.max(0, Math.min(canvas.width - car.width, car.x));
  car.y = Math.max(0, Math.min(canvas.height - car.height, car.y));

  // Qahramon pozitsiyasini moshinaga moslab turamiz
  player.x = car.x + (car.width - player.width) / 2;
  player.y = car.y + (car.height - player.height) / 2;
}

/**
 * Moshinaga o'tirish yoki undan tushish (E tugmasi)
 */
function toggleCar() {
  if (isGameOver || isGameWon || isPaused) return;

  if (player.inCar) {
    // Moshinadan tushish
    const car = player.currentCar;
    car.occupied = false;
    player.inCar = false;
    player.currentCar = null;

    // Piyodani moshina yoniga xavfsiz joylashtirish
    player.x = car.x + car.width + 4;
    player.y = car.y;

    // Agar devorga tegib qolsa, boshqa tomoniga qo'yish
    if (checkObstacleCollision(player.x, player.y, player.width, player.height, false)) {
      player.x = car.x - player.width - 4;
    }
    if (checkObstacleCollision(player.x, player.y, player.width, player.height, false)) {
      player.x = car.x;
      player.y = car.y + car.height + 4;
    }

    showToast("Moshinadan tushdingiz");
    playSound('car_enter');
    updateHUD();
  } else {
    // Qahramon yaqinidagi (1 katak / ~45px masofada) moshinani qidirish
    let nearestCar = null;
    let minDist = 50; // 1 katak atrofida

    for (const car of cars) {
      const centerX = car.x + car.width / 2;
      const centerY = car.y + car.height / 2;
      const playerCenterX = player.x + player.width / 2;
      const playerCenterY = player.y + player.height / 2;
      const dist = Math.hypot(centerX - playerCenterX, centerY - playerCenterY);

      if (dist < minDist) {
        minDist = dist;
        nearestCar = car;
      }
    }

    if (nearestCar) {
      player.inCar = true;
      player.currentCar = nearestCar;
      nearestCar.occupied = true;
      playSound('car_enter');
      showToast("Moshinaga o'tirdingiz! (2.5x tezlik)");
      updateHUD();
    } else {
      showToast("Yaqin atrofda moshina yo'q!");
    }
  }
}

/**
 * Benzin to'ldirish (F tugmasi)
 * 10 tanga evaziga +40 benzin (max 100)
 */
function refuelCar() {
  if (isGameOver || isGameWon || isPaused) return;

  // Qaysi moshinani to'ldirmoqchi ekanini aniqlash
  let targetCar = null;

  if (player.inCar && player.currentCar) {
    targetCar = player.currentCar;
  } else {
    // Moshina yonida turganini tekshirish
    let minDist = 50;
    for (const car of cars) {
      const centerX = car.x + car.width / 2;
      const centerY = car.y + car.height / 2;
      const playerCenterX = player.x + player.width / 2;
      const playerCenterY = player.y + player.height / 2;
      const dist = Math.hypot(centerX - playerCenterX, centerY - playerCenterY);
      if (dist < minDist) {
        minDist = dist;
        targetCar = car;
      }
    }
  }

  if (!targetCar) {
    showToast("Moshina yoniga boring yoki ichiga o'tiring!");
    return;
  }

  if (targetCar.fuel >= 100) {
    showToast("Benzin baki allaqachon to'la (100%)!");
    return;
  }

  if (coins < 10) {
    showToast("Tanga yetarli emas! (10 tanga kerak)");
    return;
  }

  // Yoqilg'i quyish amalga oshiriladi
  coins -= 10;
  targetCar.fuel = Math.min(100, targetCar.fuel + 40);
  playSound('refuel');
  showToast(`Benzin to'ldirildi! (+40 ⛽) Hozirgi: ${Math.floor(targetCar.fuel)}%`);
  updateHUD();
}

/**
 * To'siqlar va yo'l qoidalarini tekshirish
 * isCar = true bo'lsa, FAQAT yo'l (TILE.ROAD) kataklarida ruxsat beriladi!
 * isCar = false bo'lsa, o't va yo'lda yura oladi, lekin devor/toshdan o'ta olmaydi.
 */
function checkObstacleCollision(x, y, w, h, isCar) {
  // Obyekt egallagan kataklar doirasi
  const leftCol = Math.floor(x / TILE_SIZE);
  const rightCol = Math.floor((x + w - 1) / TILE_SIZE);
  const topRow = Math.floor(y / TILE_SIZE);
  const bottomRow = Math.floor((y + h - 1) / TILE_SIZE);

  for (let r = topRow; r <= bottomRow; r++) {
    for (let c = leftCol; c <= rightCol; c++) {
      // Xaritadan tashqari joy
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
        return true;
      }

      const tileType = currentMap[r][c];

      if (isCar) {
        // Moshina FAQAT yo'l (1) katagida bo'lishi shart!
        // O't, devor, tuzoq, toshlarga kira olmaydi!
        if (tileType !== TILE.ROAD) {
          return true;
        }
      } else {
        // Piyoda devordan (2) o'ta olmaydi
        if (tileType === TILE.WALL) {
          return true;
        }
      }
    }
  }
  return false;
}

// --- 7. DUSHMANLAR HARAKATI VA PATRUL TIZIMI ---

/**
 * Dushmanlar patrulini va AI quvishini yangilash
 */
function updateEnemies(dt) {
  // Yangi dushman chiqishi taymeri
  enemySpawnTimer += dt;
  if (enemySpawnTimer >= enemySpawnInterval) {
    enemySpawnTimer = 0;
    spawnEnemy();
  }

  // O'yinchi markaziy pozitsiyasi
  const playerTarget = player.inCar && player.currentCar ? player.currentCar : player;
  const px = playerTarget.x + playerTarget.width / 2;
  const py = playerTarget.y + playerTarget.height / 2;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.animTick += dt * 6;

    const ex = enemy.x + enemy.width / 2;
    const ey = enemy.y + enemy.height / 2;
    const dx = px - ex;
    const dy = py - ey;
    const distSq = dx * dx + dy * dy;
    const detectRadius = enemy.detectRadius || 120;
    const detectRadiusSq = detectRadius * detectRadius;
    const loseRadiusSq = detectRadiusSq * 2.25; // 1.5x masofada yo'qotadi

    // AI Sezish tekshiruvi (Detection & Aggro)
    if (distSq <= detectRadiusSq) {
      if (enemy.state !== 'chase') {
        enemy.state = 'chase';
        playSound('alert');
        showToast("Dushman sizni payqadi! 👾 Tezroq qoching yoki oting!");
      }
    } else if (distSq > loseRadiusSq && enemy.state === 'chase') {
      // O'yinchi uzoqlashib ketdi - patrulga qaytish
      enemy.state = 'patrol';
    }

    if (enemy.state === 'chase') {
      // HUJUM VA QUVISh: dushman o'yinchiga qarab to'g'ri yuguradi
      const speed = enemy.speed * 1.35; // Quvishda 1.35x tezroq
      const dist = Math.sqrt(distSq);
      let tDirX = 0;
      let tDirY = 0;
      if (dist > 1) {
        tDirX = dx / dist;
        tDirY = dy / dist;
      }

      const moveStep = speed * (dt * 60);

      // X harakati
      const nextX = enemy.x + tDirX * moveStep;
      if (!checkObstacleCollision(nextX, enemy.y, enemy.width, enemy.height, false)) {
        enemy.x = nextX;
        enemy.dirX = tDirX;
      }

      // Y harakati
      const nextY = enemy.y + tDirY * moveStep;
      if (!checkObstacleCollision(enemy.x, nextY, enemy.width, enemy.height, false)) {
        enemy.y = nextY;
        enemy.dirY = tDirY;
      }
    } else {
      // PATRUL REJIMI: dushman yo'lda aylanib yuradi
      const moveStep = enemy.speed * (dt * 60);
      const nextX = enemy.x + enemy.dirX * moveStep;
      const nextY = enemy.y + enemy.dirY * moveStep;

      const centerNextX = nextX + enemy.width / 2;
      const centerNextY = nextY + enemy.height / 2;
      const nextCol = Math.floor(centerNextX / TILE_SIZE);
      const nextRow = Math.floor(centerNextY / TILE_SIZE);

      let canMove = true;
      if (nextCol < 0 || nextCol >= COLS || nextRow < 0 || nextRow >= ROWS) {
        canMove = false;
      } else if (currentMap[nextRow][nextCol] !== TILE.ROAD) {
        canMove = false;
      }

      if (canMove) {
        enemy.x = nextX;
        enemy.y = nextY;
      } else {
        // Yo'nalishni o'zgartirish
        enemy.dirX = -enemy.dirX;
        enemy.dirY = -enemy.dirY;

        const currentCol = Math.floor((enemy.x + enemy.width / 2) / TILE_SIZE);
        const currentRow = Math.floor((enemy.y + enemy.height / 2) / TILE_SIZE);
        const possibleDirs = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ];

        for (const p of possibleDirs) {
          const checkCol = currentCol + p.dx;
          const checkRow = currentRow + p.dy;
          if (checkCol >= 0 && checkCol < COLS && checkRow >= 0 && checkRow < ROWS) {
            if (currentMap[checkRow][checkCol] === TILE.ROAD) {
              enemy.dirX = p.dx;
              enemy.dirY = p.dy;
              break;
            }
          }
        }
      }
    }
  }
}

// --- 8. TO'QNASHUVLARNI TEKSHIRISH (COLLISION DETECTION) ---

/**
 * Har xil obyektlar to'qnashuvini boshqarish
 */
function checkCollision() {
  if (isGameOver || isGameWon) return;

  // 1. Piyodaning kataklar bilan to'qnashuvi (tanga, kalit, tuzoq, sandiq)
  // Moshinada o'tirgan paytda tanga/kalit/sandiq ishlamaydi, tuzoq ham ta'sir qilmaydi!
  if (!player.inCar) {
    const centerCol = Math.floor((player.x + player.width / 2) / TILE_SIZE);
    const centerRow = Math.floor((player.y + player.height / 2) / TILE_SIZE);

    if (centerRow >= 0 && centerRow < ROWS && centerCol >= 0 && centerCol < COLS) {
      const tile = currentMap[centerRow][centerCol];

      // Tanga olish
      if (tile === TILE.COIN) {
        currentMap[centerRow][centerCol] = TILE.GRASS;
        coins += 1;
        score += 10;
        playSound('coin');
        updateHUD();
      }

      // Olmos olish (+50 ball)
      else if (tile === TILE.GEM) {
        currentMap[centerRow][centerCol] = TILE.GRASS;
        gems += 1;
        score += 50;
        playSound('gem');
        showToast("Noyob olmos topildi! 💎 (+50 ball)");
        updateHUD();
      }

      // Jon dorisi olish (+1 jon yoki +25 ball)
      else if (tile === TILE.POTION) {
        currentMap[centerRow][centerCol] = TILE.GRASS;
        if (lives < 3) {
          lives += 1;
          playSound('potion');
          showToast("Jon dorisi! ❤️ (+1 jon qaytarildi)");
        } else {
          score += 25;
          playSound('coin');
          showToast("Jon to'la! Qo'shimcha (+25 ball)");
        }
        updateHUD();
      }

      // Kalit olish (O'tlar tagidan topildi!)
      else if (tile === TILE.KEY) {
        currentMap[centerRow][centerCol] = TILE.GRASS;
        hasKey = true;
        score += 50;
        playSound('key');
        showToast("O't tagidagi yashirin kalit topildi! 🔑 Xazina sandig'iga shoshiling!");
        createSparkEffect(centerCol * TILE_SIZE + 20, centerRow * TILE_SIZE + 20, '#FFD700');
        updateHUD();
      }

      // Tuzoqqa tushish
      else if (tile === TILE.TRAP) {
        if (player.invulnerableTime <= 0) {
          lives -= 1;
          player.invulnerableTime = 1.0; // 1 soniya daxlsizlik
          triggerDamageFlash();
          playSound('hit');
          updateHUD();
          showToast("Tuzoqqa tushdingiz! (-1 jon)");

          if (lives <= 0) {
            handlePlayerDeath();
            return;
          }
        }
      }

      // Xazina sandig'iga tegish
      else if (tile === TILE.CHEST) {
        if (hasKey) {
          winLevel();
          return;
        } else {
          showToast("Sandiq qulflangan! Avval kalitni top 🔑");
        }
      }
    }
  }

  // 2. Yo'ldagi qurollarni olish (to'pponcha / patronlar)
  const px = player.inCar && player.currentCar ? player.currentCar.x : player.x;
  const py = player.inCar && player.currentCar ? player.currentCar.y : player.y;
  const pw = player.inCar && player.currentCar ? player.currentCar.width : player.width;
  const ph = player.inCar && player.currentCar ? player.currentCar.height : player.height;

  for (let i = weapons.length - 1; i >= 0; i--) {
    const w = weapons[i];
    if (rectsIntersect(px, py, pw, ph, w.x, w.y, w.width, w.height)) {
      weapons.splice(i, 1);
      ammo += 5;
      score += 15;
      playSound('gun_pickup');
      showToast("Qurol olindi! 🔫 +5 ta o'q ([Space] yoki [J] bilan oting)");
      updateHUD();
    }
  }

  // 2.5. Yo'ldagi Sehrli Kalit Radari (detektor)ni olish
  for (let i = keyRadars.length - 1; i >= 0; i--) {
    const kr = keyRadars[i];
    if (rectsIntersect(px, py, pw, ph, kr.x, kr.y, kr.width, kr.height)) {
      keyRadars.splice(i, 1);
      hasKeyRadar = true;
      score += 25;
      playSound('radar_pickup');
      showToast("Sehrli Kalit Radari olindi! 📡 O'tlardagi yashirin kalitni qidiring!");
      updateHUD();
    }
  }

  // 3. Dushmanlar bilan to'qnashuv
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    if (player.inCar && player.currentCar) {
      // Moshina va dushman to'qnashuvi
      const car = player.currentCar;
      if (rectsIntersect(car.x, car.y, car.width, car.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
        // Moshina dushmanni bosib ketadi!
        enemies.splice(i, 1);
        score += 20;
        car.fuel = Math.max(0, car.fuel - 5);
        playSound('crush');
        showToast("Dushman yo'q qilindi! (+20 ball, -5 ⛽)");
        updateHUD();
        continue;
      }
    } else {
      // Piyoda va dushman to'qnashuvi
      if (rectsIntersect(player.x, player.y, player.width, player.height, enemy.x, enemy.y, enemy.width, enemy.height)) {
        if (player.invulnerableTime <= 0) {
          lives -= 1;
          player.invulnerableTime = 1.0; // 1 soniya daxlsizlik
          triggerDamageFlash();
          playSound('hit');
          updateHUD();
          showToast("Dushman hujum qildi! (-1 jon)");

          if (lives <= 0) {
            handlePlayerDeath();
            return;
          }
        }
      }
    }
  }
}

/**
 * Ikki to'rtburchak kesishishini tekshirish yordamchi funksiyasi
 */
function rectsIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 &&
         x1 + w1 > x2 &&
         y1 < y2 + h2 &&
         y1 + h1 > y2;
}

// ==========================================================
// 8.5. QUTQARUV SAVOLLARI VA REANIMATSIYA TIZIMI (SOS / SECOND CHANCE)
// Matematika, Geografiya (Bayroqlar) va Ingliz tili aralash
// ==========================================================

const MATH_QUESTIONS = [
  { question: "14 + 18 = ?", answer: "32", options: ["32", "30", "28", "34"] },
  { question: "7 × 8 = ?", answer: "56", options: ["56", "54", "48", "64"] },
  { question: "50 - 23 = ?", answer: "27", options: ["27", "37", "23", "33"] },
  { question: "9 × 6 = ?", answer: "54", options: ["54", "45", "63", "56"] },
  { question: "64 ÷ 8 = ?", answer: "8", options: ["8", "7", "9", "6"] },
  { question: "25 + 36 = ?", answer: "61", options: ["61", "51", "65", "59"] },
  { question: "100 - 45 = ?", answer: "55", options: ["55", "65", "45", "50"] },
  { question: "6 × 7 = ?", answer: "42", options: ["42", "36", "48", "40"] },
  { question: "49 ÷ 7 = ?", answer: "7", options: ["7", "8", "6", "9"] },
  { question: "33 + 47 = ?", answer: "80", options: ["80", "70", "82", "90"] },
  { question: "80 - 35 = ?", answer: "45", options: ["45", "55", "35", "40"] },
  { question: "5 × 9 = ?", answer: "45", options: ["45", "40", "50", "35"] },
  { question: "72 ÷ 9 = ?", answer: "8", options: ["8", "9", "7", "6"] },
  { question: "15 × 3 = ?", answer: "45", options: ["45", "35", "50", "40"] },
  { question: "90 - 48 = ?", answer: "42", options: ["42", "52", "38", "48"] },
  { question: "8 × 9 = ?", answer: "72", options: ["72", "64", "81", "70"] },
  { question: "40 + 65 = ?", answer: "105", options: ["105", "95", "115", "100"] },
  { question: "36 ÷ 6 = ?", answer: "6", options: ["6", "7", "5", "8"] },
  { question: "19 + 25 = ?", answer: "44", options: ["44", "43", "45", "34"] },
  { question: "60 - 27 = ?", answer: "33", options: ["33", "43", "37", "23"] }
];

const FLAG_QUESTIONS = [
  { flagCode: "uz", question: "Bu qaysi davlat bayrog'i?", answer: "O'zbekiston", options: ["O'zbekiston", "Tojikiston", "Qozog'iston", "Ozarbayjon"] },
  { flagCode: "tr", question: "Bu qaysi davlat bayrog'i?", answer: "Turkiya", options: ["Turkiya", "Ozarbayjon", "Tunis", "Misr"] },
  { flagCode: "kz", question: "Bu qaysi davlat bayrog'i?", answer: "Qozog'iston", options: ["Qozog'iston", "Qirg'iziston", "Turkmaniston", "Mo'g'uliston"] },
  { flagCode: "ru", question: "Bu qaysi davlat bayrog'i?", answer: "Rossiya", options: ["Rossiya", "Fransiya", "Niderlandiya", "Serbiya"] },
  { flagCode: "de", question: "Bu qaysi davlat bayrog'i?", answer: "Germaniya", options: ["Germaniya", "Belgiya", "Ispaniya", "Polsha"] },
  { flagCode: "fr", question: "Bu qaysi davlat bayrog'i?", answer: "Fransiya", options: ["Fransiya", "Italiya", "Rossiya", "Niderlandiya"] },
  { flagCode: "gb", question: "Bu qaysi davlat bayrog'i?", answer: "Buyuk Britaniya", options: ["Buyuk Britaniya", "AQSH", "Avstraliya", "Yangi Zelandiya"] },
  { flagCode: "us", question: "Bu qaysi davlat bayrog'i?", answer: "AQSH", options: ["AQSH", "Buyuk Britaniya", "Kanada", "Meksika"] },
  { flagCode: "jp", question: "Bu qaysi davlat bayrog'i?", answer: "Yaponiya", options: ["Yaponiya", "Janubiy Koreya", "Xitoy", "Vetnam"] },
  { flagCode: "br", question: "Bu qaysi davlat bayrog'i?", answer: "Braziliya", options: ["Braziliya", "Argentina", "Portugaliya", "Kolumbiya"] },
  { flagCode: "ar", question: "Bu qaysi davlat bayrog'i?", answer: "Argentina", options: ["Argentina", "Urugvay", "Braziliya", "Chili"] },
  { flagCode: "es", question: "Bu qaysi davlat bayrog'i?", answer: "Ispaniya", options: ["Ispaniya", "Portugaliya", "Italiya", "Meksika"] },
  { flagCode: "it", question: "Bu qaysi davlat bayrog'i?", answer: "Italiya", options: ["Italiya", "Fransiya", "Meksika", "Irlandiya"] },
  { flagCode: "ca", question: "Bu qaysi davlat bayrog'i?", answer: "Kanada", options: ["Kanada", "AQSH", "Avstriya", "Shveysariya"] },
  { flagCode: "sa", question: "Bu qaysi davlat bayrog'i?", answer: "Saudiya Arabistoni", options: ["Saudiya Arabistoni", "BAA", "Qatar", "Eron"] },
  { flagCode: "az", question: "Bu qaysi davlat bayrog'i?", answer: "Ozarbayjon", options: ["Ozarbayjon", "Turkiya", "Turkmaniston", "Gruziya"] },
  { flagCode: "kr", question: "Bu qaysi davlat bayrog'i?", answer: "Janubiy Koreya", options: ["Janubiy Koreya", "Yaponiya", "Xitoy", "Singapur"] },
  { flagCode: "eg", question: "Bu qaysi davlat bayrog'i?", answer: "Misr", options: ["Misr", "Iroq", "Suriya", "Marokash"] },
  { flagCode: "in", question: "Bu qaysi davlat bayrog'i?", answer: "Hindiston", options: ["Hindiston", "Pokiston", "Bangladesh", "Eron"] },
  { flagCode: "au", question: "Bu qaysi davlat bayrog'i?", answer: "Avstraliya", options: ["Avstraliya", "Yangi Zelandiya", "Buyuk Britaniya", "Kanada"] }
];

const ENGLISH_QUESTIONS = [
  { question: "'Apple' so'zining tarjimasi nima?", answer: "Olma", options: ["Olma", "Nok", "Anor", "Uzum"] },
  { question: "'Book' so'zining tarjimasi nima?", answer: "Kitob", options: ["Kitob", "Daftar", "Qalam", "Parta"] },
  { question: "'Water' so'zining ma'nosi nima?", answer: "Suv", options: ["Suv", "Sharbat", "Choy", "Sut"] },
  { question: "'Car' so'zining tarjimasi nima?", answer: "Mashina", options: ["Mashina", "Velosiped", "Poezd", "Samolyot"] },
  { question: "'Sun' so'zining ma'nosi nima?", answer: "Quyosh", options: ["Quyosh", "Oy", "Yulduz", "Bulut"] },
  { question: "'Friend' so'zining tarjimasi nima?", answer: "Do'st", options: ["Do'st", "Dushman", "Oila", "Qo'shni"] },
  { question: "'House' so'zining tarjimasi nima?", answer: "Uy", options: ["Uy", "Maktab", "Bog'", "Do'kon"] },
  { question: "'Red' qaysi rang?", answer: "Qizil", options: ["Qizil", "Yashil", "Ko'k", "Sariq"] },
  { question: "'Green' qaysi rang?", answer: "Yashil", options: ["Yashil", "Moviy", "Qora", "Oq"] },
  { question: "'Blue' qaysi rang?", answer: "Ko'k", options: ["Ko'k", "Qizil", "Jigarrang", "Binafsha"] },
  { question: "'Run' fe'lining ma'nosi nima?", answer: "Yugurmoq", options: ["Yugurmoq", "O'tirmoq", "Yotmoq", "Sakramoq"] },
  { question: "'Jump' fe'lining ma'nosi nima?", answer: "Sakramoq", options: ["Sakramoq", "Suzmoq", "Yurmoq", "Qochmoq"] },
  { question: "'Good morning' nima degani?", answer: "Xayrli tong", options: ["Xayrli tong", "Xayrli tun", "Xayrli kun", "Salom"] },
  { question: "'Good night' nima degani?", answer: "Xayrli tun", options: ["Xayrli tun", "Xayrli tong", "Ko'rishguncha", "Rahmat"] },
  { question: "'Big' so'zining qarama-qarshi ma'nosi (antonomi) nima?", answer: "Small", options: ["Small", "Fast", "Long", "Strong"] },
  { question: "'Hot' so'zining antonomi (qarama-qarshisi) nima?", answer: "Cold", options: ["Cold", "Warm", "Dark", "Sweet"] },
  { question: "'Cat' so'zining ma'nosi nima?", answer: "Mushuk", options: ["Mushuk", "Kuchuk", "Ot", "Qo'y"] },
  { question: "'Dog' so'zining ma'nosi nima?", answer: "Kuchuk", options: ["Kuchuk", "Mushuk", "Bo'ri", "Tulki"] },
  { question: "'School' so'zining tarjimasi nima?", answer: "Maktab", options: ["Maktab", "Bog'cha", "Institut", "Kasalxona"] },
  { question: "'Happy' so'zining ma'nosi nima?", answer: "Xursand", options: ["Xursand", "G'amgin", "Charchagan", "Qo'rqqan"] }
];

/**
 * Massivni tasodifiy aralashtirish (Fisher-Yates shuffle)
 */
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Tasodifiy savolni tanlash (Matematika, Bayroq yoki Ingliz tili aralash)
 */
function getRandomRescueQuestion() {
  const categories = ['math', 'flag', 'english'];
  const cat = categories[Math.floor(Math.random() * categories.length)];

  if (cat === 'math') {
    const item = MATH_QUESTIONS[Math.floor(Math.random() * MATH_QUESTIONS.length)];
    return {
      category: 'math',
      badgeText: '📐 MATEMATIKA',
      flag: null,
      questionText: item.question,
      answer: item.answer,
      options: shuffleArray(item.options)
    };
  } else if (cat === 'flag') {
    const item = FLAG_QUESTIONS[Math.floor(Math.random() * FLAG_QUESTIONS.length)];
    return {
      category: 'flag',
      badgeText: '🌍 GEOGRAFIYA (BAYROQ)',
      flagCode: item.flagCode,
      questionText: item.question,
      answer: item.answer,
      options: shuffleArray(item.options)
    };
  } else {
    const item = ENGLISH_QUESTIONS[Math.floor(Math.random() * ENGLISH_QUESTIONS.length)];
    return {
      category: 'english',
      badgeText: '🇬🇧 INGLIZ TILI',
      flag: null,
      questionText: item.question,
      answer: item.answer,
      options: shuffleArray(item.options)
    };
  }
}

/**
 * Qutqaruv tugmasi interfeysini yangilash
 */
function updateRescueUI() {
  if (btnRescueHud) {
    if (rescueAvailable) {
      btnRescueHud.classList.remove('used');
      btnRescueHud.disabled = false;
      if (rescueHudText) rescueHudText.textContent = "YORDAM (1)";
    } else {
      btnRescueHud.classList.add('used');
      btnRescueHud.disabled = true;
      if (rescueHudText) rescueHudText.textContent = "ISHLATILDI";
    }
  }

  // Mobil SOS tugmasi
  const mobRescue = document.querySelector('.btn-rescue-act');
  if (mobRescue) {
    if (rescueAvailable) {
      mobRescue.classList.remove('used');
      mobRescue.disabled = false;
    } else {
      mobRescue.classList.add('used');
      mobRescue.disabled = true;
    }
  }
}

/**
 * O'yinchi joni tugaganda (o'lim xavfi)
 */
function handlePlayerDeath() {
  if (rescueAvailable) {
    triggerRescueModal('emergency');
  } else {
    gameOver();
  }
}

/**
 * O'yinchi qiyin vaziyatda o'zi SOS chaqirganda
 */
function triggerManualRescue() {
  if (isGameOver || isGameWon || isRescueActive) return;
  if (!rescueAvailable) {
    showToast("Qutqaruv imkoni ishlatib bo'lingan! (1 marta beriladi)");
    return;
  }
  triggerRescueModal('manual');
}

/**
 * Qutqaruvchi savol oynasini ochish
 */
function triggerRescueModal(mode = 'emergency') {
  if (isRescueActive) return;
  if (!rescueAvailable) {
    if (mode === 'emergency') gameOver();
    return;
  }

  isRescueActive = true;
  rescueAnswerLocked = false;
  rescueMode = mode;
  isPaused = true;

  // Sarlavha va matn
  if (mode === 'emergency') {
    rescueTitle.textContent = "🆘 OXIRGI IMKONIYAT! JONINGIZ TUGADI";
    rescueDesc.textContent = "Savolga to'g'ri javob bering va qo'shimcha jon bilan o'yinga qayting!";
  } else {
    rescueTitle.textContent = "🆘 QIYIN VAZIYAT! QUTQARUV SAVOLI";
    rescueDesc.textContent = "Qiyin vaziyatdan chiqish uchun to'g'ri javob bering (+1 jon, daxlsizlik va o'qlar)!";
  }

  rescueFeedback.className = 'rescue-feedback hidden';
  rescueFeedback.textContent = '';

  // Tasodifiy savolni tanlash
  const qData = getRandomRescueQuestion();
  rescueCategoryBadge.textContent = qData.badgeText;

  if (qData.flagCode) {
    if (rescueFlagImg) {
      rescueFlagImg.src = `flags/${qData.flagCode}.png`;
      rescueFlagImg.onerror = () => {
        rescueFlagImg.src = `https://flagcdn.com/w160/${qData.flagCode}.png`;
      };
    }
    if (rescueFlagWrapper) rescueFlagWrapper.classList.remove('hidden');
  } else {
    if (rescueFlagWrapper) rescueFlagWrapper.classList.add('hidden');
  }

  rescueQuestionText.textContent = qData.questionText;

  // Variant tugmalarini chiqarish
  rescueOptionsContainer.innerHTML = '';
  qData.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'btn rescue-btn-opt';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      handleRescueAnswer(btn, opt === qData.answer, qData.answer);
    });
    rescueOptionsContainer.appendChild(btn);
  });

  // Taymerni yoqish (20 soniya)
  rescueTimeLeft = 20;
  rescueTimerNum.textContent = rescueTimeLeft;
  rescueTimerProgress.style.width = '100%';
  if (rescueTimerInterval) clearInterval(rescueTimerInterval);

  rescueTimerInterval = setInterval(() => {
    rescueTimeLeft -= 1;
    rescueTimerNum.textContent = Math.max(0, rescueTimeLeft);
    const pct = Math.max(0, (rescueTimeLeft / 20) * 100);
    rescueTimerProgress.style.width = `${pct}%`;

    if (rescueTimeLeft <= 0) {
      clearInterval(rescueTimerInterval);
      rescueTimerInterval = null;
      if (!rescueAnswerLocked) {
        handleRescueTimeout(qData.answer);
      }
    }
  }, 1000);

  playSound('rescue_open');
  rescueModal.classList.remove('hidden');
}

/**
 * Variant bosilganda tekshirish
 */
function handleRescueAnswer(btnClicked, isCorrect, correctAnswer) {
  if (rescueAnswerLocked) return;
  rescueAnswerLocked = true;

  if (rescueTimerInterval) {
    clearInterval(rescueTimerInterval);
    rescueTimerInterval = null;
  }

  // Variantlar tugmalarini bloklash
  const allBtns = rescueOptionsContainer.querySelectorAll('.rescue-btn-opt');
  allBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent.trim() === correctAnswer.trim()) {
      b.classList.add('correct');
    }
  });

  if (isCorrect) {
    if (btnClicked) btnClicked.classList.add('correct');
    playSound('correct');
    rescueFeedback.className = 'rescue-feedback success';
    rescueFeedback.textContent = "BARAKALLA! TO'G'RI JAVOB! 🎉 SIZ QUTQARILDINGIZ!";

    rescueAvailable = false;
    updateRescueUI();

    setTimeout(() => {
      closeRescueModal();

      // Jon berish
      if (lives <= 0) {
        lives = 2; // Qayta tirilish uchun 2 ta jon
      } else {
        lives = Math.min(3, lives + 1);
      }

      // Qalqon (Daxlsizlik)
      player.invulnerableTime = 3.5;

      // Agar moshinada bo'lsa benzin qo'shish
      if (player.inCar && player.currentCar) {
        player.currentCar.fuel = Math.min(100, player.currentCar.fuel + 40);
      }

      // O'q qo'shish
      ammo += 5;

      // Dushmanlarni xavfsiz masofaga surish (xavfsiz radius yaratish)
      const px = player.x;
      const py = player.y;
      enemies.forEach(en => {
        const dist = Math.hypot(en.x - px, en.y - py);
        if (dist < 200) {
          const angle = Math.atan2(en.y - py, en.x - px);
          en.x += Math.cos(angle) * 140;
          en.y += Math.sin(angle) * 140;
          en.x = Math.max(40, Math.min(en.x, 720));
          en.y = Math.max(40, Math.min(en.y, 480));
        }
      });

      updateHUD();
      showToast("Qutqarildingiz! ❤️ +2 Jon, 🛡️ Qalqon, 🔫 +5 O'q!");
    }, 1500);
  } else {
    if (btnClicked) btnClicked.classList.add('wrong');
    playSound('wrong');
    rescueFeedback.className = 'rescue-feedback failed';
    rescueFeedback.textContent = `NOTO'G'RI! To'g'ri javob: "${correctAnswer}"`;

    rescueAvailable = false;
    updateRescueUI();

    setTimeout(() => {
      closeRescueModal();
      if (lives <= 0) {
        gameOver();
      } else {
        showToast("Qutqaruv imkoniyati boy berildi! Ehtiyot bo'ling!");
      }
    }, 1800);
  }
}

/**
 * Vaqt tugab qolganda
 */
function handleRescueTimeout(correctAnswer) {
  rescueAnswerLocked = true;
  playSound('wrong');

  const allBtns = rescueOptionsContainer.querySelectorAll('.rescue-btn-opt');
  allBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent.trim() === correctAnswer.trim()) {
      b.classList.add('correct');
    }
  });

  rescueFeedback.className = 'rescue-feedback failed';
  rescueFeedback.textContent = `VAQT TUGADI! To'g'ri javob: "${correctAnswer}"`;

  rescueAvailable = false;
  updateRescueUI();

  setTimeout(() => {
    closeRescueModal();
    if (lives <= 0) {
      gameOver();
    } else {
      showToast("Vaqt tugadi! Qutqaruv imkoni boy berildi.");
    }
  }, 1800);
}

/**
 * Qutqaruv modalini yopish
 */
function closeRescueModal() {
  rescueModal.classList.add('hidden');
  isRescueActive = false;
  isPaused = false;
  lastTimestamp = performance.now();
}

// --- 9. O'YIN TUGASHI VA YUTUQ (GAME OVER & WIN LEVEL) ---

/**
 * Mag'lubiyat holati
 */
function gameOver() {
  isGameOver = true;
  playSound('gameover');
  document.getElementById('game-over-score').textContent = score;
  document.getElementById('game-over-level').textContent = currentLevelIndex + 1;
  gameOverScreen.classList.remove('hidden');
}

/**
 * Bosqichni yutish
 */
function winLevel() {
  isGameWon = true;
  playSound('win');

  // Bonus hisoblash: qolgan jonlar * 50
  const livesBonus = lives * 50;
  score += livesBonus;
  updateHUD();

  // Yutuq oynasini to'ldirish
  const isFinalLevel = (currentLevelIndex >= LEVEL_CONFIGS.length - 1);
  const winTitle = document.getElementById('win-title');
  const winDesc = document.getElementById('win-desc');
  const btnNext = document.getElementById('btn-next-level');
  const btnRestart = document.getElementById('btn-restart-game');

  document.getElementById('win-coins-count').textContent = coins;
  document.getElementById('win-lives-bonus').textContent = `+${livesBonus} (${lives} ❤️)`;
  document.getElementById('win-total-score').textContent = score;

  if (isFinalLevel) {
    winTitle.textContent = "Chempionsiz! 🏆";
    winDesc.textContent = `Barcha ${LEVEL_CONFIGS.length} ta qiyin bosqich va Qaroqchilar Imperatori mag'lub etildi!`;
    btnNext.classList.add('hidden');
    btnRestart.classList.remove('hidden');
  } else {
    winTitle.textContent = "Tayyorman!";
    winDesc.textContent = `${currentLevelIndex + 1}-bosqich yutildi! Keyingi sarguzasht kutmoqda!`;
    btnNext.classList.remove('hidden');
    btnRestart.classList.add('hidden');
  }

  winScreen.classList.remove('hidden');
}

/**
 * Oxirgi g'alaba (Chempion)
 */
function showFinalVictory() {
  winLevel();
}

// --- 10. CHIZISH TIZIMI (CANVAS 2D PIXEL-ART) ---

/**
 * Asosiy chizish funksiyasi
 */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Xaritadagi barcha kataklarni chizish
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = currentMap[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;

      // Asosiy fon (o't yoki yo'l)
      if (tile === TILE.ROAD) {
        drawRoadTile(x, y, c, r);
      } else {
        drawGrassTile(x, y, c, r);
      }

      // O't ustidagi elementlar
      if (tile === TILE.WALL) {
        drawWallTile(x, y);
      } else if (tile === TILE.COIN) {
        drawCoinTile(x, y);
      } else if (tile === TILE.KEY) {
        drawHiddenKeyTile(x, y, c, r);
      } else if (tile === TILE.TRAP) {
        drawTrapTile(x, y);
      } else if (tile === TILE.CHEST) {
        drawChestTile(x, y);
      } else if (tile === TILE.GEM) {
        drawGemTile(x, y);
      } else if (tile === TILE.POTION) {
        drawPotionTile(x, y);
      }
    }
  }

  // 1.4. Yo'ldagi Sehrli Kalit Radarlarini (detektor) chizish
  for (const radar of keyRadars) {
    drawKeyRadar(radar);
  }

  // 1.5. Yo'ldagi qurollarni chizish
  for (const weapon of weapons) {
    drawWeapon(weapon);
  }

  // 2. Moshinalarni chizish
  for (const car of cars) {
    drawCar(car);
  }

  // 3. Dushmanlarni chizish
  for (const enemy of enemies) {
    drawEnemy(enemy);
  }

  // 4. Qahramonni chizish (agar moshinada bo'lmasa)
  if (!player.inCar) {
    drawPlayer();
  }

  // 4.5. Agar o'yinchida Radar bo'lsa va kalit qidirilayotgan bo'lsa - sonar to'lqinini chizish
  if (hasKeyRadar && !hasKey) {
    drawPlayerRadarWaves();
  }

  // 5. Otilgan o'qlarni chizish
  for (const bullet of bullets) {
    drawBullet(bullet);
  }

  // 6. Zarrachalar va vizual effektlar
  drawParticles();
}

/**
 * O't katagini chizish
 */
function drawGrassTile(x, y, c, r) {
  // Asosiy yashil rang
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  // Mayda tekstura dog'lari
  ctx.fillStyle = '#43A047';
  if ((c + r) % 2 === 0) {
    ctx.fillRect(x + 4, y + 4, 3, 3);
    ctx.fillRect(x + 24, y + 22, 3, 3);
  } else {
    ctx.fillRect(x + 16, y + 12, 3, 3);
    ctx.fillRect(x + 30, y + 28, 3, 3);
  }
}

/**
 * Yo'l katagini chizish (Sariq chiziqli asfalt)
 */
function drawRoadTile(x, y, c, r) {
  // To'q kulrang asfalt
  ctx.fillStyle = '#616161';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  // Yo'l cheti chegaralari
  ctx.fillStyle = '#424242';
  ctx.fillRect(x, y, TILE_SIZE, 2);
  ctx.fillRect(x, y + TILE_SIZE - 2, TILE_SIZE, 2);

  // O'rtadagi sariq chiziqlar (gorizontal yoki vertikal)
  const isHorizontalRoad = (currentMap[r][0] === TILE.ROAD || currentMap[r][COLS - 1] === TILE.ROAD);
  
  ctx.fillStyle = '#FFEB3B';
  if (isHorizontalRoad) {
    // Gorizontal yo'l uchun uzuq-uzuq chiziq
    if (c % 2 === 0) {
      ctx.fillRect(x + 4, y + TILE_SIZE / 2 - 2, TILE_SIZE - 8, 4);
    }
  } else {
    // Vertikal yo'l uchun uzuq-uzuq chiziq
    if (r % 2 === 0) {
      ctx.fillRect(x + TILE_SIZE / 2 - 2, y + 4, 4, TILE_SIZE - 8);
    }
  }
}

/**
 * Tosh yoki Daraxt (To'siq)
 */
function drawWallTile(x, y) {
  // Tosh devor
  ctx.fillStyle = '#757575';
  ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);

  // Tosh ustidagi soyalar va yoriqlar (pixel-art)
  ctx.fillStyle = '#9E9E9E';
  ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, 8);

  ctx.fillStyle = '#424242';
  ctx.fillRect(x + 4, y + TILE_SIZE - 8, TILE_SIZE - 8, 4);
  ctx.fillRect(x + 18, y + 14, 4, 12);
}

/**
 * Aylanadigan tanga chizish
 */
function drawCoinTile(x, y) {
  const cx = x + TILE_SIZE / 2;
  const cy = y + TILE_SIZE / 2;
  const scaleX = Math.abs(Math.sin(globalTick * 0.08));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(0.2, scaleX), 1);

  // Tanga tashqi qismi
  ctx.fillStyle = '#FFC107';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();

  // Tanga ichki yaltirashi
  ctx.fillStyle = '#FFE082';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Kalit chizish
 */
function drawKeyTile(x, y) {
  const cx = x + TILE_SIZE / 2;
  const cy = y + TILE_SIZE / 2 + Math.sin(globalTick * 0.08) * 3;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = '#FFD54F';
  // Kalit halqasi
  ctx.beginPath();
  ctx.arc(-5, 0, 7, 0, Math.PI * 2);
  ctx.fill();

  // Ichki teshigi
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.arc(-5, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  // Kalit tayog'i va tishlari
  ctx.fillStyle = '#FFD54F';
  ctx.fillRect(2, -2, 12, 4);
  ctx.fillRect(9, 2, 3, 5);
  ctx.fillRect(13, 2, 3, 4);

  ctx.restore();
}

/**
 * O'tlar tagida yashiringan kalit katagini chizish
 */
function drawHiddenKeyTile(x, y, c, r) {
  // 1. Asosiy o't qatlami
  drawGrassTile(x, y, c, r);

  const kx = x + TILE_SIZE / 2;
  const ky = y + TILE_SIZE / 2;

  const playerTarget = player.inCar && player.currentCar ? player.currentCar : player;
  const px = playerTarget.x + playerTarget.width / 2;
  const py = playerTarget.y + playerTarget.height / 2;
  const dist = Math.hypot(px - kx, py - ky);

  // Agar o'yinchida RADAR bo'lsa va kalitga yaqin kelsa:
  if (hasKeyRadar && !hasKey) {
    if (dist < 58) {
      // TO'G'RIDAN-TO'G'RI YONIDA! "KALIT SHU YERDA!" signali
      ctx.save();
      const pulse = (Math.sin(globalTick * 0.25) + 1) * 0.5;

      // Oltin aylanuvchi sonar nuri
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(kx, ky, 18 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();

      // Qizil-oltin nurlanish markazi
      ctx.fillStyle = `rgba(255, 235, 59, ${0.45 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(kx, ky, 13, 0, Math.PI * 2);
      ctx.fill();

      // O't orasidan kalit ko'rinishi
      drawKeyTile(x, y);

      // Bosh ustida ko'rsatkich va "KALIT SHU YERDA! 🔑"
      const bounce = Math.sin(globalTick * 0.2) * 3;
      ctx.fillStyle = '#FF1744';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⬇️ KALIT SHU YERDA! 🔑', kx, y - 5 + bounce);

      ctx.restore();
    } else if (dist < 110) {
      // YAQINLASHGANDA: O't ustida chaqnash to'lqinlari
      ctx.save();
      const pulse = (Math.sin(globalTick * 0.18) + 1) * 0.5;
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(kx, ky, 15 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();

      // O't ichida mayda oltin uchqun
      ctx.fillStyle = '#FFEB3B';
      ctx.fillRect(kx - 2, ky - 2, 4, 4);
      ctx.restore();
    } else {
      // Radar bor, lekin uzoqda: o't tagida yashirin sirli maysa
      ctx.fillStyle = '#388E3C';
      ctx.fillRect(x + 12, y + 14, 4, 4);
    }
  } else {
    // Radarsiz: kalit butunlay o'tlar ostida yashiringan
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(x + 14, y + 14, 4, 4);
    ctx.fillRect(x + 22, y + 20, 3, 3);
  }
}

/**
 * Yo'lda yotgan Sehrli Kalit Radari (detektor)ni chizish
 */
function drawKeyRadar(r) {
  const floatOffset = Math.sin(globalTick * 0.09 + r.seed) * 2.5;
  const rx = r.x;
  const ry = r.y + floatOffset;

  ctx.save();

  // Moviy/tsian yorqin auro (Halo glow)
  const pulse = Math.sin(globalTick * 0.15) * 3;
  ctx.fillStyle = 'rgba(0, 229, 255, 0.32)';
  ctx.beginPath();
  ctx.arc(rx + 12, ry + 12, 14 + pulse, 0, Math.PI * 2);
  ctx.fill();

  // Radar likobchasi (dish/scanner)
  ctx.fillStyle = '#00B0FF';
  ctx.beginPath();
  ctx.arc(rx + 12, ry + 10, 8, Math.PI * 0.1, Math.PI * 0.9, true);
  ctx.fill();

  // Radar tayog'i / metall stend
  ctx.fillStyle = '#B0BEC5';
  ctx.fillRect(rx + 11, ry + 10, 2, 7);
  ctx.fillRect(rx + 8, ry + 17, 8, 3);

  // Yonib-o'chuvchi signal diodi (Qizil/Yashil LED)
  const ledOn = Math.floor(globalTick * 0.2) % 2 === 0;
  ctx.fillStyle = ledOn ? '#00E676' : '#FF1744';
  ctx.beginPath();
  ctx.arc(rx + 12, ry + 6, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // "📡 RADAR" matni
  ctx.fillStyle = '#00E5FF';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('📡 RADAR', rx + 12, ry - 3);

  ctx.restore();
}

/**
 * Radar faol bo'lganda o'yinchi atrofidagi sonar to'lqinlarini chizish
 */
function drawPlayerRadarWaves() {
  const playerTarget = player.inCar && player.currentCar ? player.currentCar : player;
  const px = playerTarget.x + playerTarget.width / 2;
  const py = playerTarget.y + playerTarget.height / 2;

  // Radar to'lqini (kengayuvchi ko'k/tsian doira)
  const waveCycle = (globalTick % 50) / 50; // 0..1
  const waveRadius = 15 + waveCycle * 80;
  const waveAlpha = Math.max(0, 0.45 * (1 - waveCycle));

  ctx.save();
  ctx.strokeStyle = `rgba(0, 229, 255, ${waveAlpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, waveRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Tuzoq / Tikan chizish
 */
function drawTrapTile(x, y) {
  // Metall asos
  ctx.fillStyle = '#424242';
  ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);

  // O'tkir qizil tikanlar
  ctx.fillStyle = '#E53935';
  const spikeOffset = Math.sin(globalTick * 0.1) > 0 ? 0 : 2;

  // 4 ta tikan uchi
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 12 + spikeOffset);
  ctx.lineTo(x + 15, y + 6 + spikeOffset);
  ctx.lineTo(x + 18, y + 12 + spikeOffset);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 24, y + 12 + spikeOffset);
  ctx.lineTo(x + 27, y + 6 + spikeOffset);
  ctx.lineTo(x + 30, y + 12 + spikeOffset);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 12, y + 26 - spikeOffset);
  ctx.lineTo(x + 15, y + 32 - spikeOffset);
  ctx.lineTo(x + 18, y + 26 - spikeOffset);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 24, y + 26 - spikeOffset);
  ctx.lineTo(x + 27, y + 32 - spikeOffset);
  ctx.lineTo(x + 30, y + 26 - spikeOffset);
  ctx.fill();
}

/**
 * Xazina sandig'i chizish
 */
function drawChestTile(x, y) {
  const cx = x + 4;
  const cy = y + 6;

  // Sandiq tanasi (jigarrang yog'och)
  ctx.fillStyle = '#795548';
  ctx.fillRect(cx, cy + 8, 32, 18);

  // Sandiq qopqog'i
  ctx.fillStyle = '#8D6E63';
  ctx.fillRect(cx, cy, 32, 8);

  // Oltin metall tasmalar
  ctx.fillStyle = '#FFC107';
  ctx.fillRect(cx + 6, cy, 4, 26);
  ctx.fillRect(cx + 22, cy, 4, 26);

  // Qulf (agar kalit bo'lsa yaltiraydi)
  ctx.fillStyle = hasKey ? '#FFEB3B' : '#B0BEC5';
  ctx.fillRect(cx + 13, cy + 9, 6, 6);
}

/**
 * Qahramonni chizish (Piyoda)
 */
function drawPlayer() {
  // Agar daxlsizlik vaqtida bo'lsa, yonib-o'chish (blinking) effekti
  if (player.invulnerableTime > 0) {
    if (Math.floor(globalTick * 0.3) % 2 === 0) {
      return; // Bu kadrda chizmaymiz (yonib-o'chadi)
    }
  }

  const px = player.x;
  const py = player.y;

  // Oyoqlar animatsiyasi
  const legShift = player.isMoving ? Math.sin(player.walkAnimTimer) * 3 : 0;

  // Oyoqlar (moviy shim)
  ctx.fillStyle = '#1565C0';
  ctx.fillRect(px + 4, py + 16, 6, 9 + legShift);
  ctx.fillRect(px + 16, py + 16, 6, 9 - legShift);

  // Tana / Ko'ylak (qizil sarguzashtchi)
  ctx.fillStyle = '#D32F2F';
  ctx.fillRect(px + 4, py + 8, 18, 10);

  // Bosh / Yuz
  ctx.fillStyle = '#FFCC80';
  ctx.fillRect(px + 6, py + 1, 14, 9);

  // Shlyapa (jigarrang ferma/kovboy shlyapasi)
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(px + 2, py, 22, 3);
  ctx.fillRect(px + 6, py - 4, 14, 4);

  // Ko'zlar (qarash yo'nalishiga qarab)
  ctx.fillStyle = '#212121';
  if (player.facing === 'left') {
    ctx.fillRect(px + 7, py + 4, 2, 2);
  } else if (player.facing === 'right') {
    ctx.fillRect(px + 17, py + 4, 2, 2);
  } else if (player.facing === 'up') {
    // Orqasi ko'ringanda ko'z chizilmaydi
  } else {
    ctx.fillRect(px + 9, py + 4, 2, 2);
    ctx.fillRect(px + 15, py + 4, 2, 2);
  }
}

/**
 * Moshina chizish
 */
function drawCar(car) {
  const cx = car.x;
  const cy = car.y;

  ctx.save();
  ctx.translate(cx + car.width / 2, cy + car.height / 2);

  // Yo'nalishga mos burish
  if (car.facing === 'up') ctx.rotate(-Math.PI / 2);
  if (car.facing === 'down') ctx.rotate(Math.PI / 2);
  if (car.facing === 'left') ctx.rotate(Math.PI);

  // Moshina korpusi
  ctx.fillStyle = car.color;
  ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

  // Moshina tomi va oynalari
  ctx.fillStyle = '#263238';
  ctx.fillRect(-car.width / 4, -car.height / 2 + 3, car.width / 2, car.height - 6);

  ctx.fillStyle = '#80DEEA'; // Oynalar shishasi
  ctx.fillRect(-car.width / 4 + 2, -car.height / 2 + 5, car.width / 2 - 4, car.height - 10);

  // G'ildiraklar (4 ta to'q qora)
  ctx.fillStyle = '#212121';
  ctx.fillRect(-car.width / 2 + 3, -car.height / 2 - 2, 8, 3);
  ctx.fillRect(car.width / 2 - 11, -car.height / 2 - 2, 8, 3);
  ctx.fillRect(-car.width / 2 + 3, car.height / 2 - 1, 8, 3);
  ctx.fillRect(car.width / 2 - 11, car.height / 2 - 1, 8, 3);

  // Old faralar
  ctx.fillStyle = '#FFF59D';
  ctx.fillRect(car.width / 2 - 2, -car.height / 2 + 3, 2, 5);
  ctx.fillRect(car.width / 2 - 2, car.height / 2 - 8, 2, 5);

  ctx.restore();

  // Agar ichida qahramon bo'lsa, moshina ustida haydovchi belgisi ko'rinadi
  if (car.occupied) {
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(cx + car.width / 2, cy - 6, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#30201C';
    ctx.font = '8px monospace';
    ctx.fillText('🧍', cx + car.width / 2 - 5, cy - 8);
  }
}

/**
 * Noyob Olmos (Gem) chizish
 */
function drawGemTile(x, y) {
  const cx = x + TILE_SIZE / 2;
  const cy = y + TILE_SIZE / 2 + Math.sin(globalTick * 0.1) * 2.5;

  ctx.save();
  ctx.translate(cx, cy);

  // Olmos nuri (Cyan glow)
  ctx.fillStyle = 'rgba(0, 229, 255, 0.28)';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();

  // Olmos (romb shakli)
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(8, 0);
  ctx.lineTo(0, 9);
  ctx.lineTo(-8, 0);
  ctx.closePath();
  ctx.fill();

  // Ichki billur qirralari
  ctx.fillStyle = '#E0F7FA';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(4, 0);
  ctx.lineTo(0, 9);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.fill();

  // Yaltirash uchquni
  if (Math.floor(globalTick * 0.15) % 3 === 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1, -5, 2, 2);
  }

  ctx.restore();
}

/**
 * Jon dorisi (Potion) chizish
 */
function drawPotionTile(x, y) {
  const cx = x + TILE_SIZE / 2;
  const cy = y + TILE_SIZE / 2 + Math.sin(globalTick * 0.08) * 2;

  ctx.save();
  ctx.translate(cx, cy);

  // Shisha kolba
  ctx.fillStyle = '#CFD8DC';
  ctx.fillRect(-2, -9, 4, 3);
  ctx.fillRect(-5, -6, 10, 14);

  // Qizil shifobaxsh eliksir
  ctx.fillStyle = '#E91E63';
  ctx.fillRect(-4, -2, 8, 9);

  // Shisha ustidagi nur
  ctx.fillStyle = '#F8BBD0';
  ctx.fillRect(-3, -1, 2, 7);

  // Yurak belgisi
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '8px monospace';
  ctx.fillText('❤️', -5, -9);

  ctx.restore();
}

/**
 * Dushmanni chizish (Patrul, Aggro quvish va BOSS rejimida)
 */
function drawEnemy(enemy) {
  const ex = enemy.x;
  const ey = enemy.y;
  const isChasing = (enemy.state === 'chase');
  const isBoss = enemy.isBoss;

  // Agar BOSS bo'lsa
  if (isBoss) {
    ctx.save();
    // Qizil qahrli Boss aurosi
    const auraPulse = Math.sin(globalTick * 0.15) * 4;
    ctx.fillStyle = 'rgba(255, 23, 68, 0.35)';
    ctx.beginPath();
    ctx.arc(ex + enemy.width / 2, ey + enemy.height / 2, 22 + auraPulse, 0, Math.PI * 2);
    ctx.fill();

    // Tana (Ulkan qizil robot monstir)
    ctx.fillStyle = '#B71C1C';
    ctx.fillRect(ex + 2, ey + 4, 30, 26);

    // Oltin toj
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(ex + 4, ey - 3, 6, 7);
    ctx.fillRect(ex + 14, ey - 6, 6, 10);
    ctx.fillRect(ex + 24, ey - 3, 6, 7);

    // Olovli ko'zlar
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(ex + 7, ey + 9, 6, 5);
    ctx.fillRect(ex + 21, ey + 9, 6, 5);

    // Tishlar
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(ex + 8, ey + 22, 4, 4);
    ctx.fillRect(ex + 15, ey + 22, 4, 4);
    ctx.fillRect(ex + 22, ey + 22, 4, 4);

    // Bosh ustida "👑 BOSS"
    ctx.fillStyle = '#FF1744';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('👑 BOSS', ex + 2, ey - 9);

    if (isChasing) {
      const alertBounce = Math.sin(globalTick * 0.25) * 2;
      ctx.fillStyle = '#FFEB3B';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('⚡', ex + enemy.width / 2 - 4, ey - 10 + alertBounce);
    }

    ctx.restore();
    return;
  }

  // Dushman turi bo'yicha maxsus ranglar palitrasi
  let bodyColor = '#7B1FA2';
  let hornColor = '#BA68C8';
  let eyeColor = '#FF1744';

  switch (enemy.type) {
    case 'hunter': // 3-4 bosqich (Zumrad yashil)
      bodyColor = isChasing ? '#E64A19' : '#2E7D32';
      hornColor = isChasing ? '#FF7043' : '#66BB6A';
      eyeColor = isChasing ? '#FFFF00' : '#E040FB';
      break;
    case 'cyborg': // 5-6 bosqich (Kiber sariq/olovrang)
      bodyColor = isChasing ? '#D84315' : '#E65100';
      hornColor = isChasing ? '#FFA726' : '#FFD54F';
      eyeColor = isChasing ? '#FFFF00' : '#00E5FF';
      break;
    case 'berserker': // 7-8 bosqich (Qonli qizil Berserk)
      bodyColor = isChasing ? '#D50000' : '#880E4F';
      hornColor = isChasing ? '#FF5252' : '#EC407A';
      eyeColor = isChasing ? '#FFEA00' : '#FF1744';
      break;
    case 'shadow': // 9-10 bosqich (Qora-binafsha Soya)
      bodyColor = isChasing ? '#B71C1C' : '#263238';
      hornColor = isChasing ? '#FF5252' : '#90A4AE';
      eyeColor = isChasing ? '#FF1744' : '#00E676';
      break;
    case 'scout': // 1-2 bosqich (Binafsharang skaut)
    default:
      bodyColor = isChasing ? '#D50000' : '#7B1FA2';
      hornColor = isChasing ? '#FF5252' : '#BA68C8';
      eyeColor = isChasing ? '#FFEA00' : '#FF1744';
      break;
  }

  // Quvish paytidagi ogohlantirish aurosi
  if (isChasing) {
    ctx.fillStyle = 'rgba(255, 23, 68, 0.28)';
    ctx.beginPath();
    ctx.arc(ex + enemy.width / 2, ey + enemy.height / 2, 19, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dushman tanasi
  ctx.fillStyle = bodyColor;
  ctx.fillRect(ex + 3, ey + 4, 22, 20);

  // Boshidagi shoxlar/antenalar
  ctx.fillStyle = hornColor;
  ctx.fillRect(ex + 4, ey, 4, 4);
  ctx.fillRect(ex + 20, ey, 4, 4);

  // Ko'zlar
  ctx.fillStyle = eyeColor;
  ctx.fillRect(ex + 6, ey + 9, 5, 4);
  ctx.fillRect(ex + 17, ey + 9, 5, 4);

  // O'tkir tishlar
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(ex + 8, ey + 18, 3, 3);
  ctx.fillRect(ex + 13, ey + 18, 3, 3);
  ctx.fillRect(ex + 17, ey + 18, 3, 3);

  // Sezib qolgan paytda bosh ustidagi "!" belgisi
  if (isChasing) {
    const alertBounce = Math.sin(globalTick * 0.25) * 2;
    ctx.fillStyle = '#FF1744';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('!', ex + enemy.width / 2 - 3, ey - 4 + alertBounce);
  }
}

/**
 * Yo'ldagi qurol (to'pponcha) chizish
 */
function drawWeapon(w) {
  const floatOffset = Math.sin(globalTick * 0.08 + w.seed) * 2.5;
  const wx = w.x;
  const wy = w.y + floatOffset;

  ctx.save();

  // Yo'l ustida yorqin yaltirash aurosi (Halo glow)
  const pulse = Math.sin(globalTick * 0.1) * 3;
  ctx.fillStyle = 'rgba(255, 215, 0, 0.28)';
  ctx.beginPath();
  ctx.arc(wx + 12, wy + 12, 14 + pulse, 0, Math.PI * 2);
  ctx.fill();

  // Qurol dasta qismi (jigarrang yog'och)
  ctx.fillStyle = '#5D4037';
  ctx.fillRect(wx + 5, wy + 11, 4, 8);

  // Tepki qismi
  ctx.fillStyle = '#FFB300';
  ctx.fillRect(wx + 9, wy + 13, 2, 3);

  // Korpus va stvol (qora metall)
  ctx.fillStyle = '#263238';
  ctx.fillRect(wx + 5, wy + 7, 14, 5);

  // Stvol uchi
  ctx.fillStyle = '#37474F';
  ctx.fillRect(wx + 15, wy + 8, 4, 3);

  // Yuqori metallik slayd (kumushrang po'lat)
  ctx.fillStyle = '#90A4AE';
  ctx.fillRect(wx + 6, wy + 5, 12, 3);

  // Nishon (oltin nishon)
  ctx.fillStyle = '#FFD54F';
  ctx.fillRect(wx + 17, wy + 4, 2, 2);

  // Yaltirash uchquni (Sparkle)
  if (Math.floor(globalTick * 0.12 + w.seed) % 4 === 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(wx + 14, wy + 4, 2, 2);
    ctx.fillRect(wx + 4, wy + 10, 2, 2);
  }

  ctx.restore();
}

/**
 * Otilgan o'qni chizish
 */
function drawBullet(b) {
  ctx.save();
  ctx.fillStyle = '#FFEB3B';
  ctx.shadowColor = '#FF5722';
  ctx.shadowBlur = 8;

  if (b.dir === 'left' || b.dir === 'right') {
    ctx.fillRect(b.x - 3, b.y, 8, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(b.x - 1, b.y + 1, 4, 2);
  } else {
    ctx.fillRect(b.x, b.y - 3, 4, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(b.x + 1, b.y - 1, 2, 4);
  }

  ctx.restore();
}

/**
 * Zarrachalarni chizish (alanga, uchqun, portlash)
 */
function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

// --- 11. O'YINNING ASOSIY MANTIQIY SIKLI (UPDATE & GAMELOOP) ---

/**
 * Har kadrda barcha holatni yangilash
 */
function update(dt) {
  if (isGameOver || isGameWon || isPaused) return;

  globalTick++;

  // Daxlsizlik taymerini kamaytirish
  if (player.invulnerableTime > 0) {
    player.invulnerableTime = Math.max(0, player.invulnerableTime - dt);
  }

  // Harakatni boshqarish
  if (player.inCar) {
    driveCar(dt);
  } else {
    movePlayer(dt);
  }

  // Dushmanlar harakati
  updateEnemies(dt);

  // O'qlar harakati va dushmanlar bilan to'qnashuvlari
  updateBullets(dt);

  // Zarrachalar (portlash, olov, uchqunlar)
  updateParticles(dt);

  // Yo'lda yangi qurollar chiqishi taymeri
  weaponSpawnTimer += dt;
  if (weaponSpawnTimer >= weaponSpawnInterval) {
    weaponSpawnTimer = 0;
    if (weapons.length < 3) {
      spawnWeapon();
    }
  }

  // Kalit radari (detektor) tizimini yangilash va sezish signallari
  updateKeyRadar(dt);

  // To'qnashuvlarni tekshirish
  checkCollision();
}

/**
 * requestAnimationFrame bilan ishlaydigan sikl
 */
function gameLoop(currentTimestamp) {
  const dt = Math.min(0.1, (currentTimestamp - lastTimestamp) / 1000);
  lastTimestamp = currentTimestamp;

  update(dt);
  draw();

  animationFrameId = requestAnimationFrame(gameLoop);
}

// --- 12. HODISALAR (EVENT LISTENERS) VA BOSHQARUV ---

// Klaviatura tugmalari bosilganda
window.addEventListener('keydown', (e) => {
  // Harakat tugmalari
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys[e.code] = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys[e.code] = true;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys[e.code] = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys[e.code] = true;

  // Brauzerning strelkalar bilan sahifani aylantirishini oldini olish
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }

  // O'q otish (Space yoki J)
  if (e.code === 'Space' || e.code === 'KeyJ') {
    shootBullet();
  }

  // Moshinaga o'tirish / tushish (E)
  if (e.code === 'KeyE') {
    toggleCar();
  }

  // Benzin quyish (F)
  if (e.code === 'KeyF') {
    refuelCar();
  }

  // Qutqaruv savoli (Q)
  if (e.code === 'KeyQ') {
    triggerManualRescue();
  }

  // Pauza (P)
  if (e.code === 'KeyP') {
    togglePause();
  }
});

// Klaviatura tugmalari qo'yib yuborilganda
window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.code)) {
    keys[e.code] = false;
  }
});

/**
 * Pauza rejimini almashtirish
 */
function togglePause() {
  if (isGameOver || isGameWon) return;
  isPaused = !isPaused;
  if (isPaused) {
    if (typeof resetJoystick === 'function') resetJoystick();
    pauseScreen.classList.remove('hidden');
  } else {
    pauseScreen.classList.add('hidden');
    lastTimestamp = performance.now();
  }
}

// --- 13. MOBIL VA VIRTUAL BOSHQARUV TUGMALARI ---
// ==========================================================
// 13. MOBIL VIRTUAL JOYSTIK VA ERGONOMIK SENSORLI BOSHQARUV
// ==========================================================
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
const joystickArrows = {
  up: document.querySelector('.j-arrow.j-up'),
  right: document.querySelector('.j-arrow.j-right'),
  down: document.querySelector('.j-arrow.j-down'),
  left: document.querySelector('.j-arrow.j-left')
};

let activeJoystickTouchId = null;
let isJoystickMouseDown = false;

function resetJoystick() {
  keys['ArrowUp'] = false;
  keys['ArrowDown'] = false;
  keys['ArrowLeft'] = false;
  keys['ArrowRight'] = false;
  
  if (joystickStick) {
    joystickStick.style.transform = 'translate(-50%, -50%)';
    joystickStick.classList.remove('active');
  }
  if (joystickBase) {
    joystickBase.classList.remove('active');
  }
  Object.values(joystickArrows).forEach(arrow => {
    if (arrow) arrow.classList.remove('active');
  });
}

function updateJoystickMovement(clientX, clientY) {
  if (!joystickBase || !joystickStick) return;

  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const deltaX = clientX - centerX;
  const deltaY = clientY - centerY;
  const distance = Math.hypot(deltaX, deltaY);

  // Maksimal siljish radiusi
  const maxRadius = Math.max(28, (rect.width / 2) - 8);
  const clampedDist = Math.min(distance, maxRadius);
  const angle = Math.atan2(deltaY, deltaX);

  const stickX = Math.cos(angle) * clampedDist;
  const stickY = Math.sin(angle) * clampedDist;

  joystickStick.style.transform = `translate(calc(-50% + ${stickX.toFixed(1)}px), calc(-50% + ${stickY.toFixed(1)}px))`;
  joystickStick.classList.add('active');
  joystickBase.classList.add('active');

  // Deadzone
  const deadZone = 8;
  if (distance < deadZone) {
    keys['ArrowUp'] = false;
    keys['ArrowDown'] = false;
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
    Object.values(joystickArrows).forEach(arrow => arrow && arrow.classList.remove('active'));
    return;
  }

  // Normalizatsiya (-1 dan 1 gacha)
  const normX = stickX / maxRadius;
  const normY = stickY / maxRadius;

  // 8-yo'nalishli pol sezgirligi
  const threshold = 0.35;
  const goUp = normY < -threshold;
  const goDown = normY > threshold;
  const goLeft = normX < -threshold;
  const goRight = normX > threshold;

  keys['ArrowUp'] = goUp;
  keys['ArrowDown'] = goDown;
  keys['ArrowLeft'] = goLeft;
  keys['ArrowRight'] = goRight;

  // Vizual strelkalar akslantirishi
  if (joystickArrows.up) joystickArrows.up.classList.toggle('active', goUp);
  if (joystickArrows.down) joystickArrows.down.classList.toggle('active', goDown);
  if (joystickArrows.left) joystickArrows.left.classList.toggle('active', goLeft);
  if (joystickArrows.right) joystickArrows.right.classList.toggle('active', goRight);

  // Qahramon yo'nalishini burish
  if (Math.abs(normX) > Math.abs(normY)) {
    if (goRight) player.facing = 'right';
    else if (goLeft) player.facing = 'left';
  } else {
    if (goDown) player.facing = 'down';
    else if (goUp) player.facing = 'up';
  }
}

if (joystickZone) {
  // Touch / Sensorli boshqaruv
  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      activeJoystickTouchId = t.identifier;
      updateJoystickMovement(t.clientX, t.clientY);
      break;
    }
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (activeJoystickTouchId === null) return;
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier === activeJoystickTouchId) {
        updateJoystickMovement(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  const handleTouchEnd = (e) => {
    if (activeJoystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeJoystickTouchId) {
        activeJoystickTouchId = null;
        resetJoystick();
        break;
      }
    }
  };

  window.addEventListener('touchend', handleTouchEnd, { passive: false });
  window.addEventListener('touchcancel', handleTouchEnd, { passive: false });

  // Sichqoncha orqali test qilish
  joystickZone.addEventListener('mousedown', (e) => {
    e.preventDefault();
    initAudio();
    isJoystickMouseDown = true;
    updateJoystickMovement(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isJoystickMouseDown) return;
    updateJoystickMovement(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', () => {
    if (!isJoystickMouseDown) return;
    isJoystickMouseDown = false;
    resetJoystick();
  });
}

// Mobil Harakat tugmalari (Action Buttons: OTISH, MOSHINA, BENZIN, SOS)
const actionButtons = document.querySelectorAll('.act-btn');
actionButtons.forEach((btn) => {
  let touchHandled = false;

  const triggerAction = (e) => {
    e.preventDefault();
    e.stopPropagation();
    initAudio();
    const action = btn.dataset.action;
    if (action === 'shoot') shootBullet();
    else if (action === 'toggleCar') toggleCar();
    else if (action === 'refuel') refuelCar();
    else if (action === 'rescue') triggerManualRescue();
  };

  btn.addEventListener('touchstart', (e) => {
    touchHandled = true;
    triggerAction(e);
  }, { passive: false });

  btn.addEventListener('click', (e) => {
    if (touchHandled) {
      touchHandled = false;
      return;
    }
    triggerAction(e);
  });
});

// ==========================================================
// 13.5. MOBIL BURGER MENYU MANTIQI
// ==========================================================
const burgerModal = document.getElementById('burger-menu-modal');
const btnBurgerMenu = document.getElementById('btn-burger-menu');
const btnCloseBurger = document.getElementById('btn-close-burger');
const btnBurgerResume = document.getElementById('btn-burger-resume');
const btnBurgerRescue = document.getElementById('btn-burger-rescue');
const btnBurgerAudio = document.getElementById('btn-burger-audio');
const btnBurgerFullscreen = document.getElementById('btn-burger-fullscreen');
const btnBurgerPause = document.getElementById('btn-burger-pause');
const btnBurgerInstructions = document.getElementById('btn-burger-instructions');
const btnBurgerQuit = document.getElementById('btn-burger-quit');

const burgerGems = document.getElementById('burger-gems');
const burgerAmmo = document.getElementById('burger-ammo');
const burgerEnemies = document.getElementById('burger-enemies');
const burgerLevel = document.getElementById('burger-level');
const burgerFuelBar = document.getElementById('burger-fuel-bar');
const burgerFuelText = document.getElementById('burger-fuel-text');
const burgerRadarStatus = document.getElementById('burger-radar-status');
const burgerRescueBadge = document.getElementById('burger-rescue-badge');
const burgerAudioIcon = document.getElementById('burger-audio-icon');

function openBurgerMenu() {
  if (isGameOver || isGameWon) return;
  initAudio();
  isPaused = true;
  updateBurgerStats();
  if (burgerModal) burgerModal.classList.remove('hidden');
}

function closeBurgerMenu() {
  if (burgerModal) burgerModal.classList.add('hidden');
  isPaused = false;
  lastTimestamp = performance.now();
}

function updateBurgerStats() {
  if (burgerGems) burgerGems.textContent = gems;
  if (burgerAmmo) burgerAmmo.textContent = ammo;
  if (burgerEnemies) {
    const lvl = LEVEL_CONFIGS[currentLevelIndex];
    burgerEnemies.textContent = `${enemies.length}/${lvl ? lvl.maxEnemies : '?'}`;
  }
  if (burgerLevel) burgerLevel.textContent = `${currentLevelIndex + 1}/${LEVEL_CONFIGS.length}`;

  if (player.inCar && player.currentCar) {
    const fuelPercent = Math.max(0, Math.floor(player.currentCar.fuel));
    if (burgerFuelBar) burgerFuelBar.style.width = `${fuelPercent}%`;
    if (burgerFuelText) burgerFuelText.textContent = `${fuelPercent}%`;
  } else {
    if (burgerFuelBar) burgerFuelBar.style.width = '0%';
    if (burgerFuelText) burgerFuelText.textContent = '--%';
  }

  if (burgerRadarStatus) {
    if (hasKey) {
      burgerRadarStatus.textContent = "Topildi! 🔑";
      burgerRadarStatus.className = 'radar-off';
    } else if (hasKeyRadar) {
      burgerRadarStatus.textContent = "Faol 📡";
      burgerRadarStatus.className = 'radar-active';
    } else {
      burgerRadarStatus.textContent = "Yo'q";
      burgerRadarStatus.className = 'radar-off';
    }
  }

  if (burgerRescueBadge) {
    burgerRescueBadge.textContent = rescueAvailable ? "(Tayyor)" : "(Ishlatildi)";
    if (btnBurgerRescue) {
      btnBurgerRescue.disabled = !rescueAvailable;
      btnBurgerRescue.style.opacity = rescueAvailable ? "1" : "0.5";
    }
  }

  if (burgerAudioIcon) {
    burgerAudioIcon.textContent = isMuted ? '🔇' : '🔊';
  }
}

// Burger Menyu tugmalarini hodisalar bilan bog'lash
if (btnBurgerMenu) {
  btnBurgerMenu.addEventListener('click', () => {
    openBurgerMenu();
  });
}

if (btnCloseBurger) {
  btnCloseBurger.addEventListener('click', () => {
    closeBurgerMenu();
  });
}

if (btnBurgerResume) {
  btnBurgerResume.addEventListener('click', () => {
    closeBurgerMenu();
  });
}

if (btnBurgerRescue) {
  btnBurgerRescue.addEventListener('click', () => {
    closeBurgerMenu();
    triggerManualRescue();
  });
}

if (btnBurgerAudio) {
  btnBurgerAudio.addEventListener('click', () => {
    initAudio();
    isMuted = !isMuted;
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) btnAudio.textContent = isMuted ? '🔇' : '🔊';
    if (burgerAudioIcon) burgerAudioIcon.textContent = isMuted ? '🔇' : '🔊';
    showToast(isMuted ? "Ovoz o'chirildi" : "Ovoz yoqildi");
  });
}

if (btnBurgerFullscreen) {
  btnBurgerFullscreen.addEventListener('click', () => {
    toggleFullscreen();
  });
}

if (btnBurgerPause) {
  btnBurgerPause.addEventListener('click', () => {
    closeBurgerMenu();
    togglePause();
  });
}

if (btnBurgerInstructions) {
  btnBurgerInstructions.addEventListener('click', () => {
    closeBurgerMenu();
    instructionsModal.classList.remove('hidden');
  });
}

if (btnBurgerQuit) {
  btnBurgerQuit.addEventListener('click', () => {
    closeBurgerMenu();
    returnToMainMenu();
  });
}

// HUD Qutqaruv tugmasi bosilganda
if (btnRescueHud) {
  btnRescueHud.addEventListener('click', () => {
    initAudio();
    triggerManualRescue();
  });
}

// --- 14. INTERFEYS TUGMALARI ISHLASHI ---

// Boshlash tugmasi
document.getElementById('btn-start').addEventListener('click', () => {
  startGame();
});

// Qanday o'ynaladi modali
document.getElementById('btn-instructions').addEventListener('click', () => {
  instructionsModal.classList.remove('hidden');
});

document.getElementById('btn-close-instructions').addEventListener('click', () => {
  instructionsModal.classList.add('hidden');
});

// Ovoz tugmasi
const btnAudio = document.getElementById('btn-audio-toggle');
btnAudio.addEventListener('click', () => {
  initAudio();
  isMuted = !isMuted;
  btnAudio.textContent = isMuted ? '🔇' : '🔊';
  showToast(isMuted ? "Ovoz o'chirildi" : "Ovoz yoqildi");
});

// HUD Pauza tugmasi
document.getElementById('btn-pause-toggle').addEventListener('click', () => {
  togglePause();
});

// Pauzani davom ettirish
document.getElementById('btn-resume').addEventListener('click', () => {
  togglePause();
});

// Pauzadan bosh menyuga
document.getElementById('btn-quit').addEventListener('click', () => {
  returnToMainMenu();
});

// Keyingi darajaga o'tish
document.getElementById('btn-next-level').addEventListener('click', () => {
  winScreen.classList.add('hidden');
  currentLevelIndex++;
  isGameWon = false;
  loadLevel(currentLevelIndex);
  lastTimestamp = performance.now();
});

// O'yinni qayta o'ynash (Chempion bo'lgandan keyin)
document.getElementById('btn-restart-game').addEventListener('click', () => {
  startGame();
});

// Yutuq oynasidan bosh menyuga
document.getElementById('btn-win-home').addEventListener('click', () => {
  returnToMainMenu();
});

// Mag'lubiyatdan so'ng qayta urinish
document.getElementById('btn-retry').addEventListener('click', () => {
  startGame();
});

// Mag'lubiyatdan so'ng bosh menyuga
document.getElementById('btn-gameover-home').addEventListener('click', () => {
  returnToMainMenu();
});

/**
 * Bosh menyuga qaytish
 */
function returnToMainMenu() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  isPaused = false;
  isGameOver = false;
  isGameWon = false;

  gamePlayArea.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  winScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  if (burgerModal) burgerModal.classList.add('hidden');
  menuScreen.classList.remove('hidden');
  menuScreen.classList.add('active');

  if (menuHighScore) {
    menuHighScore.textContent = highScore;
  }
}

// Boshlang'ich yuklashda yuqori ballni ko'rsatish
if (menuHighScore) {
  menuHighScore.textContent = highScore;
}

// --- 15. TO'LIQ EKRAN (FULLSCREEN) BOSHQARUVI ---
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    toggleFullscreen();
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
    if (btnFullscreen) btnFullscreen.textContent = '🗗';
    showToast("To'liq ekran yoqildi (Chiqish: ESC / F11)");
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    if (btnFullscreen) btnFullscreen.textContent = '⛶';
    showToast("Oyna rejimiga qaytildi");
  }
}

document.addEventListener('fullscreenchange', () => {
  if (btnFullscreen) {
    btnFullscreen.textContent = document.fullscreenElement ? '🗗' : '⛶';
  }
});
