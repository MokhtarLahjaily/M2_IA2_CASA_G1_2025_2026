/**
 * SnakeEvolved — Unified Game Loop (p5.js)
 *
 * PLAY and WATCH AI use the SAME game logic.
 * In Watch mode the player snake is AI-controlled (autoPlay).
 *
 * Features:
 *   - Unified updateGame() for both modes
 *   - Multiple food types (normal, bonus, poison, fleeing)
 *   - Power-ups (shield, speed boost, score multiplier)
 *   - Entity caps for 60fps performance
 *   - Difficulty scaling (more/harder enemies over time)
 *   - Camera shake on death/kill
 *   - Mobile touch/swipe controls
 *   - Minimap, leaderboard, particles, border warning
 */

// ─── ENTITY CAPS (60fps) ──────────────────────────────────
const MAX_PREY       = 25;
const MAX_ENEMIES    = 20;
const MAX_FOOD_ITEMS = 150;
const MAX_PARTICLES  = 200;
const MAX_POWER_UPS  = 3;
const MAX_OBSTACLES  = 12;
const MAX_MOVING_OBS = 5;

// ─── CONSTANTS ─────────────────────────────────────────────
const NB_INITIAL_PREY   = 18;
const NB_ENEMY_BOIDS    = 20;
const NB_OBSTACLES      = 6;
const NB_RIVALS         = 6;
const OBSTACLE_SPAWN_INTERVAL  = 600;
const OBSTACLE_DESPAWN_INTERVAL = 900;
const RIVAL_RESPAWN_DELAY = 300;
const POWER_UP_INTERVAL  = 900; // spawn a power-up every ~15s

const RIVAL_COLORS = [
  { head: "#FF4444", body: "#CC2222" },
  { head: "#AA44FF", body: "#7722CC" },
  { head: "#FF8800", body: "#CC6600" },
  { head: "#44DDFF", body: "#2299BB" },
  { head: "#FFDD00", body: "#BB9900" },
  { head: "#FF44AA", body: "#CC2288" },
];

const MILESTONES = [100, 250, 500, 1000, 2000, 5000];
let lastMilestone = 0;

// ─── SKINS ─────────────────────────────────────────────────
const SNAKE_SKINS = [
  { name: "Emerald",  head: "#00FF88", body: "#00CC66" },
  { name: "Sapphire", head: "#4488FF", body: "#2266CC" },
  { name: "Ruby",     head: "#FF4466", body: "#CC2244" },
  { name: "Gold",     head: "#FFDD44", body: "#CCAA22" },
  { name: "Violet",   head: "#BB44FF", body: "#8822CC" },
  { name: "Cyan",     head: "#44FFDD", body: "#22CCAA" },
  { name: "Coral",    head: "#FF8855", body: "#CC6633" },
  { name: "Pink",     head: "#FF66BB", body: "#CC4499" },
];
let selectedSkin = 0;
let playerName = "Player";

// ─── GLOBALS ───────────────────────────────────────────────
let snake;
let preys     = [];
let enemies   = [];
let obstacles  = [];
let movingObstacles = [];
let rivals    = [];
let foodItems = [];
let powerUps  = [];
let particles = [];

let score = 0;
let highScore = 0;
let gameState = "menu"; // "menu" | "playing" | "paused" | "gameover"
let isWatching = false; // true = Watch AI (same game, auto-piloted player)
let target;
let isNewRecord = false;

let obstacleSpawnTimer  = 0;
let obstacleDespawnTimer = 0;
let powerUpTimer = 0;

// Camera shake
let shakeAmount = 0;
let shakeDuration = 0;

// Menu particles
let menuParticles = [];

// Mobile touch
let touchStartX = 0, touchStartY = 0;
let touchTarget = null; // virtual joystick target for mobile

// Sounds
let sndEat, sndRivalKill, sndDeath, sndDash, sndGameOver, sndMilestone;
let soundsLoaded = false;

// ─── DIFFICULTY ────────────────────────────────────────────
function getDifficulty() {
  return constrain(map(score, 0, 2000, 0.15, 1.0), 0.15, 1.0);
}

// ─── PRELOAD ───────────────────────────────────────────────
function preload() {
  soundFormats('wav', 'mp3');
  try {
    sndEat       = loadSound('assets/eat_prey.wav');
    sndRivalKill = loadSound('assets/rival_killed.wav');
    sndDeath     = loadSound('assets/player_death.wav');
    sndDash      = loadSound('assets/dash.wav');
    sndGameOver  = loadSound('assets/game_over.wav');
    sndMilestone = loadSound('assets/milestone.wav');
    soundsLoaded = true;
  } catch (e) {
    console.warn("Sounds not loaded:", e);
    soundsLoaded = false;
  }
}

function playSound(snd) {
  if (soundsLoaded && snd && !snd.isPlaying()) snd.play();
}

// ─── SETUP ─────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  let saved = localStorage.getItem('snakeEvolved_highScore');
  if (saved) highScore = parseInt(saved);

  for (let i = 0; i < 80; i++) {
    menuParticles.push({
      x: random(width), y: random(height),
      vx: random(-0.6, 0.6), vy: random(-0.6, 0.6),
      r: random(2, 5),
      col: color(random([0, 80, 120]), random(180, 255), random(80, 200), random(60, 140)),
    });
  }
  target = createVector(width / 2, height / 2);
}

// ─── INIT GAME (unified) ──────────────────────────────────
function initGame(watchMode) {
  score = 0;
  lastMilestone = 0;
  isNewRecord = false;
  isWatching = watchMode;
  gameState = "playing";
  preys = []; enemies = []; obstacles = []; movingObstacles = [];
  rivals = []; foodItems = []; powerUps = []; particles = [];
  obstacleSpawnTimer = 0;
  obstacleDespawnTimer = 0;
  powerUpTimer = 0;
  shakeAmount = 0;
  shakeDuration = 0;

  // Player snake — identical in both modes
  let skin = SNAKE_SKINS[selectedSkin];
  snake = new Snake(width / 2, height / 2, 3, 12);
  snake.head.color = skin.head;
  for (let seg of snake.segments) seg.color = skin.body;
  snake.skinHead = skin.head;
  snake.skinBody = skin.body;
  snake.autoPlay = watchMode; // THE ONLY DIFFERENCE

  // Obstacles
  for (let i = 0; i < NB_OBSTACLES; i++) spawnObstacle();

  // Prey
  for (let i = 0; i < NB_INITIAL_PREY; i++) spawnPrey();

  // Enemy boids (fewer at start in play, full in watch)
  let boidCount = watchMode ? NB_ENEMY_BOIDS : floor(NB_ENEMY_BOIDS * 0.4);
  for (let i = 0; i < boidCount; i++) {
    enemies.push(new EnemyBoid(random(50, width - 50), random(50, height - 50)));
  }

  // Rivals
  _rivalNameIndex = 0;
  for (let i = 0; i < NB_RIVALS; i++) {
    let rx, ry;
    do {
      rx = random(100, width - 100);
      ry = random(100, height - 100);
    } while (dist(rx, ry, width / 2, height / 2) < 250);
    let c = RIVAL_COLORS[i % RIVAL_COLORS.length];
    let diff = watchMode
      ? random(0.3, 1.0)
      : constrain(getDifficulty() + random(-0.3, 0.3), 0.05, 1.0);
    rivals.push(new SnakeRival(rx, ry, 3, 11, c.head, c.body, diff));
  }

  target = createVector(mouseX, mouseY);
}

// ─── MAIN LOOP ─────────────────────────────────────────────
function draw() {
  // Camera shake
  if (shakeDuration > 0) {
    shakeDuration--;
    translate(random(-shakeAmount, shakeAmount), random(-shakeAmount, shakeAmount));
    shakeAmount *= 0.92;
  }

  background(15, 18, 25);

  if (gameState === "menu") {
    cursor(ARROW);
    drawMenu();
  } else if (gameState === "playing") {
    if (isWatching) cursor(ARROW); else noCursor();
    drawGrid();
    if (!isWatching) {
      // Use touch target on mobile, mouse on desktop
      if (touchTarget) target.set(touchTarget.x, touchTarget.y);
      else target.set(mouseX, mouseY);
    }
    updateGame();
    drawHUD();
  } else if (gameState === "paused") {
    cursor(ARROW);
    drawGrid();
    drawScene();
    drawHUD();
    drawPaused();
  } else if (gameState === "gameover") {
    cursor(ARROW);
    drawGrid();
    drawScene();
    drawGameOver();
  }
}

// ─── UNIFIED UPDATE ────────────────────────────────────────
function updateGame() {
  // Entity cap: trim food
  while (foodItems.length > MAX_FOOD_ITEMS) foodItems.shift();
  while (particles.length > MAX_PARTICLES) particles.shift();

  let allObs = obstacles.concat(movingObstacles);

  // ── 1. Prey AI + eating ──
  for (let i = preys.length - 1; i >= 0; i--) {
    let p = preys[i];
    p.applyBehaviors(snake, allObs, rivals);
    p.update();

    // Player eats
    if (snake.alive && snake.tryEat(p)) {
      if (p.isPoison) {
        snake.shrink(3);
        triggerShake(4, 8);
      } else {
        score += p.points * snake.scoreMultiplier;
        checkMilestone();
        if (score > highScore) { highScore = score; isNewRecord = true; saveHighScore(); }
        playSound(sndEat);
      }
      preys.splice(i, 1);
      continue;
    }

    // Rival eats
    let eaten = false;
    for (let rival of rivals) {
      if (rival.tryEat(p)) {
        preys.splice(i, 1);
        eaten = true;
        break;
      }
    }
    if (eaten) continue;
  }

  // ── 2. Food items (dead snake segments) ──
  for (let i = foodItems.length - 1; i >= 0; i--) {
    let f = foodItems[i];
    // Player eats
    if (snake.alive) {
      let d = p5.Vector.dist(snake.head.pos, f.pos);
      if (d < snake.segSize + f.r) {
        snake.grow();
        score += 5 * snake.scoreMultiplier;
        checkMilestone();
        if (score > highScore) { highScore = score; isNewRecord = true; saveHighScore(); }
        playSound(sndEat);
        foodItems.splice(i, 1);
        continue;
      }
    }
    // Rivals eat
    let eaten = false;
    for (let rival of rivals) {
      if (!rival.alive) continue;
      let dr = p5.Vector.dist(rival.head.pos, f.pos);
      if (dr < rival.segSize + f.r) {
        rival.grow();
        foodItems.splice(i, 1);
        eaten = true;
        break;
      }
    }
  }

  // ── 3. Power-ups spawn + collection ──
  powerUpTimer++;
  if (powerUpTimer >= POWER_UP_INTERVAL && powerUps.length < MAX_POWER_UPS) {
    spawnPowerUp();
    powerUpTimer = 0;
  }
  for (let i = powerUps.length - 1; i >= 0; i--) {
    let pu = powerUps[i];
    pu.updatePowerUp();
    if (pu.expired) { powerUps.splice(i, 1); continue; }
    // Player picks up
    if (snake.alive) {
      let d = p5.Vector.dist(snake.head.pos, pu.pos);
      if (d < snake.segSize + pu.r) {
        if (pu.type === 'shield') snake.activateShield();
        else if (pu.type === 'speed') snake.activateSpeedBoost();
        else if (pu.type === 'multiplier') snake.activateMultiplier();
        createPowerUpParticles(pu.pos.x, pu.pos.y, pu.baseColor);
        powerUps.splice(i, 1);
        continue;
      }
    }
    // Rivals can pick up too (only shield and speed)
    for (let rival of rivals) {
      if (!rival.alive) continue;
      let dr = p5.Vector.dist(rival.head.pos, pu.pos);
      if (dr < rival.segSize + pu.r) {
        // Rivals just grow a bit as a bonus
        rival.grow(); rival.grow();
        powerUps.splice(i, 1);
        break;
      }
    }
  }

  // ── 4. Respawn prey (with variety) ──
  while (preys.length < MAX_PREY) spawnPrey();

  // ── 5. Enemy boids ──
  // Cap enemies
  while (enemies.length > MAX_ENEMIES) enemies.pop();
  for (let e of enemies) {
    e.applyBehaviors(enemies, snake, allObs, rivals);
    e.update();
  }

  // ── 6. Rivals ──
  for (let rival of rivals) {
    rival.update(preys, allObs, rivals, snake, foodItems);
  }
  respawnRivals();

  // ── 7. Dynamic obstacles ──
  updateDynamicObstacles();
  updateMovingObstacles(allObs);

  // ── 8. Snake update (player OR autoPlay — same function path) ──
  if (snake.alive) {
    if (snake.autoPlay) {
      snake.updateAutoPlay(allObs, preys, foodItems, rivals);
      // Auto-play score tracking (earns score passively for watching)
      if (frameCount % 120 === 0) {
        score += snake.length;
        if (score > highScore) { highScore = score; isNewRecord = true; saveHighScore(); }
      }
    } else {
      snake.update(target, allObs);
    }
  }

  // ── 9. Snake collision: enemies ──
  if (snake.alive) snake.checkEnemyCollision(enemies);

  // ── 10. Snake.io collision: snake ↔ rivals ──
  for (let i = rivals.length - 1; i >= 0; i--) {
    let rival = rivals[i];
    if (!rival.alive || !snake.alive) continue;
    let result = snake.checkSnakeIoCollision(rival);
    if (result === 'rival_dies') {
      dropFood(rival);
      createDeathParticles(rival.head.pos.x, rival.head.pos.y, rival.headColor);
      rival.alive = false;
      score += 50 * snake.scoreMultiplier;
      checkMilestone();
      if (score > highScore) { highScore = score; isNewRecord = true; saveHighScore(); }
      playSound(sndRivalKill);
      triggerShake(5, 10);
    } else if (result === 'player_dies') {
      snake.alive = false;
    } else if (result === 'both_die') {
      dropFood(rival);
      createDeathParticles(rival.head.pos.x, rival.head.pos.y, rival.headColor);
      rival.alive = false;
      snake.alive = false;
    }
  }

  // ── 11. Rival ↔ rival collisions ──
  handleRivalCollisions();

  // ── 12. Self collision ──
  if (snake.alive && snake.checkSelfCollision()) {
    snake.alive = false;
  }

  // ── 13. Player death ──
  if (!snake.alive && gameState === "playing") {
    dropFood(snake);
    playSound(sndDeath);
    playSound(sndGameOver);
    triggerShake(12, 20);
    gameState = "gameover";
  }

  // ── 14. Draw everything ──
  drawScene();
  updateAndDrawParticles();
  drawBorderDangerWarning();
  drawMinimap();
  drawLeaderboard();
}

// ─── DRAW SCENE ────────────────────────────────────────────
function drawScene() {
  for (let o of obstacles) o.show();
  for (let mo of movingObstacles) mo.show();

  // Food items (glowing)
  for (let f of foodItems) {
    push(); noStroke();
    let pulse = sin(frameCount * 0.1 + (f.pos.x + f.pos.y) * 0.01) * 0.2 + 1;
    let gsz = f.r * pulse * 2;
    let c = color(f.color);
    for (let ring = 2; ring >= 0; ring--) {
      fill(red(c), green(c), blue(c), 40 - ring * 12);
      ellipse(f.pos.x, f.pos.y, gsz + ring * 6);
    }
    fill(f.color); ellipse(f.pos.x, f.pos.y, gsz);
    fill(255, 255, 255, 150);
    ellipse(f.pos.x - f.r * 0.2, f.pos.y - f.r * 0.2, gsz * 0.25);
    pop();
  }

  // Power-ups
  for (let pu of powerUps) pu.show();

  // Prey
  for (let p of preys) p.show();

  // Enemies
  for (let e of enemies) e.show();

  // Rivals
  for (let r of rivals) r.show();

  // Snake
  if (snake.alive) {
    snake.show();
    // Crosshair (only when player-controlled)
    if (!isWatching) {
      push(); noFill();
      stroke(0, 255, 136, 120); strokeWeight(2);
      ellipse(target.x, target.y, 20);
      line(target.x - 12, target.y, target.x + 12, target.y);
      line(target.x, target.y - 12, target.x, target.y + 12);
      pop();
    }
  }
}

// ─── GRID ──────────────────────────────────────────────────
function drawGrid() {
  push();
  stroke(30, 35, 45); strokeWeight(1);
  for (let x = 0; x < width; x += 50) line(x, 0, x, height);
  for (let y = 0; y < height; y += 50) line(0, y, width, y);
  pop();
}

// ─── UNIFIED HUD ───────────────────────────────────────────
function drawHUD() {
  push(); noStroke(); textFont("monospace");

  // Watch mode banner
  if (isWatching) {
    fill(0, 0, 0, 180);
    rect(0, 0, width, 44);
    textAlign(CENTER, CENTER);
    fill(100, 180, 255); textSize(20); textStyle(BOLD);
    text("👁  SPECTATOR MODE — AI Auto-Play", width / 2, 22);
    textStyle(NORMAL);
  }

  // Stats panel
  let panelY = isWatching ? 50 : 10;
  fill(0, 0, 0, 160);
  rect(10, panelY, 270, Vehicle.debug ? 310 : 260, 8);

  fill(255); textSize(14); textAlign(LEFT, TOP);
  let y = panelY + 12;
  const lh = 22;
  text(`🐍  Score : ${score}`, 20, y); y += lh;
  text(`🏆  High Score : ${highScore}`, 20, y); y += lh;
  text(`📏  Length : ${snake.length}`, 20, y); y += lh;
  text(`🎯  Prey : ${preys.length}`, 20, y); y += lh;
  text(`👾  Boids : ${enemies.length}`, 20, y); y += lh;
  let aliveRivals = rivals.filter(r => r.alive).length;
  text(`🐉  Rivals : ${aliveRivals}`, 20, y); y += lh;
  text(`💀  Food : ${foodItems.length}`, 20, y); y += lh;

  // Active power-ups
  let buffs = [];
  if (snake.hasShield) buffs.push(`🛡️ ${ceil(snake.shieldTimer / 60)}s`);
  if (snake.hasSpeedBoost) buffs.push(`⚡ ${ceil(snake.speedBoostTimer / 60)}s`);
  if (snake.hasMultiplier) buffs.push(`✨ x${snake.scoreMultiplier} ${ceil(snake.multiplierTimer / 60)}s`);
  if (buffs.length > 0) {
    fill(0, 255, 200); textSize(12);
    text(buffs.join("  "), 20, y); y += lh;
  }

  // Dash bar
  if (snake.alive) {
    y += 2;
    let barW = 220;
    let ready = snake.dashCooldown <= 0 && snake.segments.length > 2;
    let label = snake.dashing ? "DASH ⚡"
      : (ready ? (isWatching ? "DASH [AUTO]" : "DASH [CLICK]")
        : `DASH (${(snake.dashCooldown / 60).toFixed(1)}s)`);
    fill(200); textSize(11);
    text(label, 20, y + 3);
    fill(40); rect(20, y + 16, barW, 8, 4);
    if (snake.dashing) {
      let pct = 1 - snake.dashDuration / snake.dashMaxDuration;
      fill(0, 255, 200); rect(20, y + 16, barW * pct, 8, 4);
    } else if (snake.dashCooldown > 0) {
      let pct = 1 - snake.dashCooldown / snake.dashCooldownMax;
      fill(100); rect(20, y + 16, barW * pct, 8, 4);
    } else {
      fill(0, 255, 136); rect(20, y + 16, barW, 8, 4);
    }
    y += 28;
  }

  if (Vehicle.debug) {
    fill(255); textSize(14);
    text(`⚡  FPS : ${floor(frameRate())}`, 20, y); y += lh;
    fill(255, 255, 0);
    text(`🔧  DEBUG MODE`, 20, y); y += lh;
  }

  // Controls hint
  fill(255, 255, 255, 100); textSize(12); textAlign(LEFT, BOTTOM);
  if (isWatching) {
    text("[M] Menu  •  [D] Debug  •  [P] Pause  •  [ENTER] Take Control", 10, height - 15);
  } else {
    text("[CLICK] Dash  •  [D] Debug  •  [P] Pause  •  [M] Menu  •  [R] Restart", 10, height - 15);
  }
  pop();
}

// ─── PAUSE OVERLAY ─────────────────────────────────────────
function drawPaused() {
  push();
  // Dark overlay
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);

  textAlign(CENTER, CENTER); textFont("monospace");

  // Title
  let glow = sin(frameCount * 0.05) * 30 + 225;
  fill(glow, glow, 255); textSize(52); textStyle(BOLD);
  text("⏸  PAUSED", width / 2, height / 2 - 80);

  // Stats
  fill(220); textSize(20); textStyle(NORMAL);
  text(`Score: ${score}   •   Length: ${snake.length}   •   Best: ${highScore}`, width / 2, height / 2 - 20);
  let aliveRivals = rivals.filter(r => r.alive).length;
  fill(180); textSize(16);
  text(`Rivals: ${aliveRivals}   •   Prey: ${preys.length}   •   Boids: ${enemies.length}`, width / 2, height / 2 + 15);

  // Buttons
  let bw = 220, bh = 50;

  // Resume
  let resumeY = height / 2 + 80;
  let resumeH = mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
                mouseY > resumeY - bh / 2 && mouseY < resumeY + bh / 2;
  fill(resumeH ? color(0, 220, 120, 220) : color(0, 180, 100, 180));
  stroke(0, 255, 136, resumeH ? 100 : 40); strokeWeight(2);
  rect(width / 2 - bw / 2, resumeY - bh / 2, bw, bh, 10);
  noStroke(); fill(255); textSize(22); textStyle(BOLD);
  text("▶  RESUME [P]", width / 2, resumeY);

  // Restart
  let restartY = height / 2 + 145;
  let restartH = mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
                 mouseY > restartY - bh / 2 && mouseY < restartY + bh / 2;
  fill(restartH ? color(220, 180, 50, 220) : color(180, 140, 30, 180));
  stroke(255, 200, 50, restartH ? 100 : 40); strokeWeight(2);
  rect(width / 2 - bw / 2, restartY - bh / 2, bw, bh, 10);
  noStroke(); fill(255); textSize(22); textStyle(BOLD);
  text("🔄  RESTART [R]", width / 2, restartY);

  // Menu
  let menuY = height / 2 + 210;
  let menuH = mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
              mouseY > menuY - bh / 2 && mouseY < menuY + bh / 2;
  fill(menuH ? color(120, 120, 140, 220) : color(80, 80, 100, 180));
  stroke(150, 150, 170, menuH ? 100 : 40); strokeWeight(2);
  rect(width / 2 - bw / 2, menuY - bh / 2, bw, bh, 10);
  noStroke(); fill(255); textSize(22); textStyle(BOLD);
  text("◀  MENU [M]", width / 2, menuY);

  pop();
}

// ─── MENU ──────────────────────────────────────────────────
function drawMenu() {
  // Animated particles
  for (let p of menuParticles) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = width; if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height; if (p.y > height) p.y = 0;
    push(); noStroke(); fill(p.col);
    ellipse(p.x, p.y, p.r * 2);
    pop();
  }
  push();
  for (let i = 0; i < menuParticles.length; i++) {
    for (let j = i + 1; j < menuParticles.length; j++) {
      let d = dist(menuParticles[i].x, menuParticles[i].y, menuParticles[j].x, menuParticles[j].y);
      if (d < 100) {
        stroke(0, 255, 136, map(d, 0, 100, 40, 0)); strokeWeight(0.5);
        line(menuParticles[i].x, menuParticles[i].y, menuParticles[j].x, menuParticles[j].y);
      }
    }
  }
  pop();

  push();
  textAlign(CENTER, CENTER); textFont("monospace");
  let glow = sin(frameCount * 0.04) * 30 + 225;
  fill(0, glow, 100); textSize(72); textStyle(BOLD);
  text("🐍 SnakeEvolved", width / 2, height * 0.13);
  fill(180, 200, 220, 180); textSize(18); textStyle(NORMAL);
  text("Steering Behaviors • Snake.io • AI Rivals", width / 2, height * 0.20);
  if (highScore > 0) {
    fill(255, 215, 0); textSize(20);
    text(`🏆 Best Score: ${highScore}`, width / 2, height * 0.26);
  }

  // Name input
  drawNameInput();
  // Skin selector
  drawSkinSelector();

  // PLAY button
  let btnX = width / 2, btnW = 280, btnH = 60;
  let playY = height * 0.64;
  let playH = mouseX > btnX - btnW / 2 && mouseX < btnX + btnW / 2 &&
              mouseY > playY - btnH / 2 && mouseY < playY + btnH / 2;
  fill(playH ? color(0, 220, 120, 220) : color(0, 180, 100, 180));
  stroke(0, 255, 136, playH ? 100 : 40); strokeWeight(playH ? 3 : 2);
  rect(btnX - btnW / 2, playY - btnH / 2, btnW, btnH, 12);
  noStroke(); fill(255); textSize(28); textStyle(BOLD);
  text("▶  PLAY", btnX, playY);

  // WATCH AI button
  let watchY = height * 0.77;
  let watchH = mouseX > btnX - btnW / 2 && mouseX < btnX + btnW / 2 &&
               mouseY > watchY - btnH / 2 && mouseY < watchY + btnH / 2;
  fill(watchH ? color(80, 120, 220, 220) : color(60, 90, 180, 180));
  stroke(100, 150, 255, watchH ? 100 : 40); strokeWeight(watchH ? 3 : 2);
  rect(btnX - btnW / 2, watchY - btnH / 2, btnW, btnH, 12);
  noStroke(); fill(255); textSize(28); textStyle(BOLD);
  text("👁  WATCH AI", btnX, watchY);

  fill(255, 255, 255, 80); textSize(13); textStyle(NORMAL);
  text("[ENTER] Play  •  [W] Watch AI  •  [D] Toggle Debug", width / 2, height * 0.88);

  // Decorative snakes
  let t = frameCount * 0.02;
  let py = height * 0.94;
  push(); noFill(); strokeWeight(6); stroke(0, 255, 136, 60);
  beginShape();
  for (let i = 0; i < 20; i++) vertex(width * 0.15 + i * 18, py + sin(t + i * 0.5) * 15);
  endShape();
  fill(0, 255, 136, 120); noStroke();
  ellipse(width * 0.15 + 19 * 18, py + sin(t + 19 * 0.5) * 15, 14);
  pop();
  push(); noFill(); strokeWeight(5); stroke(255, 68, 68, 50);
  beginShape();
  for (let i = 0; i < 16; i++) vertex(width * 0.55 + i * 16, py + cos(t * 1.3 + i * 0.6) * 12);
  endShape();
  fill(255, 68, 68, 100); noStroke();
  ellipse(width * 0.55 + 15 * 16, py + cos(t * 1.3 + 15 * 0.6) * 12, 12);
  pop();
  pop();
}

// ─── GAME OVER ─────────────────────────────────────────────
function drawGameOver() {
  push();
  fill(0, 0, 0, 150); rect(0, 0, width, height);
  textAlign(CENTER, CENTER); textFont("monospace");
  fill(255, 60, 60); textSize(58); textStyle(BOLD);
  text("GAME OVER", width / 2, height / 2 - 70);

  if (isNewRecord) {
    let p = sin(frameCount * 0.08) * 30 + 225;
    fill(255, 215, 0, p); textSize(26);
    text("⭐ NEW RECORD! ⭐", width / 2, height / 2 - 20);
  }

  fill(255); textSize(22); textStyle(NORMAL);
  text(`Score: ${score}   •   Length: ${snake.length}   •   Best: ${highScore}`, width / 2, height / 2 + 20);

  let bw = 200, bh = 48;

  // Play Again
  let paY = height / 2 + 80;
  let paH = mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
            mouseY > paY - bh / 2 && mouseY < paY + bh / 2;
  fill(paH ? color(0, 220, 120, 220) : color(0, 180, 100, 180));
  stroke(0, 255, 136, paH ? 100 : 40); strokeWeight(2);
  rect(width / 2 - bw / 2, paY - bh / 2, bw, bh, 10);
  noStroke(); fill(255); textSize(20); textStyle(BOLD);
  text("▶ PLAY AGAIN [R]", width / 2, paY);

  // Watch AI
  let waY = height / 2 + 145;
  let waH = mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
            mouseY > waY - bh / 2 && mouseY < waY + bh / 2;
  fill(waH ? color(80, 120, 220, 220) : color(60, 90, 180, 180));
  stroke(100, 150, 255, waH ? 100 : 40); strokeWeight(2);
  rect(width / 2 - bw / 2, waY - bh / 2, bw, bh, 10);
  noStroke(); fill(255); textSize(20); textStyle(BOLD);
  text("👁 WATCH AI [W]", width / 2, waY);

  // Menu
  let mY = height / 2 + 210;
  let mH = mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
           mouseY > mY - bh / 2 && mouseY < mY + bh / 2;
  fill(mH ? color(120, 120, 140, 220) : color(80, 80, 100, 180));
  stroke(150, 150, 170, mH ? 100 : 40); strokeWeight(2);
  rect(width / 2 - bw / 2, mY - bh / 2, bw, bh, 10);
  noStroke(); fill(255); textSize(20); textStyle(BOLD);
  text("◀ MENU [M]", width / 2, mY);
  pop();
}

// ─── SPAWN HELPERS ─────────────────────────────────────────
function spawnPrey() {
  let px, py, valid, attempts = 0;
  do {
    px = random(60, width - 60);
    py = random(60, height - 60);
    valid = true;
    for (let o of obstacles) {
      if (dist(px, py, o.pos.x, o.pos.y) < o.r + 30) { valid = false; break; }
    }
    if (snake && snake.alive && dist(px, py, snake.pos.x, snake.pos.y) < 100) valid = false;
    attempts++;
  } while (!valid && attempts < 50);

  // Variety based on difficulty
  let roll = random();
  let diff = getDifficulty();
  if (roll < 0.05 + diff * 0.05) {
    preys.push(new PoisonPrey(px, py));     // 5-10%
  } else if (roll < 0.15 + diff * 0.05) {
    preys.push(new BonusPrey(px, py));      // 10-15%
  } else if (roll < 0.22 + diff * 0.08) {
    preys.push(new FleeingPrey(px, py));    // 7-13%
  } else {
    preys.push(new Prey(px, py));           // rest: normal
  }
}

function spawnObstacle() {
  let ox, oy, r, valid = false, attempts = 0;
  while (!valid && attempts < 60) {
    r = random(25, 55);
    ox = random(r + 60, width - r - 60);
    oy = random(r + 60, height - r - 60);
    valid = true;
    if (dist(ox, oy, width / 2, height / 2) < 150) valid = false;
    if (valid && snake && snake.alive) {
      let safe = r + snake.segSize + 20;
      if (dist(ox, oy, snake.head.pos.x, snake.head.pos.y) < safe) valid = false;
      if (valid) for (let seg of snake.segments)
        if (dist(ox, oy, seg.pos.x, seg.pos.y) < safe) { valid = false; break; }
    }
    if (valid) for (let o of obstacles)
      if (dist(ox, oy, o.pos.x, o.pos.y) < o.r + r + 30) { valid = false; break; }
    if (valid) for (let rival of rivals) {
      if (!rival.alive) continue;
      let safe = r + rival.segSize + 20;
      if (dist(ox, oy, rival.head.pos.x, rival.head.pos.y) < safe) { valid = false; break; }
    }
    attempts++;
  }
  if (valid) {
    let c = lerpColor(color(100, 60, 60, 180), color(180, 100, 50, 200), random());
    obstacles.push(new Obstacle(ox, oy, r, c));
  }
}

function spawnMovingObstacle() {
  let px, py, valid, attempts = 0;
  do {
    px = random(100, width - 100);
    py = random(100, height - 100);
    valid = true;
    for (let o of obstacles) if (dist(px, py, o.pos.x, o.pos.y) < o.r + 60) { valid = false; break; }
    for (let mo of movingObstacles) if (dist(px, py, mo.pos.x, mo.pos.y) < mo.r + 60) { valid = false; break; }
    if (snake && snake.alive && dist(px, py, snake.pos.x, snake.pos.y) < 150) valid = false;
    attempts++;
  } while (!valid && attempts < 50);
  movingObstacles.push(new MovingObstacle(px, py, random(18, 32)));
}

function spawnPowerUp() {
  let px, py, attempts = 0, valid;
  do {
    px = random(80, width - 80);
    py = random(80, height - 80);
    valid = true;
    for (let o of obstacles) if (dist(px, py, o.pos.x, o.pos.y) < o.r + 40) { valid = false; break; }
    attempts++;
  } while (!valid && attempts < 40);
  let types = ['shield', 'speed', 'multiplier'];
  powerUps.push(new PowerUp(px, py, random(types)));
}

function spawnFoodAt(x, y, col) {
  if (foodItems.length < MAX_FOOD_ITEMS)
    foodItems.push({ pos: createVector(x, y), r: 5, color: col || '#88FF88' });
}

function dropFood(snakeObj) {
  let segs = snakeObj.getSegmentPositions();
  for (let s of segs) {
    if (foodItems.length < MAX_FOOD_ITEMS)
      foodItems.push({ pos: createVector(s.x, s.y), r: 6, color: s.color });
  }
}

// ─── DYNAMIC OBSTACLES ────────────────────────────────────
function updateDynamicObstacles() {
  obstacleSpawnTimer++;
  obstacleDespawnTimer++;

  if (obstacleSpawnTimer >= OBSTACLE_SPAWN_INTERVAL && obstacles.length < MAX_OBSTACLES) {
    spawnObstacle();
    obstacleSpawnTimer = 0;
  }
  if (obstacleDespawnTimer >= OBSTACLE_DESPAWN_INTERVAL && obstacles.length > 3) {
    // Remove farthest from player (or random if watching)
    let idx = 0;
    if (snake && snake.alive) {
      let farthest = 0;
      for (let i = 0; i < obstacles.length; i++) {
        let d = p5.Vector.dist(obstacles[i].pos, snake.head.pos);
        if (d > farthest) { farthest = d; idx = i; }
      }
    } else {
      idx = floor(random(obstacles.length));
    }
    obstacles.splice(idx, 1);
    obstacleDespawnTimer = 0;
  }
}

function updateMovingObstacles(allObs) {
  let desired = min(floor(score / 5), MAX_MOVING_OBS);
  while (movingObstacles.length < desired) spawnMovingObstacle();
  for (let mo of movingObstacles) mo.update(allObs);
}

// ─── RIVAL MANAGEMENT ─────────────────────────────────────
function handleRivalCollisions() {
  for (let i = 0; i < rivals.length; i++) {
    for (let j = i + 1; j < rivals.length; j++) {
      let a = rivals[i], b = rivals[j];
      if (!a.alive || !b.alive) continue;
      let result = a.checkSnakeIoCollision(b);
      if (result === 'self_dies') {
        dropFood(a);
        createDeathParticles(a.head.pos.x, a.head.pos.y, a.headColor);
        a.alive = false;
        playSound(sndRivalKill);
      } else if (result === 'other_dies') {
        dropFood(b);
        createDeathParticles(b.head.pos.x, b.head.pos.y, b.headColor);
        b.alive = false;
        playSound(sndRivalKill);
      } else if (result === 'both_die') {
        dropFood(a); dropFood(b);
        createDeathParticles(a.head.pos.x, a.head.pos.y, a.headColor);
        createDeathParticles(b.head.pos.x, b.head.pos.y, b.headColor);
        a.alive = false; b.alive = false;
        playSound(sndRivalKill);
      }
    }
  }
}

function respawnRivals() {
  for (let i = 0; i < rivals.length; i++) {
    let rival = rivals[i];
    if (!rival.alive) {
      if (rival.respawnTimer === undefined) rival.respawnTimer = 0;
      rival.respawnTimer++;
      if (rival.respawnTimer >= RIVAL_RESPAWN_DELAY) {
        let rx, ry, valid, attempts = 0;
        do {
          rx = random(100, width - 100);
          ry = random(100, height - 100);
          valid = true;
          if (snake && snake.alive && dist(rx, ry, snake.pos.x, snake.pos.y) < 200) valid = false;
          for (let o of obstacles)
            if (dist(rx, ry, o.pos.x, o.pos.y) < o.r + 50) { valid = false; break; }
          attempts++;
        } while (!valid && attempts < 40);
        let c = RIVAL_COLORS[i % RIVAL_COLORS.length];
        let diff = constrain(getDifficulty() + random(-0.3, 0.3), 0.05, 1.0);
        rivals[i] = new SnakeRival(rx, ry, 3, 11, c.head, c.body, diff);
      }
    }
  }
}

// ─── MILESTONES ────────────────────────────────────────────
function checkMilestone() {
  for (let m of MILESTONES) {
    if (score >= m && lastMilestone < m) {
      lastMilestone = m;
      playSound(sndMilestone);
      triggerShake(3, 6);
      // Scale up enemy boids
      let desired = floor(map(score, 0, 2000, NB_ENEMY_BOIDS * 0.4, NB_ENEMY_BOIDS));
      desired = constrain(desired, 0, MAX_ENEMIES);
      while (enemies.length < desired) {
        let ex = random(50, width - 50), ey = random(50, height - 50);
        if (snake && snake.alive && dist(ex, ey, snake.head.pos.x, snake.head.pos.y) < 200) continue;
        enemies.push(new EnemyBoid(ex, ey));
      }
      break;
    }
  }
}

function saveHighScore() {
  localStorage.setItem('snakeEvolved_highScore', highScore);
}

// ─── CAMERA SHAKE ──────────────────────────────────────────
function triggerShake(amount, duration) {
  shakeAmount = amount;
  shakeDuration = duration;
}

// ─── PARTICLES ─────────────────────────────────────────────
function createDeathParticles(x, y, col) {
  for (let i = 0; i < 25 && particles.length < MAX_PARTICLES; i++) {
    particles.push({
      pos: createVector(x, y),
      vel: p5.Vector.random2D().mult(random(2, 9)),
      size: random(3, 11),
      color: color(col || '#FF8844'),
      life: floor(random(40, 70))
    });
  }
}

function createBoostParticle(x, y, col) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({
    pos: createVector(x, y),
    vel: p5.Vector.random2D().mult(random(1, 3)),
    size: random(2, 5),
    color: color(col || '#00FF88'),
    life: 25
  });
}

function createPowerUpParticles(x, y, col) {
  for (let i = 0; i < 15 && particles.length < MAX_PARTICLES; i++) {
    particles.push({
      pos: createVector(x, y),
      vel: p5.Vector.random2D().mult(random(3, 7)),
      size: random(4, 9),
      color: col || color(255, 215, 0),
      life: floor(random(30, 50))
    });
  }
}

function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.pos.add(p.vel);
    p.vel.mult(0.94);
    p.life--;
    if (p.life > 0) {
      push();
      let alpha = map(p.life, 0, 70, 0, 255);
      fill(red(p.color), green(p.color), blue(p.color), alpha);
      noStroke();
      ellipse(p.pos.x, p.pos.y, p.size * (p.life / 70 + 0.3));
      pop();
    } else {
      particles.splice(i, 1);
    }
  }
}

// ─── BORDER WARNING ────────────────────────────────────────
function drawBorderDangerWarning() {
  if (!snake || !snake.alive) return;
  let margin = 60;
  let hx = snake.head.pos.x, hy = snake.head.pos.y;
  if (hx < margin || hx > width - margin || hy < margin || hy > height - margin) {
    push(); noFill();
    for (let i = 0; i < 4; i++) {
      stroke(255, 0, 0, 80 - i * 18);
      strokeWeight(15 + i * 8);
      rect(0, 0, width, height);
    }
    textAlign(CENTER, CENTER); textFont("monospace");
    textSize(26);
    fill(255, 50, 50, 180 + sin(frameCount * 0.2) * 75);
    stroke(0); strokeWeight(3);
    text("⚠️ DANGER — BORDER ⚠️", width / 2, 50);
    pop();
  }
}

// ─── MINIMAP ───────────────────────────────────────────────
function drawMinimap() {
  let sz = 140;
  let mx = width - sz - 12, my = height - sz - 12;
  let sx = sz / width, sy = sz / height;
  push();
  fill(0, 140); stroke(80); strokeWeight(2);
  rect(mx, my, sz, sz, 5);
  noStroke();
  for (let o of obstacles) {
    fill(180, 80, 60, 180);
    ellipse(mx + o.pos.x * sx, my + o.pos.y * sy, max(3, o.r * sx * 2));
  }
  for (let mo of movingObstacles) {
    fill(255, 150, 40, 200);
    ellipse(mx + mo.pos.x * sx, my + mo.pos.y * sy, max(4, mo.r * sx * 2));
  }
  for (let f of foodItems) {
    fill(f.color);
    ellipse(mx + f.pos.x * sx, my + f.pos.y * sy, 2);
  }
  fill(255, 220, 80, 150);
  for (let p of preys) ellipse(mx + p.pos.x * sx, my + p.pos.y * sy, 3);
  fill(255, 80, 80, 120);
  for (let e of enemies) ellipse(mx + e.pos.x * sx, my + e.pos.y * sy, 2);
  for (let r of rivals) {
    if (!r.alive) continue;
    fill(r.headColor || '#FF4444');
    ellipse(mx + r.head.pos.x * sx, my + r.head.pos.y * sy, 5);
  }
  // Power-ups on minimap
  for (let pu of powerUps) {
    fill(red(pu.baseColor), green(pu.baseColor), blue(pu.baseColor), 200);
    ellipse(mx + pu.pos.x * sx, my + pu.pos.y * sy, 6);
  }
  if (snake && snake.alive) {
    let px = mx + snake.head.pos.x * sx, py = my + snake.head.pos.y * sy;
    fill(0, 255, 136, 80); ellipse(px, py, 14);
    fill(0, 255, 136); ellipse(px, py, 6);
  }
  pop();
}

// ─── LEADERBOARD ───────────────────────────────────────────
function drawLeaderboard() {
  let entries = [];
  if (snake && snake.alive)
    entries.push({ name: playerName || 'Player', length: snake.length, isPlayer: true });
  for (let r of rivals) {
    if (!r.alive) continue;
    entries.push({ name: r.name || "Bot", length: r.length, isPlayer: false, color: r.headColor });
  }
  entries.sort((a, b) => b.length - a.length);

  let lbX = width - 165, lbY = 12;
  let maxShow = min(5, entries.length);
  push();
  fill(0, 0, 0, 150); noStroke();
  rect(lbX - 8, lbY - 5, 168, 28 + maxShow * 20, 6);
  textFont("monospace"); textAlign(LEFT, TOP);
  fill(255, 215, 0); textSize(13); textStyle(BOLD);
  text("🏆 Leaderboard", lbX, lbY); textStyle(NORMAL);
  for (let i = 0; i < maxShow; i++) {
    let e = entries[i];
    let y = lbY + 22 + i * 20;
    if (e.isPlayer) {
      fill(0, 200, 100, 80); noStroke();
      rect(lbX - 4, y - 2, 160, 18, 3);
    }
    fill(e.isPlayer ? color(100, 255, 130) : color(255));
    textSize(12); textAlign(LEFT, TOP);
    let medal = i === 0 ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : `${i + 1}.`));
    text(`${medal} ${e.name}`, lbX, y);
    textAlign(RIGHT, TOP);
    text(`${e.length}`, lbX + 155, y);
  }
  pop();
}

// ─── NAME INPUT ────────────────────────────────────────────
function drawNameInput() {
  push(); textFont("monospace");
  fill(25, 30, 45, 200); stroke(60); strokeWeight(2); rectMode(CENTER);
  rect(width / 2, height * 0.34, 280, 65, 10);
  fill(180); noStroke(); textSize(13); textAlign(CENTER, CENTER);
  text("Your Name:", width / 2, height * 0.34 - 18);
  fill(0, 255, 136); textSize(24);
  let display = playerName;
  if (frameCount % 60 < 30) display += "_";
  text(display || "_", width / 2, height * 0.34 + 8);
  pop();
}

// ─── SKIN SELECTOR ─────────────────────────────────────────
function drawSkinSelector() {
  push(); textFont("monospace"); textAlign(CENTER, CENTER);
  fill(200); textSize(14);
  text("Choose your color:", width / 2, height * 0.44);
  let totalW = SNAKE_SKINS.length * 42;
  let startX = width / 2 - totalW / 2 + 21;
  for (let i = 0; i < SNAKE_SKINS.length; i++) {
    let skin = SNAKE_SKINS[i];
    let x = startX + i * 42, y = height * 0.50;
    let sz = 28;
    if (i === selectedSkin) {
      sz = 34 + sin(frameCount * 0.15) * 3;
      let c = color(skin.head);
      fill(red(c), green(c), blue(c), 80); noStroke();
      ellipse(x, y, sz + 16);
      stroke(255); strokeWeight(3);
    } else {
      stroke(60); strokeWeight(1);
    }
    fill(skin.head); ellipse(x, y, sz);
    fill(255); noStroke();
    ellipse(x - 5, y - 3, 7); ellipse(x + 5, y - 3, 7);
    fill(0);
    ellipse(x - 4, y - 2, 3.5); ellipse(x + 6, y - 2, 3.5);
  }
  fill(150); noStroke(); textSize(12);
  text(SNAKE_SKINS[selectedSkin].name, width / 2, height * 0.50 + 28);
  pop();
}

// ─── INPUT: MOUSE ──────────────────────────────────────────
function mousePressed() {
  if (gameState === "menu") {
    // Skin clicks
    let totalW = SNAKE_SKINS.length * 42;
    let skinStartX = width / 2 - totalW / 2 + 21;
    for (let i = 0; i < SNAKE_SKINS.length; i++) {
      if (dist(mouseX, mouseY, skinStartX + i * 42, height * 0.50) < 20) {
        selectedSkin = i; return;
      }
    }
    let btnX = width / 2, btnW = 280, btnH = 60;
    // Play
    if (mouseX > btnX - btnW / 2 && mouseX < btnX + btnW / 2 &&
        mouseY > height * 0.64 - btnH / 2 && mouseY < height * 0.64 + btnH / 2) {
      initGame(false); return;
    }
    // Watch
    if (mouseX > btnX - btnW / 2 && mouseX < btnX + btnW / 2 &&
        mouseY > height * 0.77 - btnH / 2 && mouseY < height * 0.77 + btnH / 2) {
      initGame(true); return;
    }
  } else if (gameState === "paused") {
    let bw = 220, bh = 50;
    // Resume button
    if (mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
        mouseY > height / 2 + 80 - bh / 2 && mouseY < height / 2 + 80 + bh / 2) {
      gameState = "playing"; return;
    }
    // Restart button
    if (mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
        mouseY > height / 2 + 145 - bh / 2 && mouseY < height / 2 + 145 + bh / 2) {
      initGame(false); return;
    }
    // Menu button
    if (mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
        mouseY > height / 2 + 210 - bh / 2 && mouseY < height / 2 + 210 + bh / 2) {
      gameState = "menu"; return;
    }
  } else if (gameState === "playing" && !isWatching && snake && snake.alive) {
    snake.startDash();
    playSound(sndDash);
  } else if (gameState === "gameover") {
    let bw = 200, bh = 48;
    // Play Again
    if (mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
        mouseY > height / 2 + 80 - bh / 2 && mouseY < height / 2 + 80 + bh / 2) {
      initGame(false); return;
    }
    // Watch AI
    if (mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
        mouseY > height / 2 + 145 - bh / 2 && mouseY < height / 2 + 145 + bh / 2) {
      initGame(true); return;
    }
    // Menu
    if (mouseX > width / 2 - bw / 2 && mouseX < width / 2 + bw / 2 &&
        mouseY > height / 2 + 210 - bh / 2 && mouseY < height / 2 + 210 + bh / 2) {
      gameState = "menu"; return;
    }
  }
}

function mouseReleased() {
  if (snake && snake.alive && !isWatching) snake.stopDash();
}

// ─── INPUT: KEYBOARD ───────────────────────────────────────
function keyPressed() {
  if ((key === "d" || key === "D") && gameState !== "menu") {
    Vehicle.debug = !Vehicle.debug;
  }

  if (gameState === "menu") {
    if (keyCode === BACKSPACE) { playerName = playerName.slice(0, -1); return false; }
    if (keyCode === ENTER) { initGame(false); return false; }
    if (key === "w" || key === "W") {
      if (playerName.length === 0) { initGame(true); return false; }
      if (playerName.length < 15) playerName += key;
      return false;
    }
    if (key.length === 1 && playerName.length < 15) { playerName += key; return false; }
  } else if (gameState === "paused") {
    if (key === "p" || key === "P" || keyCode === ESCAPE) gameState = "playing";
    else if (key === "r" || key === "R") initGame(false);
    else if (key === "m" || key === "M") gameState = "menu";
  } else if (gameState === "playing") {
    if (key === "p" || key === "P" || keyCode === ESCAPE) gameState = "paused";
    else if (key === "r" || key === "R") initGame(false);
    else if (key === "m" || key === "M") gameState = "menu";
    else if (keyCode === ENTER && isWatching) {
      // Take control from AI
      isWatching = false;
      snake.autoPlay = false;
    }
    else if (key === "w" || key === "W") {
      // Switch to watch mode
      if (!isWatching) {
        isWatching = true;
        snake.autoPlay = true;
      }
    }
    else if ((key === "o" || key === "O") && Vehicle.debug) {
      obstacles.push(new Obstacle(mouseX, mouseY, random(20, 50), "rgba(200,120,80,0.6)"));
    }
  } else if (gameState === "gameover") {
    if (key === "r" || key === "R" || keyCode === ENTER) initGame(false);
    else if (key === "w" || key === "W") initGame(true);
    else if (key === "m" || key === "M" || keyCode === ESCAPE) gameState = "menu";
  }
}

// ─── INPUT: TOUCH (mobile) ─────────────────────────────────
function touchStarted() {
  if (gameState === "playing" && !isWatching && touches.length > 0) {
    touchStartX = touches[0].x;
    touchStartY = touches[0].y;
    touchTarget = createVector(touches[0].x, touches[0].y);
  }
  // Allow default mousePressed for menu buttons
  return true;
}

function touchMoved() {
  if (gameState === "playing" && !isWatching && touches.length > 0) {
    touchTarget = createVector(touches[0].x, touches[0].y);
    // Swipe distance triggers dash
    let swipeDist = dist(touches[0].x, touches[0].y, touchStartX, touchStartY);
    if (swipeDist > 80 && snake && snake.alive) {
      snake.startDash();
    }
  }
  return false; // prevent scroll
}

function touchEnded() {
  touchTarget = null;
  if (snake && snake.alive) snake.stopDash();
  return true;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
