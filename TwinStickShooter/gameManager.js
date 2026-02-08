/**
 * GameManager — Gère le spawn des ennemis, les collisions, les vagues,
 * les sliders HTML de réglage en temps réel et le score.
 */
class GameManager {
  constructor() {
    // ── État du jeu ──
    this.state = "menu"; // "menu" | "playing" | "paused" | "gameover"
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('tss_highScore')) || 0;
    this.wave = 1;
    this.time = 0;            // frames totales
    this.isNewRecord = false; // true si le joueur bat le record

    // ── Menu animation ──
    this.menuParticles = [];
    this.menuPulse = 0;

    // ── Entités ──
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.obstacles = [];
    this.particles = [];      // particules d'explosion

    // ── Health pickups ──
    this.healthPickups = [];
    this.healthSpawnTimer = 0;
    this.healthSpawnInterval = 400; // ~6.7s between spawns
    this.maxHealthPickups = 3;

    // ── Fire Rate Tokens ──
    this.fireRateTokens = [];
    this.tokenSpawnTimer = 0;
    this.tokenSpawnInterval = 600; // ~10s between spawns
    this.maxTokens = 2;
    this.tokensCollected = 0; // compteur total ramassé

    // ── Multi-Shot Tokens ──
    this.multiShotTokens = [];
    this.multiShotSpawnTimer = 0;
    this.multiShotSpawnInterval = 800; // ~13s between spawns
    this.maxMultiShotTokens = 1;
    this.multiShotCollected = 0;

    // ── Shield Power-Ups ──
    this.shieldPowerUps = [];
    this.shieldSpawnTimer = 0;
    this.shieldSpawnInterval = 1200; // ~20s between spawns
    this.maxShieldPowerUps = 1;

    // ── Speed Boost Tokens ──
    this.speedBoostTokens = [];
    this.speedBoostSpawnTimer = 0;
    this.speedBoostSpawnInterval = 1000; // ~17s between spawns
    this.maxSpeedBoostTokens = 1;

    // ── Enemy Projectiles (seeking Vehicles from shooter enemies) ──
    this.enemyProjectiles = [];

    // ── Moving obstacles (spawn at higher levels) ──
    this.movingObstacles = [];
    this.maxMovingObstacles = 0;  // increases with level

    // ── Config ──
    this.maxEnemies = 60;
    this.maxTotalEntities = 200; // entity cap for 60fps performance
    this.spawnInterval = 90;  // frames between spawn waves (gentler start)
    this.spawnCount = 2;      // enemies per wave (ramps up later)
    this.spawnTimer = 0;

    // ── Dynamic obstacles ──
    this.obstacleTimer = 0;
    this.obstacleInterval = 300; // frames between obstacle changes
    this.minObstacles = 3;
    this.maxObstacles = 10;

    // ── Touches ──
    this.keys = { up: false, down: false, left: false, right: false, fire: false };

    // ── Direction du joueur (pour le tir directionnel) ──
    this.playerFacing = null; // p5.Vector

    // ── Poids ajustables (sliders) ──
    this.seekWeight = 1.0;
    this.separationWeight = 2.5;
    this.avoidWeight = 3.0;

    // ── Sliders HTML ──
    this.sliders = {};
  }

  // ─── INITIALISATION ──────────────────────────────────────
  init() {
    // Preserve high score across restarts
    let savedHigh = this.highScore;
    this.state = "playing";
    this.score = 0;
    this.highScore = savedHigh;
    this.isNewRecord = false;
    this.wave = 1;
    this.time = 0;
    this.spawnTimer = 0;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.healthPickups = [];
    this.healthSpawnTimer = 0;
    this.fireRateTokens = [];
    this.tokenSpawnTimer = 0;
    this.tokensCollected = 0;
    this.multiShotTokens = [];
    this.multiShotSpawnTimer = 0;
    this.multiShotCollected = 0;
    this.enemyProjectiles = [];
    this.shieldPowerUps = [];
    this.shieldSpawnTimer = 0;
    this.speedBoostTokens = [];
    this.speedBoostSpawnTimer = 0;

    // Joueur au centre
    this.player = new Player(width / 2, height / 2);

    // Obstacles aléatoires
    this.obstacles = [];
    let nbObstacles = floor(random(5, 9));
    for (let i = 0; i < nbObstacles; i++) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        let r = random(20, 50);
        let ox = random(r + 80, width - r - 80);
        let oy = random(r + 80, height - r - 80);
        // Pas trop près du joueur
        if (dist(ox, oy, width / 2, height / 2) > 160) {
          // Pas trop près d'un autre obstacle
          let ok = true;
          for (let o of this.obstacles) {
            if (dist(ox, oy, o.pos.x, o.pos.y) < r + o.r + 40) { ok = false; break; }
          }
          if (ok) {
            let c = color(random(50, 80), random(60, 90), random(90, 130), 200);
            this.obstacles.push(new Obstacle(ox, oy, r, c));
            placed = true;
          }
        }
        attempts++;
      }
    }

    // Reset obstacle timer
    this.obstacleTimer = 0;

    // Moving obstacles
    this.movingObstacles = [];
    this.maxMovingObstacles = 0;

    // Spawn initial (easy start)
    for (let i = 0; i < 6; i++) this.spawnEnemy();

    // Créer les sliders
    this.createSliders();
  }

  // ─── SLIDERS HTML ────────────────────────────────────────
  createSliders() {
    // Supprimer les anciens (cas restart)
    if (this.sliderContainer) this.sliderContainer.remove();

    this.sliderContainer = createDiv("");
    this.sliderContainer.id("slider-panel");
    this.sliderContainer.position(10, height - 130);

    this.sliders.seek = this._makeSlider("⚔️ Seek Weight", 0, 5, this.seekWeight, 0.1,
      (v) => { this.seekWeight = v; });
    this.sliders.separation = this._makeSlider("↔️ Separation Weight", 0, 8, this.separationWeight, 0.1,
      (v) => { this.separationWeight = v; });
    this.sliders.avoid = this._makeSlider("🚧 Avoid Weight", 0, 8, this.avoidWeight, 0.1,
      (v) => { this.avoidWeight = v; });
  }

  _makeSlider(label, min, max, val, step, onChange) {
    let row = createDiv("");
    row.parent(this.sliderContainer);
    row.class("slider-row");

    let lbl = createSpan(label);
    lbl.parent(row);
    lbl.class("slider-label");

    let sl = createSlider(min, max, val, step);
    sl.parent(row);
    sl.class("slider-input");

    let valSpan = createSpan(val.toFixed(1));
    valSpan.parent(row);
    valSpan.class("slider-value");

    sl.input(() => {
      let v = sl.value();
      valSpan.html(v.toFixed(1));
      onChange(v);
    });

    return sl;
  }

  // ─── SPAWN ───────────────────────────────────────────────
  spawnEnemy() {
    if (this.enemies.length >= this.maxEnemies) return;
    if (this.getTotalEntityCount() >= this.maxTotalEntities) return;

    // Spawn sur les bords (hors écran)
    let side = floor(random(4));
    let x, y;
    let margin = 40;
    switch (side) {
      case 0: x = random(width); y = -margin; break;   // haut
      case 1: x = random(width); y = height + margin; break; // bas
      case 2: x = -margin; y = random(height); break;  // gauche
      case 3: x = width + margin; y = random(height); break; // droite
    }

    // Choisir le type selon la vague — smarter enemies replace dumber ones
    let type = "normal";
    let roll = random(1);

    if (this.wave >= 12) {
      // Wave 12+ : NO normal enemies — all smart
      if (roll < 0.18) type = "shooter";
      else if (roll < 0.32) type = "teleporter";
      else if (roll < 0.46) type = "bomber";
      else if (roll < 0.62) type = "tank";
      else if (roll < 0.80) type = "flanker";
      else type = "fast";
    } else if (this.wave >= 9) {
      if (roll < 0.12) type = "shooter";
      else if (roll < 0.22) type = "teleporter";
      else if (roll < 0.34) type = "bomber";
      else if (roll < 0.48) type = "tank";
      else if (roll < 0.62) type = "fast";
      else if (roll < 0.75) type = "flanker";
    } else if (this.wave >= 8) {
      if (roll < 0.12) type = "shooter";
      else if (roll < 0.25) type = "bomber";
      else if (roll < 0.40) type = "tank";
      else if (roll < 0.55) type = "fast";
      else if (roll < 0.68) type = "flanker";
    } else if (this.wave >= 7) {
      if (roll < 0.15) type = "bomber";
      else if (roll < 0.30) type = "tank";
      else if (roll < 0.50) type = "fast";
      else if (roll < 0.65) type = "flanker";
    } else if (this.wave >= 5) {
      if (roll < 0.18) type = "tank";
      else if (roll < 0.38) type = "fast";
      else if (roll < 0.52) type = "flanker";
    } else if (this.wave >= 3) {
      if (roll < 0.25) type = "fast";
      else if (roll < 0.38) type = "flanker";
    }

    let e = new Enemy(x, y, type);

    // Scaling de difficulté : vitesse + HP (gentler curve)
    if (this.wave > 3) {
      e.maxSpeed += (this.wave - 3) * 0.08;
      if (this.wave > 5) e.hp += 1;
      if (this.wave > 9) e.hp += 1;
    }
    this.enemies.push(e);
  }

  // ─── DYNAMIC OBSTACLES ───────────────────────────────────
  updateObstacles() {
    this.obstacleTimer++;
    if (this.obstacleTimer < this.obstacleInterval) return;
    this.obstacleTimer = 0;

    // Randomly remove one obstacle
    if (this.obstacles.length > this.minObstacles && random(1) < 0.5) {
      let idx = floor(random(this.obstacles.length));
      // Spawn particles at removed obstacle
      let o = this.obstacles[idx];
      this.spawnParticles(o.pos.x, o.pos.y, color(100, 120, 160), 10);
      this.obstacles.splice(idx, 1);
    }

    // Randomly add one obstacle
    if (this.obstacles.length < this.maxObstacles && random(1) < 0.6) {
      let attempts = 0;
      while (attempts < 50) {
        let r = random(18, 45);
        let ox = random(r + 80, width - r - 80);
        let oy = random(r + 80, height - r - 80);
        // Not too close to player
        if (dist(ox, oy, this.player.pos.x, this.player.pos.y) > 180) {
          let ok = true;
          for (let o of this.obstacles) {
            if (dist(ox, oy, o.pos.x, o.pos.y) < r + o.r + 40) { ok = false; break; }
          }
          if (ok) {
            let c = color(random(50, 80), random(60, 90), random(90, 130), 200);
            this.obstacles.push(new Obstacle(ox, oy, r, c));
            break;
          }
        }
        attempts++;
      }
    }
  }

  // ─── MOVING OBSTACLES (wander autour de la carte) ──────────
  updateMovingObstacles() {
    for (let mo of this.movingObstacles) {
      mo.update();
    }
    // Remove dead moving obstacles
    this.movingObstacles = this.movingObstacles.filter(mo => mo.alive);
  }

  spawnMovingObstacle() {
    let attempts = 0;
    while (attempts < 50) {
      let r = random(22, 38);
      let ox = random(r + 100, width - r - 100);
      let oy = random(r + 100, height - r - 100);
      // Not too close to player
      if (dist(ox, oy, this.player.pos.x, this.player.pos.y) > 200) {
        let ok = true;
        for (let o of this.obstacles) {
          if (dist(ox, oy, o.pos.x, o.pos.y) < r + o.r + 50) { ok = false; break; }
        }
        if (ok) {
          this.movingObstacles.push(new MovingObstacle(ox, oy, r));
          break;
        }
      }
      attempts++;
    }
  }

  // ─── UPDATE PRINCIPAL ────────────────────────────────────
  update() {
    if (this.state !== "playing") return;

    this.time++;

    // Mise à jour des poids de tous les ennemis en temps réel
    for (let e of this.enemies) {
      e.seekWeight = this.seekWeight;
      e.separationWeight = this.separationWeight;
      e.avoidWeight = this.avoidWeight;
    }

    // ── Spawning par vagues ──
    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      for (let i = 0; i < this.spawnCount; i++) this.spawnEnemy();
    }

    // ── Augmenter la difficulté toutes les 600 frames (~10s) ──
    if (this.time % 600 === 0 && this.time > 0) {
      this.wave++;
      this.spawnCount = min(this.spawnCount + 1, 8);
      this.spawnInterval = max(this.spawnInterval - 5, 20);

      // Cull dumb enemies at high waves to make room for smart ones
      this.cullDumbEnemies();

      // ── Level-up events : moving obstacles ──
      // Wave 4+ : start spawning moving obstacles
      if (this.wave >= 4) {
        this.maxMovingObstacles = min(1 + floor((this.wave - 4) / 2), 5);
        // Spawn a new moving obstacle if under limit
        if (this.movingObstacles.length < this.maxMovingObstacles) {
          this.spawnMovingObstacle();
        }
      }
    }

    // ── Dynamic obstacles ──
    this.updateObstacles();

    // ── Moving obstacles (update position via steering) ──
    this.updateMovingObstacles();

    // ── All obstacles (static + moving) for avoidance ──
    let allObs = this.obstacles.concat(this.movingObstacles);

    // ── Player ──
    this.player.applyBehaviors(this.keys, allObs);
    this.player.update();

    // ── Track player facing direction (for directional shooting) ──
    let dir = createVector(0, 0);
    if (this.keys.up) dir.y -= 1;
    if (this.keys.down) dir.y += 1;
    if (this.keys.left) dir.x -= 1;
    if (this.keys.right) dir.x += 1;
    if (dir.mag() > 0) {
      this.playerFacing = dir.normalize();
    } else if (this.player.vel.mag() > 0.5) {
      this.playerFacing = this.player.vel.copy().normalize();
    }
    // If playerFacing is still null (no movement yet), default to right
    if (!this.playerFacing) this.playerFacing = createVector(1, 0);

    // ── Pas d'auto-fire : le joueur tire avec SPACE ou le bouton FIRE ──
    // Tir continu si SPACE maintenu
    if (this.keys.fire && this.player.canFire()) {
      this.fireProjectile();
      this.player.resetFireTimer();
      if (typeof sndShoot !== 'undefined' && !sndShoot.isPlaying()) {
        sndShoot.play();
      }
    }

    // ── Ennemis ──
    for (let e of this.enemies) {
      e.applyBehaviors(this.player, this.enemies, allObs);
      e.update();
    }

    // ── Shooter enemies fire seeking projectiles ──
    for (let e of this.enemies) {
      if (e.type === "shooter" && e.wantsToShoot && e.alive) {
        e.wantsToShoot = false;
        this.fireEnemyProjectile(e);
      }
    }

    // ── Enemy Projectiles (Vehicles seeking the player!) ──
    for (let ep of this.enemyProjectiles) {
      ep.applyBehaviors(this.player, allObs);
      ep.update();
    }

    // ── Projectiles (vrais véhicules : seek + avoid) ──
    for (let p of this.projectiles) {
      p.applyBehaviors(this.enemies, allObs);
      p.update();
    }

    // ── Collisions ──
    this.checkCollisions();

    // ── Health pickups ──
    this.updateHealthPickups();

    // ── Fire Rate Tokens ──
    this.updateFireRateTokens();

    // ── Multi-Shot Tokens ──
    this.updateMultiShotTokens();

    // ── Shield Power-Ups ──
    this.updateShieldPowerUps();

    // ── Speed Boost Tokens ──
    this.updateSpeedBoostTokens();

    // ── Periodic entity culling for performance ──
    if (this.time % 300 === 0) {
      this.cullDumbEnemies();
    }

    // ── Nettoyage des morts ──
    this.enemies = this.enemies.filter(e => e.alive);
    this.projectiles = this.projectiles.filter(p => p.alive);
    this.enemyProjectiles = this.enemyProjectiles.filter(ep => ep.alive);
    this.particles = this.particles.filter(p => p.life > 0);
    this.healthPickups = this.healthPickups.filter(h => h.alive);
    this.fireRateTokens = this.fireRateTokens.filter(t => t.alive);
    this.multiShotTokens = this.multiShotTokens.filter(t => t.alive);
    this.shieldPowerUps = this.shieldPowerUps.filter(s => s.alive);
    this.speedBoostTokens = this.speedBoostTokens.filter(s => s.alive);

    // ── Particules ──
    for (let p of this.particles) {
      p.pos.add(p.vel);
      p.vel.mult(0.95);
      p.life--;
    }

    // ── Game Over ? ──
    if (!this.player.alive) {
      this.state = "gameover";
      if (this.score > this.highScore) {
        this.isNewRecord = true;
        this.highScore = this.score;
        localStorage.setItem('tss_highScore', this.highScore);
      }
      // 🔊 Game over sound
      if (typeof sndGameOver !== 'undefined' && !sndGameOver.isPlaying()) {
        sndGameOver.play();
      }
      // Stop background music
      if (typeof sndMusic !== 'undefined' && sndMusic.isPlaying()) {
        sndMusic.stop();
      }
    }
  }

  // ─── TIR (multi-lignes spread selon shotLines) ──────
  fireProjectile() {
    let baseDir = this.playerFacing.copy();
    let lines = this.player.shotLines || 1;
    let spreadAngle = radians(12); // angle entre chaque ligne

    // Angles répartis autour de la direction centrale
    for (let i = 0; i < lines; i++) {
      let offset = (i - (lines - 1) / 2) * spreadAngle;
      let dir = baseDir.copy().rotate(offset);

      let p = new Projectile(
        this.player.pos.x + dir.x * 22,
        this.player.pos.y + dir.y * 22,
        dir
      );
      // Bonus de level : projectile plus fort, plus rapide et plus agile
      p.damage += floor(this.player.projectileDamageBonus || 0);
      p.maxSpeed += (this.player.projectileSpeedBonus || 0);
      p.maxForce += (this.player.projectileForceBonus || 0);
      p.vel = dir.copy().setMag(p.maxSpeed);
      this.projectiles.push(p);
    }
  }

  // ─── COLLISIONS ──────────────────────────────────────────
  checkCollisions() {
    let allObs = this.obstacles.concat(this.movingObstacles);

    // Projectile → Ennemi
    for (let p of this.projectiles) {
      if (!p.alive) continue;
      for (let e of this.enemies) {
        if (!e.alive) continue;
        if (p.hits(e)) {
          e.takeDamage(p.damage);
          p.alive = false;
          this.spawnParticles(e.pos.x, e.pos.y, color(255, 100, 50), 6);
          if (!e.alive) {
            this.score += 10;
            this.player.addXP(e.xpValue);
            this.spawnParticles(e.pos.x, e.pos.y, color(255, 60, 30), 12);
            // 💥 Bomber explosion : dégâts de zone !
            if (e.type === "bomber") {
              this.bomberExplosion(e);
            }
            // 🔊 Enemy kill sound
            if (typeof sndEnemyKill !== 'undefined' && !sndEnemyKill.isPlaying()) {
              sndEnemyKill.play();
            }
          }
          break;
        }
      }
    }

    // Projectile → Obstacle (static + moving — projectile is destroyed)
    for (let p of this.projectiles) {
      if (!p.alive) continue;
      for (let o of allObs) {
        if (p.hitsObstacle(o)) {
          p.alive = false;
          this.spawnParticles(p.pos.x, p.pos.y, color(100, 180, 255), 4);
          break;
        }
      }
    }

    // Ennemi → Joueur (contact)
    for (let e of this.enemies) {
      if (!e.alive) continue;
      let d = p5.Vector.dist(this.player.pos, e.pos);
      if (d < this.player.r + e.r_pourDessin) {
        this.player.takeDamage();
        this.spawnParticles(this.player.pos.x, this.player.pos.y, color(255, 50, 50), 8);
        // Bomber explodes on contact too!
        if (e.type === "bomber") {
          e.alive = false;
          this.bomberExplosion(e);
        }
        // 🔊 Player damaged sound
        if (typeof sndDamaged !== 'undefined' && !sndDamaged.isPlaying()) {
          sndDamaged.play();
        }
      }
    }

    // Joueur → Obstacle (static + moving — collision physique + DAMAGE)
    for (let o of allObs) {
      let d = p5.Vector.dist(this.player.pos, o.pos);
      if (d < this.player.r + o.r) {
        // Push back
        let pushForce = p5.Vector.sub(this.player.pos, o.pos);
        pushForce.setMag(this.player.r + o.r - d);
        this.player.pos.add(pushForce);
        // Deal damage!
        this.player.takeDamage();
        this.spawnParticles(this.player.pos.x, this.player.pos.y, color(255, 150, 50), 6);
        // 🔊 Player damaged sound
        if (typeof sndDamaged !== 'undefined' && !sndDamaged.isPlaying()) {
          sndDamaged.play();
        }
      }
    }

    // Enemy Projectile → Player (seeking missiles hit player)
    for (let ep of this.enemyProjectiles) {
      if (!ep.alive) continue;
      if (ep.hitsPlayer(this.player)) {
        this.player.takeDamage();
        ep.alive = false;
        this.spawnParticles(this.player.pos.x, this.player.pos.y, color(255, 80, 30), 8);
        if (typeof sndDamaged !== 'undefined' && !sndDamaged.isPlaying()) {
          sndDamaged.play();
        }
      }
    }

    // Enemy Projectile → Obstacle (destroyed on impact)
    for (let ep of this.enemyProjectiles) {
      if (!ep.alive) continue;
      for (let o of allObs) {
        if (ep.hitsObstacle(o)) {
          ep.alive = false;
          this.spawnParticles(ep.pos.x, ep.pos.y, color(255, 120, 30), 4);
          break;
        }
      }
    }

    // Player Projectile → Enemy Projectile (can shoot them down!)
    for (let p of this.projectiles) {
      if (!p.alive) continue;
      for (let ep of this.enemyProjectiles) {
        if (!ep.alive) continue;
        if (p5.Vector.dist(p.pos, ep.pos) < p.r + ep.r) {
          ep.alive = false;
          p.alive = false;
          this.spawnParticles(ep.pos.x, ep.pos.y, color(255, 200, 50), 6);
          this.score += 3;
          break;
        }
      }
    }
  }

  /**
   * Bomber explosion : dégâts de zone quand un bomber meurt.
   * Blesse le joueur et les ennemis proches.
   */
  bomberExplosion(bomber, depth = 0) {
    if (depth > 5) return; // prevent stack overflow from chain reactions
    let explosionRadius = 120;
    this.spawnParticles(bomber.pos.x, bomber.pos.y, color(255, 160, 30), 25);
    this.spawnParticles(bomber.pos.x, bomber.pos.y, color(255, 80, 0), 15);

    // Damage player if in range
    let dPlayer = p5.Vector.dist(this.player.pos, bomber.pos);
    if (dPlayer < explosionRadius) {
      this.player.takeDamage();
      this.spawnParticles(this.player.pos.x, this.player.pos.y, color(255, 100, 0), 8);
    }

    // Damage nearby enemies (chain reaction!)
    for (let e of this.enemies) {
      if (!e.alive || e === bomber) continue;
      let de = p5.Vector.dist(e.pos, bomber.pos);
      if (de < explosionRadius) {
        e.takeDamage(2);
        this.spawnParticles(e.pos.x, e.pos.y, color(255, 120, 30), 6);
        // Chain bomber explosion!
        if (!e.alive && e.type === "bomber") {
          this.bomberExplosion(e, depth + 1);
        }
      }
    }
  }

  // ─── PARTICULES ──────────────────────────────────────────
  spawnParticles(x, y, col, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        pos: createVector(x, y),
        vel: p5.Vector.random2D().mult(random(1, 4)),
        color: col,
        life: floor(random(15, 30)),
        size: random(3, 7)
      });
    }
  }

  // ─── HEALTH PICKUPS ──────────────────────────────────────
  updateHealthPickups() {
    // Spawn new pickup periodically
    this.healthSpawnTimer++;
    if (this.healthSpawnTimer >= this.healthSpawnInterval &&
        this.healthPickups.length < this.maxHealthPickups) {
      this.healthSpawnTimer = 0;
      this.spawnHealthPickup();
    }

    // Update & check collision with player
    for (let h of this.healthPickups) {
      h.update();
      if (h.alive && h.hits(this.player)) {
        // Heal only if not full HP
        if (this.player.hp < this.player.maxHp) {
          this.player.hp = min(this.player.hp + h.healAmount, this.player.maxHp);
          h.alive = false;
          this.spawnParticles(h.pos.x, h.pos.y, color(50, 255, 100), 10);
          // 🔊 Health pickup sound
          if (typeof sndPickup !== 'undefined') {
            sndPickup.play();
          }
        }
      }
    }
  }

  spawnHealthPickup() {
    let attempts = 0;
    while (attempts < 50) {
      let x = random(60, width - 60);
      let y = random(60, height - 60);
      // Not too close to obstacles
      let ok = true;
      for (let o of this.obstacles) {
        if (dist(x, y, o.pos.x, o.pos.y) < o.r + 30) { ok = false; break; }
      }
      // Not too close to player (don't spawn right on top)
      if (ok && dist(x, y, this.player.pos.x, this.player.pos.y) < 100) ok = false;
      if (ok) {
        this.healthPickups.push(new HealthPickup(x, y));
        break;
      }
      attempts++;
    }
  }

  // ─── MANUAL FIRE (SPACE) ────────────────────────────────
  manualFire() {
    if (!this.player || !this.player.alive) return;
    if (!this.player.canFire()) return;

    this.fireProjectile();
    this.player.resetFireTimer();
    // 🔊 Laser shot sound
    if (typeof sndShoot !== 'undefined' && !sndShoot.isPlaying()) {
      sndShoot.play();
    }
  }

  // ─── FIRE RATE TOKENS ───────────────────────────────
  updateFireRateTokens() {
    // Spawn périodique
    this.tokenSpawnTimer++;
    if (this.tokenSpawnTimer >= this.tokenSpawnInterval &&
        this.fireRateTokens.length < this.maxTokens) {
      this.tokenSpawnTimer = 0;
      this.spawnFireRateToken();
    }

    // Update & collision joueur
    for (let t of this.fireRateTokens) {
      t.update();
      if (t.alive && t.hits(this.player)) {
        // Augmenter la cadence de tir (min 3)
        if (this.player.fireRate > 3) {
          this.player.fireRate = max(3, this.player.fireRate - t.fireRateBonus);
        }
        this.tokensCollected++;
        t.alive = false;
        this.spawnParticles(t.pos.x, t.pos.y, color(255, 220, 50), 12);
        this.score += 5;
        // 🔊 Pickup sound
        if (typeof sndPickup !== 'undefined') {
          sndPickup.play();
        }
      }
    }
  }

  spawnFireRateToken() {
    let attempts = 0;
    while (attempts < 50) {
      let x = random(80, width - 80);
      let y = random(80, height - 80);
      let ok = true;
      for (let o of this.obstacles) {
        if (dist(x, y, o.pos.x, o.pos.y) < o.r + 30) { ok = false; break; }
      }
      if (ok && dist(x, y, this.player.pos.x, this.player.pos.y) < 120) ok = false;
      if (ok) {
        this.fireRateTokens.push(new FireRateToken(x, y));
        break;
      }
      attempts++;
    }
  }

  // ─── MULTI-SHOT TOKENS ──────────────────────────────────
  updateMultiShotTokens() {
    // Spawn périodique
    this.multiShotSpawnTimer++;
    if (this.multiShotSpawnTimer >= this.multiShotSpawnInterval &&
        this.multiShotTokens.length < this.maxMultiShotTokens) {
      this.multiShotSpawnTimer = 0;
      this.spawnMultiShotToken();
    }

    // Update & collision joueur
    for (let t of this.multiShotTokens) {
      t.update();
      if (t.alive && t.hits(this.player)) {
        // Ajouter une ligne de tir
        if (this.player.shotLines < this.player.maxShotLines) {
          this.player.shotLines += t.shotBonus;
          this.player.shotLines = min(this.player.shotLines, this.player.maxShotLines);
        }
        this.multiShotCollected++;
        t.alive = false;
        this.spawnParticles(t.pos.x, t.pos.y, color(140, 120, 255), 14);
        this.score += 10;
        // 🔊 Pickup sound
        if (typeof sndPickup !== 'undefined') {
          sndPickup.play();
        }
      }
    }
  }

  spawnMultiShotToken() {
    let attempts = 0;
    while (attempts < 50) {
      let x = random(80, width - 80);
      let y = random(80, height - 80);
      let ok = true;
      for (let o of this.obstacles) {
        if (dist(x, y, o.pos.x, o.pos.y) < o.r + 30) { ok = false; break; }
      }
      if (ok && dist(x, y, this.player.pos.x, this.player.pos.y) < 150) ok = false;
      if (ok) {
        this.multiShotTokens.push(new MultiShotToken(x, y));
        break;
      }
      attempts++;
    }
  }

  // ─── ENEMY PROJECTILE (seeking Vehicle fired by shooters) ──
  fireEnemyProjectile(enemy) {
    if (this.getTotalEntityCount() >= this.maxTotalEntities) return;
    let dir = p5.Vector.sub(this.player.pos, enemy.pos).normalize();
    let ep = new EnemyProjectile(
      enemy.pos.x + dir.x * 20,
      enemy.pos.y + dir.y * 20,
      dir
    );
    // Scale with difficulty
    if (this.wave > 10) {
      ep.maxSpeed += (this.wave - 10) * 0.1;
      ep.maxForce += (this.wave - 10) * 0.02;
    }
    this.enemyProjectiles.push(ep);
  }

  // ─── ENTITY COUNT (for performance cap) ──────────────────
  getTotalEntityCount() {
    return this.enemies.length +
      this.projectiles.length +
      this.enemyProjectiles.length +
      this.healthPickups.length +
      this.fireRateTokens.length +
      this.multiShotTokens.length +
      this.shieldPowerUps.length +
      this.speedBoostTokens.length +
      this.movingObstacles.length;
  }

  // ─── CULL DUMB ENEMIES (replace with smarter at high waves) ─
  cullDumbEnemies() {
    if (this.wave < 8) return;
    let total = this.getTotalEntityCount();
    if (total < this.maxTotalEntities * 0.8) return;

    // Determine which types to cull based on wave
    let typesToCull = this.wave >= 12
      ? ["normal", "fast"]
      : ["normal"];

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (typesToCull.includes(this.enemies[i].type)) {
        this.spawnParticles(
          this.enemies[i].pos.x, this.enemies[i].pos.y,
          color(100, 100, 100, 80), 3
        );
        this.enemies.splice(i, 1);
        total--;
        if (total < this.maxTotalEntities * 0.65) break;
      }
    }
  }

  // ─── SHIELD POWER-UPS ────────────────────────────────────
  updateShieldPowerUps() {
    this.shieldSpawnTimer++;
    if (this.shieldSpawnTimer >= this.shieldSpawnInterval &&
        this.shieldPowerUps.length < this.maxShieldPowerUps) {
      this.shieldSpawnTimer = 0;
      this.spawnShieldPowerUp();
    }

    for (let s of this.shieldPowerUps) {
      s.update();
      if (s.alive && s.hits(this.player)) {
        this.player.activateShield(s.shieldDuration);
        s.alive = false;
        this.spawnParticles(s.pos.x, s.pos.y, color(100, 200, 255), 14);
        this.score += 15;
        if (typeof sndPickup !== 'undefined') sndPickup.play();
      }
    }
  }

  spawnShieldPowerUp() {
    let attempts = 0;
    while (attempts < 50) {
      let x = random(80, width - 80);
      let y = random(80, height - 80);
      let ok = true;
      for (let o of this.obstacles) {
        if (dist(x, y, o.pos.x, o.pos.y) < o.r + 30) { ok = false; break; }
      }
      if (ok && dist(x, y, this.player.pos.x, this.player.pos.y) < 150) ok = false;
      if (ok) {
        this.shieldPowerUps.push(new ShieldPowerUp(x, y));
        break;
      }
      attempts++;
    }
  }

  // ─── SPEED BOOST TOKENS ──────────────────────────────────
  updateSpeedBoostTokens() {
    this.speedBoostSpawnTimer++;
    if (this.speedBoostSpawnTimer >= this.speedBoostSpawnInterval &&
        this.speedBoostTokens.length < this.maxSpeedBoostTokens) {
      this.speedBoostSpawnTimer = 0;
      this.spawnSpeedBoostToken();
    }

    for (let s of this.speedBoostTokens) {
      s.update();
      if (s.alive && s.hits(this.player)) {
        this.player.activateSpeedBoost(s.speedMultiplier, s.boostDuration);
        s.alive = false;
        this.spawnParticles(s.pos.x, s.pos.y, color(200, 255, 50), 12);
        this.score += 10;
        if (typeof sndPickup !== 'undefined') sndPickup.play();
      }
    }
  }

  spawnSpeedBoostToken() {
    let attempts = 0;
    while (attempts < 50) {
      let x = random(80, width - 80);
      let y = random(80, height - 80);
      let ok = true;
      for (let o of this.obstacles) {
        if (dist(x, y, o.pos.x, o.pos.y) < o.r + 30) { ok = false; break; }
      }
      if (ok && dist(x, y, this.player.pos.x, this.player.pos.y) < 130) ok = false;
      if (ok) {
        this.speedBoostTokens.push(new SpeedBoostToken(x, y));
        break;
      }
      attempts++;
    }
  }

  // ─── DESSIN ──────────────────────────────────────────────
  draw() {
    if (this.state === "menu") {
      this.drawMenu();
      return;
    }

    // Draw game world (also when paused so it stays visible)
    // Fond quadrillé
    this.drawGrid();

    // Obstacles
    for (let o of this.obstacles) o.show();

    // Moving obstacles
    for (let mo of this.movingObstacles) mo.show();

    // Health pickups
    for (let h of this.healthPickups) h.show();

    // Fire rate tokens
    for (let t of this.fireRateTokens) t.show();

    // Multi-shot tokens
    for (let t of this.multiShotTokens) t.show();

    // Shield power-ups
    for (let s of this.shieldPowerUps) s.show();

    // Speed boost tokens
    for (let s of this.speedBoostTokens) s.show();

    // Particules
    for (let p of this.particles) {
      push();
      noStroke();
      let alpha = map(p.life, 0, 30, 0, 255);
      fill(red(p.color), green(p.color), blue(p.color), alpha);
      ellipse(p.pos.x, p.pos.y, p.size);
      pop();
    }

    // Projectiles
    for (let p of this.projectiles) p.show();

    // Enemy projectiles (seeking vehicle missiles!)
    for (let ep of this.enemyProjectiles) ep.show();

    // Ennemis
    for (let e of this.enemies) e.show();

    // Joueur
    this.player.show();
    this.player.drawCrosshair(this.playerFacing);

    // Fire button (bottom-right)
    this.drawFireButton();

    // HUD
    this.drawHUD();

    // Game Over overlay
    if (this.state === "gameover") this.drawGameOver();

    // Pause overlay
    if (this.state === "paused") this.drawPause();
  }

  drawPause() {
    push();
    fill(0, 0, 0, 160);
    rect(0, 0, width, height);

    textAlign(CENTER, CENTER);
    textFont("monospace");

    // Pulsing title
    let pulse = 0.8 + sin(frameCount * 0.05) * 0.2;
    fill(255, 255, 255, floor(255 * pulse));
    textSize(48);
    text("⏸  PAUSED", width / 2, height / 2 - 30);

    fill(200, 200, 200, 180);
    textSize(18);
    text("Press [P] to resume", width / 2, height / 2 + 25);
    pop();
  }

  drawFireButton() {
    if (this.state !== "playing" && this.state !== "paused") return;

    let btnR = 32;
    let btnX = width - 70;
    let btnY = height - 70;

    // Check hover
    let hovering = dist(mouseX, mouseY, btnX, btnY) < btnR;
    let brightness = hovering ? 1.0 : 0.6;

    push();
    // Glow
    noStroke();
    fill(255, 80, 50, 25 * brightness);
    ellipse(btnX, btnY, btnR * 4);

    // Button background
    stroke(255, 100, 60, 200 * brightness);
    strokeWeight(2.5);
    fill(200, 50, 30, 180 * brightness);
    ellipse(btnX, btnY, btnR * 2);

    // Label
    noStroke();
    fill(255, 255, 255, 220 * brightness);
    textAlign(CENTER, CENTER);
    textFont("monospace");
    textSize(12);
    text("FIRE", btnX, btnY - 2);
    textSize(9);
    fill(255, 255, 255, 140 * brightness);
    text("[SPACE]", btnX, btnY + 12);
    pop();

    // Store for click detection
    this._fireBtnPos = { x: btnX, y: btnY, r: btnR };
  }

  drawGrid() {
    push();
    stroke(25, 30, 40);
    strokeWeight(1);
    let step = 50;
    for (let x = 0; x < width; x += step) line(x, 0, x, height);
    for (let y = 0; y < height; y += step) line(0, y, width, y);
    pop();
  }

  drawHUD() {
    push();
    noStroke();
    textFont("monospace");

    // Panneau
    fill(0, 0, 0, 170);
    rect(10, 10, 280, Vehicle.debug ? 340 : 310, 8);

    fill(255);
    textSize(14);
    let y = 30;
    let lh = 22;

    text(`⚔️  Score : ${this.score}`, 22, y); y += lh;
    text(`🏆  High Score : ${this.highScore}`, 22, y); y += lh;
    text(`🌊  Wave : ${this.wave}`, 22, y); y += lh;
    text(`❤️  HP : ${this.player.hp} / ${this.player.maxHp}`, 22, y); y += lh;
    text(`⭐  Lvl ${this.player.level}  (XP: ${this.player.xp}/${this.player.xpToNext})`, 22, y); y += lh;
    text(`👾  Enemies : ${this.enemies.length}  |  💀 E-Proj : ${this.enemyProjectiles.length}`, 22, y); y += lh;
    text(`💠  Projectiles : ${this.projectiles.length}`, 22, y); y += lh;
    text(`🪨  Obstacles : ${this.obstacles.length} + ${this.movingObstacles.length}🔄`, 22, y); y += lh;
    text(`⚡  Fire Rate : ${this.player.fireRate}f  (×${this.tokensCollected})`, 22, y); y += lh;
    text(`🔫  Shot Lines : ${this.player.shotLines}  (×${this.multiShotCollected})`, 22, y); y += lh;
    // Active buffs
    let buffs = [];
    if (this.player.shieldTimer > 0) buffs.push(`🛡️${ceil(this.player.shieldTimer / 60)}s`);
    if (this.player.speedBoostTimer > 0) buffs.push(`💨${ceil(this.player.speedBoostTimer / 60)}s`);
    if (buffs.length > 0) {
      fill(100, 220, 255);
      text(`✨ Buffs: ${buffs.join("  ")}`, 22, y); y += lh;
    } else {
      y += lh;
    }
    // Entity count / performance
    fill(180, 180, 180);
    text(`📊 Entities : ${this.getTotalEntityCount()} / ${this.maxTotalEntities}`, 22, y); y += lh;

    if (Vehicle.debug) {
      fill(255, 255, 0);
      text(`🔧 DEBUG  |  FPS: ${floor(frameRate())}`, 22, y); y += lh;
    }

    // XP bar en bas du panneau
    let barX = 22, barY = y + 2, barW = 210, barH = 6;
    fill(40);
    rect(barX, barY, barW, barH, 3);
    fill(255, 220, 50);
    rect(barX, barY, barW * (this.player.xp / this.player.xpToNext), barH, 3);

    // Instructions en bas de l'écran
    fill(255, 255, 255, 90);
    textSize(12);
    text("[ZQSD/WASD/↑←↓→] Move  |  [SPACE] Fire  |  [P] Pause  |  [D] Debug  |  [R] Restart", 10, height - 140);
    pop();
  }

  drawGameOver() {
    push();
    fill(0, 0, 0, 180);
    rect(0, 0, width, height);

    textAlign(CENTER, CENTER);
    textFont("monospace");

    // GAME OVER title
    fill(255, 60, 60);
    textSize(52);
    text("GAME OVER", width / 2, height / 2 - 80);

    // NEW RECORD!
    if (this.isNewRecord) {
      let pulse = 0.7 + sin(frameCount * 0.08) * 0.3;
      let glow = floor(200 * pulse);
      fill(255, 220, 50, glow + 55);
      textSize(28);
      text("✨ NEW RECORD! ✨", width / 2, height / 2 - 35);
    }

    // Stats
    fill(255);
    textSize(22);
    text(`Score: ${this.score}   |   Wave: ${this.wave}   |   Level: ${this.player.level}`, width / 2, height / 2 + 10);

    fill(200, 200, 200);
    textSize(16);
    text(`🏆  Best: ${this.highScore}`, width / 2, height / 2 + 45);

    // Buttons
    let btnY = height / 2 + 90;
    let btnW = 180, btnH = 44, btnGap = 30;

    // [R] Restart button
    let rx = width / 2 - btnW - btnGap / 2;
    this._drawButton(rx, btnY, btnW, btnH, "▶  Play Again [R]", color(0, 180, 100));

    // [M] Menu button
    let mx = width / 2 + btnGap / 2;
    this._drawButton(mx, btnY, btnW, btnH, "⌂  Menu [M]", color(80, 140, 220));

    pop();
  }

  // ─── MAIN MENU ────────────────────────────────────────
  drawMenu() {
    // Animated background
    this.menuPulse += 0.015;

    // Grid background
    push();
    stroke(20, 25, 35);
    strokeWeight(1);
    let step = 50;
    for (let x = 0; x < width; x += step) line(x, 0, x, height);
    for (let y = 0; y < height; y += step) line(0, y, width, y);
    pop();

    // Floating particles
    if (this.menuParticles.length < 40 && random(1) < 0.15) {
      this.menuParticles.push({
        x: random(width), y: random(height),
        vx: random(-0.5, 0.5), vy: random(-0.8, -0.2),
        size: random(2, 5), alpha: random(40, 120),
        hue: random([color(0, 200, 255), color(255, 60, 60), color(50, 255, 100), color(255, 220, 50)])
      });
    }
    push();
    noStroke();
    for (let i = this.menuParticles.length - 1; i >= 0; i--) {
      let mp = this.menuParticles[i];
      mp.x += mp.vx;
      mp.y += mp.vy;
      mp.alpha -= 0.3;
      if (mp.alpha <= 0) { this.menuParticles.splice(i, 1); continue; }
      fill(red(mp.hue), green(mp.hue), blue(mp.hue), mp.alpha);
      ellipse(mp.x, mp.y, mp.size);
    }
    pop();

    push();
    textAlign(CENTER, CENTER);
    textFont("monospace");

    // Title glow
    let titlePulse = 0.85 + sin(this.menuPulse * 3) * 0.15;
    let glowAlpha = floor(40 * titlePulse);

    // Title shadow
    fill(0, 200, 255, glowAlpha);
    textSize(58);
    text("⚔️ TWIN STICK SHOOTER", width / 2 + 2, height / 2 - 130 + 2);

    // Title
    fill(255, 255, 255, floor(255 * titlePulse));
    textSize(58);
    text("⚔️ TWIN STICK SHOOTER", width / 2, height / 2 - 130);

    // Subtitle
    fill(0, 200, 255, 180);
    textSize(18);
    text("Steering Behaviors × Vampire Survivors", width / 2, height / 2 - 75);

    // High Score
    if (this.highScore > 0) {
      fill(255, 220, 50);
      textSize(20);
      text(`🏆  Best Score: ${this.highScore}`, width / 2, height / 2 - 30);
    }

    // Play button
    let btnW = 240, btnH = 54;
    let btnX = width / 2 - btnW / 2;
    let btnY = height / 2 + 20;
    this._drawButton(btnX, btnY, btnW, btnH, "▶  PLAY  [ENTER]", color(0, 200, 100), 20);

    // Controls info
    fill(180, 180, 180, 150);
    textSize(13);
    let infoY = height / 2 + 110;
    text("[ZQSD / WASD / ←↑↓→]  Move", width / 2, infoY);
    text("[SPACE] Fire — No auto-fire!", width / 2, infoY + 22);
    text("⚡Fire Rate  |  🔫Shot Lines  |  🛡️Shield  |  💨Speed", width / 2, infoY + 44);
    text("Wave 8+ : Enemies shoot seeking missiles!", width / 2, infoY + 66);
    text("[D] Debug   |   [R] Restart", width / 2, infoY + 88);

    // Footer
    fill(100, 100, 100, 100);
    textSize(11);
    text("EMSI • 5IIR • Master AI • IA Reactive", width / 2, height - 30);

    pop();
  }

  _drawButton(x, y, w, h, label, col, textSz) {
    push();
    // Button hover detection
    let hovering = mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
    let brightness = hovering ? 1.3 : 1.0;

    // Shadow
    noStroke();
    fill(0, 0, 0, 60);
    rect(x + 3, y + 3, w, h, 8);

    // Background
    fill(
      min(red(col) * brightness, 255),
      min(green(col) * brightness, 255),
      min(blue(col) * brightness, 255),
      220
    );
    rect(x, y, w, h, 8);

    // Border glow
    if (hovering) {
      noFill();
      stroke(255, 255, 255, 80);
      strokeWeight(2);
      rect(x, y, w, h, 8);
    }

    // Label
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(textSz || 16);
    text(label, x + w / 2, y + h / 2);
    pop();
  }

  // ─── MOUSE CLICK (for menu/gameover/fire buttons) ───────────
  handleClick(mx, my) {
    if (this.state === "playing") {
      // Fire button click
      if (this._fireBtnPos) {
        let fb = this._fireBtnPos;
        if (dist(mx, my, fb.x, fb.y) < fb.r) {
          this.manualFire();
          return;
        }
      }
    } else if (this.state === "menu") {
      // Play button
      let btnW = 240, btnH = 54;
      let btnX = width / 2 - btnW / 2;
      let btnY = height / 2 + 20;
      if (mx > btnX && mx < btnX + btnW && my > btnY && my < btnY + btnH) {
        this.init();
      }
    } else if (this.state === "gameover") {
      let btnW = 180, btnH = 44, btnGap = 30;
      let btnY = height / 2 + 90;

      // Play Again button
      let rx = width / 2 - btnW - btnGap / 2;
      if (mx > rx && mx < rx + btnW && my > btnY && my < btnY + btnH) {
        this.destroy();
        let hs = this.highScore;
        this.init();
        this.highScore = hs;
      }

      // Menu button
      let mxx = width / 2 + btnGap / 2;
      if (mx > mxx && mx < mxx + btnW && my > btnY && my < btnY + btnH) {
        this.goToMenu();
      }
    }
  }

  goToMenu() {
    this.destroy();
    let hs = this.highScore;
    this.state = "menu";
    this.highScore = hs;
    this.menuParticles = [];
    this.menuPulse = 0;
    // Stop music
    if (typeof sndMusic !== 'undefined' && sndMusic.isPlaying()) {
      sndMusic.stop();
    }
  }

  // ─── CLAVIER ─────────────────────────────────────────────
  keyDown(k) {
    if (k === "z" || k === "w" || k === "ArrowUp")    this.keys.up = true;
    if (k === "s" || k === "ArrowDown")                this.keys.down = true;
    if (k === "q" || k === "a" || k === "ArrowLeft")   this.keys.left = true;
    if (k === "d" || k === "ArrowRight")               this.keys.right = true;
    if (k === " ")                                     this.keys.fire = true;
  }

  keyUp(k) {
    if (k === "z" || k === "w" || k === "ArrowUp")    this.keys.up = false;
    if (k === "s" || k === "ArrowDown")                this.keys.down = false;
    if (k === "q" || k === "a" || k === "ArrowLeft")   this.keys.left = false;
    if (k === "d" || k === "ArrowRight")               this.keys.right = false;
    if (k === " ")                                     this.keys.fire = false;
  }

  destroy() {
    if (this.sliderContainer) this.sliderContainer.remove();
  }
}
