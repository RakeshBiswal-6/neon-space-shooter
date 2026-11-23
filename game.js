(() => {
  "use strict";

  // --- DOM Elements ---
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  const scoreEl = $("score"), bestEl = $("best"), livesEl = $("lives");
  const waveEl = $("wave"), targetEl = $("stage-target");
  const overlay = $("overlay"), titleEl = $("overlay-title"), copyEl = $("overlay-copy");
  const kickerEl = $("overlay-kicker"), startBtn = $("start-btn"), statusEl = $("status-text");
  const pauseIndicator = $("pause-indicator"), soundBtn = $("sound-btn");

  const W = canvas.width, H = canvas.height;
  const keys = new Set();

  // --- Audio System (Web Audio API Procedural Synth) ---
  let audioCtx = null;
  let soundEnabled = true;
  try {
    const saved = localStorage.getItem("neonStrikeSound");
    if (saved !== null) soundEnabled = saved === "true";
  } catch (_) {}

  function updateSoundBtn() {
    if (soundBtn) {
      soundBtn.textContent = soundEnabled ? "🔊 SOUND: ON" : "🔇 SOUND: OFF";
      soundBtn.classList.toggle("muted", !soundEnabled);
    }
  }
  updateSoundBtn();

  function initAudio() {
    if (!audioCtx) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass) audioCtx = new AudioClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playTone(freq, type = "sine", duration = 0.1, startVol = 0.2, endVol = 0.001) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(startVol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, endVol), audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function playLaser() {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (_) {}
  }

  function playEnemyLaser() {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.14);
    } catch (_) {}
  }

  function playExplosion(isBig = false) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const dur = isBig ? 0.65 : 0.28;
      const bufferSize = audioCtx.sampleRate * dur;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(isBig ? 450 : 750, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + dur);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(isBig ? 0.35 : 0.22, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    } catch (_) {}
  }

  function playPlayerHit() {
    playTone(130, "sawtooth", 0.25, 0.35, 0.001);
  }

  function playPowerup() {
    [392, 523, 659, 784].forEach((freq, idx) => {
      setTimeout(() => playTone(freq, "sine", 0.15, 0.16, 0.001), idx * 60);
    });
  }

  function playStageClear() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      setTimeout(() => playTone(freq, "triangle", 0.22, 0.22, 0.001), idx * 80);
    });
  }

  function playBossWarning() {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => playTone(370, "sawtooth", 0.18, 0.25, 0.01), i * 350);
      setTimeout(() => playTone(550, "sawtooth", 0.18, 0.25, 0.01), i * 350 + 175);
    }
  }

  function playVictory() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, idx) => {
      setTimeout(() => playTone(f, "triangle", 0.32, 0.24, 0.001), idx * 130);
    });
  }

  function playGameOver() {
    [340, 300, 260, 180, 110].forEach((f, idx) => {
      setTimeout(() => playTone(f, "sawtooth", 0.28, 0.25, 0.001), idx * 140);
    });
  }

  // --- Game Data & Configurations ---
  const TOTAL_STAGES = 10;
  // Stage difficulty ramps up gradually: Stage 1 is very easy, Stage 9 is brutal
  // speedMod multiplies enemy base speed; spawnInterval is seconds between spawns (higher = easier)
  const STAGE_CONFIG = [
    { name: "ORBITAL FRONTIER",       killsRequired: 8,  spawnInterval: 2.0,  speedMod: 0.45, types: ["scout"] },
    { name: "ASTEROID SECTOR",        killsRequired: 10, spawnInterval: 1.7,  speedMod: 0.55, types: ["scout", "scout", "interceptor"] },
    { name: "NEBULA PATROL",          killsRequired: 12, spawnInterval: 1.5,  speedMod: 0.65, types: ["scout", "interceptor", "zigzag"] },
    { name: "CYBER CORRIDOR",         killsRequired: 14, spawnInterval: 1.35, speedMod: 0.75, types: ["scout", "heavy", "zigzag"] },
    { name: "ION STORM",              killsRequired: 16, spawnInterval: 1.2,  speedMod: 0.85, types: ["interceptor", "heavy", "bomber"] },
    { name: "VOID ABYSS",             killsRequired: 18, spawnInterval: 1.1,  speedMod: 0.95, types: ["scout", "stealth", "heavy"] },
    { name: "CRIMSON SQUADRON",       killsRequired: 20, spawnInterval: 1.0,  speedMod: 1.05, types: ["heavy", "stealth", "bomber"] },
    { name: "ARMADA VANGUARD",        killsRequired: 22, spawnInterval: 0.85, speedMod: 1.18, types: ["interceptor", "heavy", "bomber", "stealth"] },
    { name: "TITAN'S GATE",           killsRequired: 24, spawnInterval: 0.7,  speedMod: 1.35, types: ["heavy", "bomber", "stealth", "interceptor"] },
    { name: "MEGA BOSS: CYBER-COLOSSUS", killsRequired: 1, spawnInterval: 999, speedMod: 1.5, types: ["boss"] }
  ];

  // Game state variables
  let state = "ready"; // ready, playing, stage_clear, boss_alert, over, victory, paused
  let score = 0, best = 0, lives = 3, currentStage = 1;
  let stageKills = 0, stageKillsTarget = 10;
  let stageBannerTimer = 0, stageBannerText = "";
  let bossAlertTimer = 0;
  let screenShake = 0;

  let player = null;
  let bullets = [], enemyBullets = [], enemies = [], powerups = [], particles = [], stars = [];
  let boss = null;

  let lastTime = 0, spawnTimer = 0, fireTimer = 0, enemyFireTimer = 0, frame = 0;
  let touchLeft = false, touchRight = false, touchFire = false;

  try { best = Number(localStorage.getItem("neonStrikeBest") || 0); } catch (_) {}
  bestEl.textContent = formatScore(best);
  $("year").textContent = new Date().getFullYear();

  function formatScore(n) {
    return String(Math.max(0, Math.floor(n))).padStart(6, "0");
  }

  // --- Reset & Stage Management ---
  function reset() {
    score = 0;
    lives = 3;
    currentStage = 1;
    stageKills = 0;
    stageKillsTarget = STAGE_CONFIG[0].killsRequired;
    stageBannerTimer = 0;
    bossAlertTimer = 0;
    screenShake = 0;
    boss = null;

    player = {
      x: W / 2,
      y: H - 56,
      w: 36,
      h: 32,
      speed: 380,
      invuln: 0,
      tripleShotTimer: 0,
      rapidFireTimer: 0,
      isExploding: false,
      explodeTimer: 0
    };

    bullets = [];
    enemyBullets = [];
    enemies = [];
    powerups = [];
    particles = [];
    spawnTimer = 0.5;
    fireTimer = 0;
    enemyFireTimer = 1.2;

    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = formatScore(score);
    bestEl.textContent = formatScore(best);

    // 3 Hull lives display
    livesEl.textContent = Array.from({ length: 3 }, (_, i) => (i < lives ? "♥" : "·")).join(" ");

    // Stage display
    if (currentStage === TOTAL_STAGES) {
      waveEl.textContent = "10 // BOSS";
      targetEl.textContent = boss ? `BOSS: ${Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100))}%` : "BOSS INCOMING";
    } else {
      waveEl.textContent = `${String(currentStage).padStart(2, "0")} / 10`;
      const remaining = Math.max(0, stageKillsTarget - stageKills);
      targetEl.textContent = `${remaining} LEFT`;
    }
  }

  function start() {
    initAudio();
    reset();
    state = "playing";
    overlay.classList.add("hidden");
    pauseIndicator.classList.add("hidden");
    statusEl.textContent = `STAGE 01: ${STAGE_CONFIG[0].name}`;
    triggerStageBanner("STAGE 01", STAGE_CONFIG[0].name);
  }

  function triggerStageBanner(title, subtitle) {
    stageBannerText = `${title} - ${subtitle}`;
    stageBannerTimer = 2.4;
    playStageClear();
  }

  function advanceStage() {
    currentStage++;
    stageKills = 0;
    bullets = [];
    enemyBullets = [];
    enemies = [];

    // Score bonus for clearing stage
    const bonus = currentStage * 250;
    score += bonus;
    addFloatingText(W / 2, H / 2 - 30, `STAGE BONUS +${bonus}`, "#63ffb0");

    if (currentStage === TOTAL_STAGES) {
      // Mega Boss Stage!
      stageKillsTarget = 1;
      state = "boss_alert";
      bossAlertTimer = 3.2;
      statusEl.textContent = "⚠️ DANGER: MEGA BOSS DETECTED ⚠️";
      playBossWarning();
    } else {
      const cfg = STAGE_CONFIG[currentStage - 1];
      stageKillsTarget = cfg.killsRequired;
      spawnTimer = 1.0;
      statusEl.textContent = `STAGE ${String(currentStage).padStart(2, "0")}: ${cfg.name}`;
      triggerStageBanner(`STAGE ${String(currentStage).padStart(2, "0")}`, cfg.name);
    }
    updateHud();
  }

  function spawnMegaBoss() {
    boss = {
      x: W / 2,
      y: -140,
      targetY: 105,
      w: 230,
      h: 110,
      hp: 220,
      maxHp: 220,
      speedX: 95,
      direction: 1,
      fireTimer: 1.0,
      spreadTimer: 2.5,
      summonTimer: 5.5,
      enraged: false,
      phase: 1,
      hitFlash: 0
    };
    state = "playing";
    statusEl.textContent = "BATTLE IN PROGRESS: MEGA BOSS";
    updateHud();
  }

  function damagePlayer() {
    if (player.invuln > 0 || player.isExploding || lives <= 0) return;

    lives--;
    player.invuln = 1.5;
    screenShake = 0.35;
    addBurst(player.x, player.y, "#ff4fd8", 26);
    playPlayerHit();
    updateHud();

    if (lives <= 0) {
      // Hero space destroyed!
      player.isExploding = true;
      player.explodeTimer = 1.4;
      screenShake = 0.65;
      playExplosion(true);
      playGameOver();

      // Mega explosion burst
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          addBurst(
            player.x + (Math.random() * 40 - 20),
            player.y + (Math.random() * 40 - 20),
            i % 2 === 0 ? "#54f6ff" : "#ff4fd8",
            24
          );
        }, i * 150);
      }
    }
  }

  function endGame(isVictory = false) {
    state = isVictory ? "victory" : "over";
    statusEl.textContent = isVictory ? "MISSION ACCOMPLISHED" : "HERO SHIP DESTROYED";

    if (score > best) {
      best = score;
      try { localStorage.setItem("neonStrikeBest", String(best)); } catch (_) {}
    }
    updateHud();

    if (isVictory) {
      playVictory();
      kickerEl.textContent = "GALAXY SAVED // ALL 10 STAGES CLEARED";
      titleEl.className = "victory-title";
      titleEl.innerHTML = "VICTORY! <span>CONQUERED.</span>";
      copyEl.innerHTML = `Magnificent piloting! You completed all 10 stages and destroyed the <b>Mega Alien Boss</b>!<br><br>Final Score: <b>${formatScore(score)}</b> | High Score: <b>${formatScore(best)}</b>`;
      startBtn.innerHTML = "PLAY AGAIN <span>→</span>";
    } else {
      kickerEl.textContent = "MISSION FAILED // HERO DESTROYED";
      titleEl.className = "gameover-title";
      titleEl.innerHTML = "HERO SHIP <span>DESTROYED.</span>";
      copyEl.innerHTML = `All 3 hull lives lost at <b>Stage ${currentStage} of 10</b>.<br>Enemies & bullets compromised your ship.<br><br>Final Score: <b>${formatScore(score)}</b> | High Score: <b>${formatScore(best)}</b>`;
      startBtn.innerHTML = "RETRY MISSION <span>→</span>";
    }
    overlay.classList.remove("hidden");
  }

  function togglePause() {
    if (state === "playing" || state === "boss_alert") {
      state = "paused";
      pauseIndicator.classList.remove("hidden");
      statusEl.textContent = "MISSION PAUSED";
    } else if (state === "paused") {
      state = bossAlertTimer > 0 ? "boss_alert" : "playing";
      pauseIndicator.classList.add("hidden");
      statusEl.textContent = "MISSION IN PROGRESS";
    }
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem("neonStrikeSound", String(soundEnabled)); } catch (_) {}
    updateSoundBtn();
    if (soundEnabled) initAudio();
  }

  // --- Particle & Visual Effects ---
  function addBurst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 200;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.5,
        max: 0.85,
        color,
        size: 1.5 + Math.random() * 3.5
      });
    }
  }

  let floatingTexts = [];
  function addFloatingText(x, y, text, color = "#54f6ff") {
    floatingTexts.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
  }

  // --- Spawning System ---
  function spawnEnemy() {
    if (currentStage === TOTAL_STAGES || stageKills >= stageKillsTarget) return;

    const cfg = STAGE_CONFIG[currentStage - 1];
    const availableTypes = cfg.types;
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

    let w = 26, h = 22, hp = 1, speed = (90 + currentStage * 9) * cfg.speedMod;
    let color = "#9b72ff";

    if (type === "scout") {
      w = 26; h = 20; hp = 1; speed = 90 * cfg.speedMod; color = "#54f6ff";
    } else if (type === "interceptor") {
      w = 24; h = 22; hp = 1; speed = 120 * cfg.speedMod; color = "#ffea54";
    } else if (type === "heavy") {
      w = 40; h = 28; hp = 3; speed = 65 * cfg.speedMod; color = "#ff4fd8";
    } else if (type === "zigzag") {
      w = 28; h = 22; hp = 2; speed = 85 * cfg.speedMod; color = "#63ffb0";
    } else if (type === "bomber") {
      w = 46; h = 32; hp = 4; speed = 55 * cfg.speedMod; color = "#ff5555";
    } else if (type === "stealth") {
      w = 28; h = 24; hp = 2; speed = 100 * cfg.speedMod; color = "#bf6bff";
    }

    enemies.push({
      x: 35 + Math.random() * (W - 70),
      y: -35,
      w, h, hp, maxHp: hp,
      speed,
      type,
      color,
      phase: Math.random() * Math.PI * 2,
      opacity: 1,
      fireCooldown: 0.8 + Math.random() * 1.5
    });
  }

  function spawnPowerup(x, y) {
    const roll = Math.random();
    let type = "triple";
    let color = "#ffea54";
    let label = "TRIPLE SHOT";

    if (roll < 0.35 && lives < 3) {
      type = "heal";
      color = "#63ffb0";
      label = "+1 HULL LIFE";
    } else if (roll < 0.70) {
      type = "triple";
      color = "#54f6ff";
      label = "TRIPLE LASER";
    } else {
      type = "rapid";
      color = "#ff4fd8";
      label = "RAPID FIRE";
    }

    powerups.push({ x, y, vy: 95, type, color, label, size: 16 });
  }

  // --- Shooting ---
  function shoot() {
    if (player.isExploding || lives <= 0) return;

    if (player.tripleShotTimer > 0) {
      // 3-way spread laser
      bullets.push({ x: player.x, y: player.y - 18, w: 8, h: 18, vx: 0, vy: -530 });
      bullets.push({ x: player.x - 12, y: player.y - 14, w: 8, h: 18, vx: -90, vy: -510 });
      bullets.push({ x: player.x + 12, y: player.y - 14, w: 8, h: 18, vx: 90, vy: -510 });
      addBurst(player.x, player.y - 20, "#54f6ff", 4);
    } else {
      // Standard laser
      bullets.push({ x: player.x, y: player.y - 18, w: 8, h: 18, vx: 0, vy: -530 });
      addBurst(player.x, player.y - 20, "#54f6ff", 2);
    }
    playLaser();
  }

  function hit(a, b) {
    const aw = a.w || 8;
    const ah = a.h || 12;
    const bw = b.w || 8;
    const bh = b.h || 12;
    return Math.abs(a.x - b.x) < (aw + bw) * 0.5 && Math.abs(a.y - b.y) < (ah + bh) * 0.5;
  }

  // --- Main Update Loop ---
  function update(dt) {
    frame++;

    // Shake dampening
    if (screenShake > 0) screenShake = Math.max(0, screenShake - dt);

    // Floating text update
    floatingTexts.forEach((ft) => {
      ft.y -= 30 * dt;
      ft.life -= dt;
    });
    floatingTexts = floatingTexts.filter((ft) => ft.life > 0);

    // Stage banner timer
    if (stageBannerTimer > 0) stageBannerTimer -= dt;

    // Boss alert intro
    if (state === "boss_alert") {
      bossAlertTimer -= dt;
      if (bossAlertTimer <= 0) {
        spawnMegaBoss();
      }
      return;
    }

    if (state !== "playing") return;

    // Player Death Explosion Sequence
    if (player.isExploding) {
      player.explodeTimer -= dt;
      if (player.explodeTimer <= 0) {
        endGame(false);
      }
      // Update particles while exploding
      updateParticles(dt);
      return;
    }

    // Input Handling
    const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A") || touchLeft;
    const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D") || touchRight;
    const firing = keys.has(" ") || touchFire;

    if (left) player.x -= player.speed * dt;
    if (right) player.x += player.speed * dt;
    player.x = Math.max(24, Math.min(W - 24, player.x));

    player.invuln = Math.max(0, player.invuln - dt);
    if (player.tripleShotTimer > 0) player.tripleShotTimer -= dt;
    if (player.rapidFireTimer > 0) player.rapidFireTimer -= dt;

    // Firing cooldown
    const currentFireCooldown = player.rapidFireTimer > 0 ? 0.09 : 0.18;
    fireTimer -= dt;
    if (firing && fireTimer <= 0) {
      shoot();
      fireTimer = currentFireCooldown;
    }

    // Normal Enemy Spawning (Stages 1 to 9)
    if (currentStage < TOTAL_STAGES && stageKills < stageKillsTarget) {
      spawnTimer -= dt;
      const cfg = STAGE_CONFIG[currentStage - 1];
      if (spawnTimer <= 0) {
        spawnEnemy();
        spawnTimer = cfg.spawnInterval * (0.8 + Math.random() * 0.4);
      }
    }

    // Enemy Regular Fire
    enemyFireTimer -= dt;
    if (enemyFireTimer <= 0 && enemies.length > 0) {
      const shootingEnemies = enemies.filter((e) => e.y > 20 && e.y < H - 120);
      if (shootingEnemies.length > 0) {
        const shooter = shootingEnemies[Math.floor(Math.random() * shootingEnemies.length)];
        const bulletSpeed = 140 + currentStage * 18;

        if (shooter.type === "heavy" || shooter.type === "bomber") {
          // Dual laser
          enemyBullets.push({ x: shooter.x - 10, y: shooter.y + 14, vx: -25, vy: bulletSpeed });
          enemyBullets.push({ x: shooter.x + 10, y: shooter.y + 14, vx: 25, vy: bulletSpeed });
        } else {
          enemyBullets.push({ x: shooter.x, y: shooter.y + 12, vx: 0, vy: bulletSpeed });
        }
        playEnemyLaser();
      }
      enemyFireTimer = Math.max(0.45, 2.0 - currentStage * 0.14) + Math.random() * 0.4;
    }

    // --- Update Bullets ---
    bullets.forEach((b) => {
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
    });
    bullets = bullets.filter((b) => b.y > -25 && b.x > 0 && b.x < W);

    enemyBullets.forEach((b) => {
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
    });
    enemyBullets = enemyBullets.filter((b) => b.y < H + 25 && b.x > -20 && b.x < W + 20);

    // --- Update Enemies ---
    enemies.forEach((e) => {
      e.y += e.speed * dt;
      if (e.type === "zigzag") {
        e.x += Math.sin(frame * 0.08 + e.phase) * 120 * dt;
      } else {
        e.x += Math.sin(frame * 0.03 + e.phase) * 35 * dt;
      }

      if (e.type === "stealth") {
        e.opacity = 0.3 + 0.7 * Math.abs(Math.sin(frame * 0.05 + e.phase));
      }
    });

    // Enemy Collisions & Destruction
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      // Alien ship reaches bottom: NO PLAYER DAMAGE (only despawns as user requested)
      if (e.y > H + 30) {
        enemies.splice(i, 1);
        continue;
      }

      // COLLISION: Hero space touched by alien spaceship!
      if (hit(e, player)) {
        enemies.splice(i, 1);
        addBurst(e.x, e.y, "#ff4fd8", 22);
        playExplosion(false);
        damagePlayer(); // Hero loses a life when touched
        continue;
      }

      // Hero bullet hits enemy
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (hit(e, b)) {
          bullets.splice(j, 1);
          e.hp--;
          addBurst(b.x, b.y, "#54f6ff", 4);

          if (e.hp <= 0) {
            enemies.splice(i, 1);
            const pt = e.maxHp > 2 ? 60 : e.maxHp === 2 ? 30 : 15;
            score += pt;
            stageKills++;
            addBurst(e.x, e.y, e.color, 18);
            playExplosion(false);

            // Chance to drop power-up
            if (Math.random() < 0.16) {
              spawnPowerup(e.x, e.y);
            }

            updateHud();

            // Check if stage is cleared
            if (currentStage < TOTAL_STAGES && stageKills >= stageKillsTarget && enemies.length === 0) {
              advanceStage();
            }
            break;
          }
        }
      }
    }

    // Check if stage cleared after all enemies leave
    if (currentStage < TOTAL_STAGES && stageKills >= stageKillsTarget && enemies.length === 0) {
      advanceStage();
    }

    // --- Update Mega Boss (Stage 10) ---
    if (boss) {
      // Entry descend
      if (boss.y < boss.targetY) {
        boss.y += 85 * dt;
      } else {
        // Horizontal patrol
        boss.x += boss.speedX * boss.direction * dt;
        if (boss.x > W - 140) {
          boss.x = W - 140;
          boss.direction = -1;
        } else if (boss.x < 140) {
          boss.x = 140;
          boss.direction = 1;
        }
      }

      if (boss.hitFlash > 0) boss.hitFlash -= dt;

      // Boss Enraged Phase (< 35% HP)
      if (boss.hp < boss.maxHp * 0.35 && !boss.enraged) {
        boss.enraged = true;
        boss.speedX = 145;
        addFloatingText(boss.x, boss.y, "OVERDRIVE ACTIVATED!", "#ff4fd8");
        playBossWarning();
      }

      // Boss Weapon 1: Dual Wing Plasma Cannons
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0) {
        const bSpeed = boss.enraged ? 280 : 220;
        enemyBullets.push({ x: boss.x - 70, y: boss.y + 35, vx: -30, vy: bSpeed, w: 10, h: 14, boss: true });
        enemyBullets.push({ x: boss.x + 70, y: boss.y + 35, vx: 30, vy: bSpeed, w: 10, h: 14, boss: true });
        playEnemyLaser();
        boss.fireTimer = boss.enraged ? 0.6 : 1.1;
      }

      // Boss Weapon 2: Spread Shot / Ion Blast
      boss.spreadTimer -= dt;
      if (boss.spreadTimer <= 0) {
        const angles = [-0.45, -0.22, 0, 0.22, 0.45];
        angles.forEach((ang) => {
          enemyBullets.push({
            x: boss.x,
            y: boss.y + 45,
            vx: Math.sin(ang) * 240,
            vy: Math.cos(ang) * 240,
            w: 8, h: 8,
            boss: true
          });
        });
        playEnemyLaser();
        boss.spreadTimer = boss.enraged ? 2.0 : 3.4;
      }

      // Boss Weapon 3: Escort Drone Spawns
      boss.summonTimer -= dt;
      if (boss.summonTimer <= 0) {
        enemies.push({
          x: boss.x - 60, y: boss.y + 20, w: 24, h: 20, hp: 1, maxHp: 1,
          speed: 130, type: "interceptor", color: "#ffea54", phase: Math.random() * 6
        });
        enemies.push({
          x: boss.x + 60, y: boss.y + 20, w: 24, h: 20, hp: 1, maxHp: 1,
          speed: 130, type: "interceptor", color: "#ffea54", phase: Math.random() * 6
        });
        boss.summonTimer = 6.5;
      }

      // Hero space touched by Mega Boss hull
      if (hit(boss, player)) {
        damagePlayer();
      }

      // Hero bullets hitting Boss
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (hit(boss, b)) {
          bullets.splice(j, 1);
          boss.hp--;
          boss.hitFlash = 0.08;
          addBurst(b.x, b.y, "#54f6ff", 4);
          updateHud();

          if (boss.hp <= 0) {
            // Mega Boss Destroyed!
            screenShake = 0.8;
            playExplosion(true);
            for (let k = 0; k < 12; k++) {
              setTimeout(() => {
                addBurst(
                  boss.x + (Math.random() * 200 - 100),
                  boss.y + (Math.random() * 100 - 50),
                  k % 2 === 0 ? "#ffd700" : "#ff4fd8",
                  30
                );
                playExplosion(true);
              }, k * 180);
            }
            score += 5000;
            boss = null;
            setTimeout(() => {
              endGame(true); // VICTORY!
            }, 2200);
            break;
          }
        }
      }
    }

    // --- ENEMY BULLETS HITTING HERO ---
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const eb = enemyBullets[i];
      const ebObj = { x: eb.x, y: eb.y, w: eb.w || 6, h: eb.h || 10 };
      if (hit(ebObj, player)) {
        enemyBullets.splice(i, 1);
        damagePlayer(); // Hero loses life when touched by bullet!
      }
    }

    // --- POWERUPS UPDATE & COLLECTION ---
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt;

      // Hero collects powerup
      if (Math.abs(p.x - player.x) < 28 && Math.abs(p.y - player.y) < 28) {
        if (p.type === "heal") {
          lives = Math.min(3, lives + 1);
          addFloatingText(player.x, player.y - 25, "+1 HULL REPAIRED", "#63ffb0");
        } else if (p.type === "triple") {
          player.tripleShotTimer = 12.0;
          addFloatingText(player.x, player.y - 25, "TRIPLE LASER ARMED", "#54f6ff");
        } else if (p.type === "rapid") {
          player.rapidFireTimer = 9.0;
          addFloatingText(player.x, player.y - 25, "RAPID OVERDRIVE", "#ff4fd8");
        }
        playPowerup();
        addBurst(p.x, p.y, p.color, 16);
        powerups.splice(i, 1);
        updateHud();
        continue;
      }

      if (p.y > H + 30) powerups.splice(i, 1);
    }

    updateParticles(dt);
  }

  function updateParticles(dt) {
    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);
  }

  // --- Drawing System ---
  function drawShip(x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Engine thrust flare
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#ff4fd8";
    ctx.fillStyle = "#ff4fd8";
    const flameH = Math.random() * 12 + 6;
    ctx.beginPath();
    ctx.moveTo(-5, 14);
    ctx.lineTo(0, 14 + flameH);
    ctx.lineTo(5, 14);
    ctx.closePath();
    ctx.fill();

    // Invulnerability shield bubble
    if (player.invuln > 0) {
      ctx.strokeStyle = `rgba(84, 246, 255, ${0.4 + 0.6 * Math.sin(frame * 0.4)})`;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#54f6ff";
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Main hull
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#54f6ff";
    ctx.fillStyle = "#54f6ff";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(17, 12);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 15);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-17, 12);
    ctx.closePath();
    ctx.fill();

    // Cockpit neon canopy
    ctx.shadowBlur = 9;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(4, 3);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fill();

    // Wing cannons
    ctx.fillStyle = player.tripleShotTimer > 0 ? "#ffea54" : "#ff4fd8";
    ctx.fillRect(-16, 2, 3, 7);
    ctx.fillRect(13, 2, 3, 7);

    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.globalAlpha = e.opacity !== undefined ? e.opacity : 1;

    ctx.shadowBlur = 16;
    ctx.shadowColor = e.color;
    ctx.fillStyle = e.color;

    if (e.type === "heavy" || e.type === "bomber") {
      // Heavy cruiser shape
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(e.w / 2, -12);
      ctx.lineTo(e.w / 4, -18);
      ctx.lineTo(0, -10);
      ctx.lineTo(-e.w / 4, -18);
      ctx.lineTo(-e.w / 2, -12);
      ctx.closePath();
      ctx.fill();
    } else {
      // Dart / Scout shape
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.lineTo(e.w / 2, -10);
      ctx.lineTo(6, -6);
      ctx.lineTo(0, -14);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-e.w / 2, -10);
      ctx.closePath();
      ctx.fill();
    }

    // Enemy core
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-3, -2, 6, 4);

    ctx.restore();
  }

  function drawMegaBoss(b) {
    ctx.save();
    ctx.translate(b.x, b.y);

    const glowColor = b.hitFlash > 0 ? "#ffffff" : b.enraged ? "#ff2244" : "#9b72ff";
    ctx.shadowBlur = 28;
    ctx.shadowColor = glowColor;

    // Outer wings
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.lineTo(115, -15);
    ctx.lineTo(110, -45);
    ctx.lineTo(45, -30);
    ctx.lineTo(0, -55);
    ctx.lineTo(-45, -30);
    ctx.lineTo(-110, -45);
    ctx.lineTo(-115, -15);
    ctx.closePath();
    ctx.fill();

    // Inner Armor Plates
    ctx.fillStyle = "#121735";
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(80, -10);
    ctx.lineTo(30, -22);
    ctx.lineTo(0, -40);
    ctx.lineTo(-30, -22);
    ctx.lineTo(-80, -10);
    ctx.closePath();
    ctx.fill();

    // Pulsing Core Reactor
    const corePulse = 12 + Math.sin(frame * 0.15) * 4;
    ctx.shadowBlur = 32;
    ctx.shadowColor = b.enraged ? "#ff3366" : "#54f6ff";
    ctx.fillStyle = b.enraged ? "#ff3366" : "#54f6ff";
    ctx.beginPath();
    ctx.arc(0, -5, corePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -5, corePulse * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Wing Turrets
    ctx.fillStyle = "#ff4fd8";
    ctx.fillRect(-73, 20, 6, 16);
    ctx.fillRect(67, 20, 6, 16);

    ctx.restore();

    // Canvas Mega Boss Health Bar
    const barW = 420, barH = 16;
    const barX = (W - barW) / 2, barY = 28;
    const hpRatio = Math.max(0, b.hp / b.maxHp);

    ctx.save();
    ctx.fillStyle = "rgba(7, 10, 28, 0.85)";
    ctx.strokeStyle = b.enraged ? "#ff4fd8" : "#9b72ff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = b.enraged ? "#ff4fd8" : "#9b72ff";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeRect(barX, barY, barW, barH);

    // Gradient HP fill
    const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    grad.addColorStop(0, b.enraged ? "#ff3366" : "#ff4fd8");
    grad.addColorStop(1, b.enraged ? "#ff9900" : "#54f6ff");
    ctx.fillStyle = grad;
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * hpRatio, barH - 4);

    // Text Label
    ctx.font = "700 11px Orbitron, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`CYBER-COLOSSUS // MEGA BOSS: ${Math.ceil(hpRatio * 100)}%`, W / 2, barY - 7);
    ctx.restore();
  }

  function draw() {
    ctx.save();

    // Screen Shake Offset
    if (screenShake > 0) {
      const shakeAmt = screenShake * 14;
      ctx.translate((Math.random() * 2 - 1) * shakeAmt, (Math.random() * 2 - 1) * shakeAmt);
    }

    ctx.clearRect(0, 0, W, H);

    // Deep space gradient
    const grad = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 540);
    grad.addColorStop(0, "#101636");
    grad.addColorStop(1, "#040614");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Starfield
    for (let i = 0; i < 95; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 83 + frame * (i % 3 + 1) * 0.28) % H;
      ctx.fillStyle = i % 8 === 0 ? "#54f6ffaa" : "#d9e4ff55";
      ctx.fillRect(x, y, i % 8 === 0 ? 2 : 1, i % 8 === 0 ? 2 : 1);
    }

    // Grid lines
    ctx.strokeStyle = "#54f6ff0a";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Power-up capsules
    powerups.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowBlur = 14;
      ctx.shadowColor = p.color;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = "#0c1228";
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = "700 9px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.type === "heal" ? "♥" : p.type === "triple" ? "3X" : "⚡", 0, 0);
      ctx.restore();
    });

    // Bullets (Player)
    bullets.forEach((b) => {
      ctx.save();
      ctx.shadowColor = "#54f6ff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#b9fcff";
      ctx.fillRect(b.x - 2, b.y - 10, 4, 16);
      ctx.restore();
    });

    // Enemy Bullets
    enemyBullets.forEach((b) => {
      ctx.save();
      const bColor = b.boss ? "#ff2a8d" : "#ff4fd8";
      ctx.shadowColor = bColor;
      ctx.shadowBlur = 12;
      ctx.fillStyle = bColor;
      const bw = b.w || 6, bh = b.h || 10;
      ctx.fillRect(b.x - bw / 2, b.y - bh / 2, bw, bh);
      ctx.restore();
    });

    // Enemies
    enemies.forEach(drawEnemy);

    // Mega Boss
    if (boss) drawMegaBoss(boss);

    // Particles
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1;
    });

    // Floating text
    floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.font = "700 12px Orbitron, sans-serif";
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.textAlign = "center";
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // Hero Ship (if alive and playing/paused)
    if (player && (state === "playing" || state === "paused") && !player.isExploding) {
      if (player.invuln <= 0 || Math.floor(frame / 4) % 2 === 0) {
        drawShip(player.x, player.y);
      }
    }

    // Boss Warning Siren Banner
    if (state === "boss_alert") {
      ctx.save();
      const flash = Math.floor(frame / 8) % 2 === 0;
      ctx.fillStyle = flash ? "rgba(255, 30, 80, 0.28)" : "rgba(255, 30, 80, 0.08)";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = flash ? "#ff3366" : "#ffffff";
      ctx.shadowColor = "#ff3366";
      ctx.shadowBlur = 24;
      ctx.font = "800 24px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠️ WARNING: MEGA BOSS DETECTED ⚠️", W / 2, H / 2 - 20);

      ctx.font = "600 13px Orbitron, sans-serif";
      ctx.fillStyle = "#54f6ff";
      ctx.fillText("CYBER-COLOSSUS DREAD MOTHERSHIP ARRIVING", W / 2, H / 2 + 15);
      ctx.restore();
    }

    // Stage Clear / Transition Banner
    if (stageBannerTimer > 0 && state === "playing") {
      ctx.save();
      ctx.fillStyle = "rgba(7, 10, 28, 0.65)";
      ctx.fillRect(0, H / 2 - 40, W, 70);

      ctx.font = "800 20px Orbitron, sans-serif";
      ctx.fillStyle = "#54f6ff";
      ctx.shadowColor = "#54f6ff";
      ctx.shadowBlur = 18;
      ctx.textAlign = "center";
      ctx.fillText(stageBannerText, W / 2, H / 2 - 5);

      ctx.font = "600 11px Orbitron, sans-serif";
      ctx.fillStyle = "#63ffb0";
      ctx.fillText("OBJECTIVE: ELIMINATE ALL ALIEN CRAFT", W / 2, H / 2 + 18);
      ctx.restore();
    }

    // Sector & Watermark
    ctx.fillStyle = "#54f6ff";
    ctx.font = "10px Orbitron";
    ctx.textAlign = "left";
    ctx.fillText(`STAGE ${String(currentStage).padStart(2, "0")} // SECTOR 10`, 18, 24);

    ctx.fillStyle = "#ff4fd888";
    ctx.textAlign = "right";
    ctx.fillText("RB-06", W - 18, 24);

    ctx.restore();
  }

  function loop(t) {
    const dt = Math.min((t - lastTime) / 1000 || 0, 0.033);
    lastTime = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // --- Event Listeners ---
  startBtn.addEventListener("click", () => {
    start();
  });

  if (soundBtn) {
    soundBtn.addEventListener("click", () => {
      toggleSound();
    });
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    keys.add(e.key);

    if (e.key.toLowerCase() === "p" && !e.repeat) togglePause();
    if (e.key.toLowerCase() === "s" && !e.repeat) toggleSound();
    if (e.key === "Enter" && (state === "ready" || state === "over" || state === "victory")) {
      startBtn.click();
    }
  });

  window.addEventListener("keyup", (e) => keys.delete(e.key));

  window.addEventListener("blur", () => {
    keys.clear();
    if (state === "playing") togglePause();
  });

  function holdButton(id, setter) {
    const el = $(id);
    if (!el) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      initAudio();
      setter(true);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => {
      el.addEventListener(ev, () => setter(false));
    });
  }

  holdButton("left-btn", (v) => (touchLeft = v));
  holdButton("right-btn", (v) => (touchRight = v));
  holdButton("fire-btn", (v) => (touchFire = v));

  reset();
  requestAnimationFrame(loop);
})();
