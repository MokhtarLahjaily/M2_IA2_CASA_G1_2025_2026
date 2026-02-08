/**
 * Twin Stick Shooter — Sketch principal (p5.js)
 *
 * Type Vampire Survivors :
 *   - Joueur contrôlé au clavier (ZQSD / WASD / flèches)
 *   - Auto-fire de projectiles intelligents (pursue)
 *   - Horde d'ennemis (seek + separation + avoid)
 *   - Obstacles avec contournement fluide (avoid)
 *   - Sliders HTML pour régler les poids en temps réel
 */

let gm;

// ─── Sons du jeu (chargés dans preload comme dans 7-Boids de micbuffa) ───
let sndShoot, sndEnemyKill, sndDamaged, sndGameOver, sndLevelUp, sndPickup, sndMusic;
let soundsLoaded = true;

function preload() {
  soundFormats('wav');
  try {
    sndShoot     = loadSound('assets/laser_shot.wav');
    sndEnemyKill = loadSound('assets/enemy_killed.wav');
    sndDamaged   = loadSound('assets/player_damaged.wav');
    sndGameOver  = loadSound('assets/game_over.wav');
    sndLevelUp   = loadSound('assets/level-up-mission-complete.wav');
    sndPickup    = loadSound('assets/pick-up-health.wav');
    sndMusic     = loadSound('assets/background-music.wav');
  } catch (e) {
    console.warn('Sound loading failed:', e);
    soundsLoaded = false;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // Lower volume for music and set loop
  sndMusic.setVolume(0.3);
  sndShoot.setVolume(0.15);
  sndEnemyKill.setVolume(0.4);
  sndDamaged.setVolume(0.5);
  sndGameOver.setVolume(0.6);
  sndLevelUp.setVolume(0.5);
  sndPickup.setVolume(0.5);

  gm = new GameManager();
  // Don't auto-init — start in menu state
}

function draw() {
  background(12, 14, 22);
  gm.update();
  gm.draw();
}

function mousePressed() {
  // Start music on first click (browser autoplay policy)
  if (sndMusic && !sndMusic.isPlaying() && gm.state === "playing") {
    sndMusic.loop();
  }
  gm.handleClick(mouseX, mouseY);
}

// ─── CLAVIER ─────────────────────────────────────────────
function keyPressed() {
  // ENTER to start from menu
  if (keyCode === ENTER && gm.state === "menu") {
    gm.init();
    if (sndMusic && !sndMusic.isPlaying()) sndMusic.loop();
    return false;
  }

  // P to toggle pause
  if ((key === "p" || key === "P") && (gm.state === "playing" || gm.state === "paused")) {
    gm.state = (gm.state === "playing") ? "paused" : "playing";
    return false;
  }

  // M to go back to menu from gameover
  if ((key === "m" || key === "M") && gm.state === "gameover") {
    gm.goToMenu();
    return false;
  }

  // Start background music on first interaction (browser autoplay policy)
  if (sndMusic && !sndMusic.isPlaying() && gm.state === "playing") {
    sndMusic.loop();
  }

  // Pas de conflit : les touches de mouvement (z,q,s,d) sont gérées
  // séparément des toggles (maj + touche)
  if (gm.state === "playing" || gm.state === "gameover" || gm.state === "paused") {
    gm.keyDown(key);
  }

  if ((key === "r" || key === "R") && (gm.state === "playing" || gm.state === "gameover" || gm.state === "paused")) {
    let hs = gm.highScore;
    gm.destroy();
    gm = new GameManager();
    gm.highScore = hs;
    gm.init();
    if (sndMusic && !sndMusic.isPlaying()) sndMusic.loop();
  }

  // Toggle debug uniquement quand on appuie sur 'D' MAJUSCULE
  // (pour ne pas entrer en conflit avec le mouvement 'd' = droite)
  if (key === "D") {
    Vehicle.debug = !Vehicle.debug;
  }

  // Empêcher le scroll du navigateur avec les flèches et SPACE
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(key)) {
    return false;
  }
}

function keyReleased() {
  gm.keyUp(key);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Reposition slider panel
  if (gm && gm.sliderContainer) {
    gm.sliderContainer.position(10, height - 130);
  }
}
