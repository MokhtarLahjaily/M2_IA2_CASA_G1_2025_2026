/**
 * Player — Véhicule contrôlé au clavier (ZQSD / WASD / flèches).
 * Utilise la physique d'accélération/vitesse de Vehicle.
 * Comportements :
 *   - Déplacement au clavier (force directionnelle)
 *   - boundaries() pour rester dans le canvas
 *   - avoid() pour contourner les obstacles
 *
 * Le joueur tire automatiquement des projectiles (auto-fire comme Vampire Survivors).
 */
class Player extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.maxSpeed = 5;
    this.maxForce = 0.6;
    this.r_pourDessin = 14;
    this.r = 20;
    this.largeurZoneEvitementDevantVaisseau = 16;
    this.color = color(0, 200, 255);
    this.alive = true;

    // Poids des forces
    this.moveWeight = 1.0;
    this.avoidWeight = 5;
    this.boundariesWeight = 8;

    // Tir
    this.fireRate = 15;        // frames entre chaque tir (slower start)
    this.fireTimer = 0;
    this.shotLines = 1;        // nombre de lignes de tir (augmenté par MultiShotToken)
    this.maxShotLines = 7;     // max lignes

    // Stats
    this.hp = 8;
    this.maxHp = 8;
    this.invincibleTimer = 0;  // frames d'invincibilité après un hit

    // Shield (temporary invulnerability from power-up)
    this.shieldTimer = 0;

    // Speed boost
    this.speedBoostTimer = 0;
    this.baseMaxSpeed = this.maxSpeed; // save original for reset

    // XP & Level
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 20;

    // Trail
    this.trail = [];
    this.trailMax = 15;
  }

  /**
   * @param {Object} keys          état des touches pressées
   * @param {Obstacle[]} obstacles
   */
  applyBehaviors(keys, obstacles) {
    // 1) Force de déplacement clavier
    let dir = createVector(0, 0);
    if (keys.up) dir.y -= 1;
    if (keys.down) dir.y += 1;
    if (keys.left) dir.x -= 1;
    if (keys.right) dir.x += 1;

    if (dir.mag() > 0) {
      dir.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(dir, this.vel);
      steer.limit(this.maxForce);
      steer.mult(this.moveWeight);
      this.applyForce(steer);
    } else {
      // Friction quand on ne bouge pas (décélération douce)
      let friction = this.vel.copy().mult(-0.08);
      this.applyForce(friction);
    }

    // 2) Avoid obstacles
    let avoidForce = this.avoid(obstacles);
    avoidForce.mult(this.avoidWeight);
    this.applyForce(avoidForce);

    // 3) Boundaries
    let boundForce = this.boundaries(0, 0, width, height, 35);
    boundForce.mult(this.boundariesWeight);
    this.applyForce(boundForce);
  }

  update() {
    super.update();

    // Timers
    if (this.invincibleTimer > 0) this.invincibleTimer--;
    if (this.fireTimer > 0) this.fireTimer--;

    // Shield timer
    if (this.shieldTimer > 0) this.shieldTimer--;

    // Speed boost timer
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer--;
      if (this.speedBoostTimer <= 0) {
        this.maxSpeed = this.baseMaxSpeed;
      }
    }

    // Trail
    this.trail.push(this.pos.copy());
    if (this.trail.length > this.trailMax) this.trail.shift();

    // Hard-clamp dans le canvas
    this.pos.x = constrain(this.pos.x, this.r, width - this.r);
    this.pos.y = constrain(this.pos.y, this.r, height - this.r);
  }

  takeDamage() {
    if (this.shieldTimer > 0) return; // shield blocks all damage
    if (this.invincibleTimer > 0) return;
    this.hp--;
    this.invincibleTimer = 45; // ~0.75s d'invincibilité
    if (this.hp <= 0) this.alive = false;
  }

  addXP(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = floor(this.xpToNext * 1.3);
      // Bonus de niveau
      this.maxHp += 2;
      this.hp = min(this.hp + 2, this.maxHp);
      // Fire rate improves slowly: -1 every 2 levels, min 4
      if (this.level % 2 === 0 && this.fireRate > 4) this.fireRate--;
      // Projectile plus puissant et plus rapide à chaque level
      this.projectileDamageBonus = (this.projectileDamageBonus || 0) + 0.3;
      this.projectileSpeedBonus = (this.projectileSpeedBonus || 0) + 0.5;
      this.projectileForceBonus = (this.projectileForceBonus || 0) + 0.03;
      // 🔊 Level up sound
      if (typeof sndLevelUp !== 'undefined' && !sndLevelUp.isPlaying()) {
        sndLevelUp.play();
      }
    }
  }

  canFire() {
    return this.fireTimer <= 0;
  }

  resetFireTimer() {
    this.fireTimer = this.fireRate;
  }

  activateShield(duration) {
    this.shieldTimer = duration;
  }

  activateSpeedBoost(multiplier, duration) {
    this.baseMaxSpeed = this.baseMaxSpeed || 5;
    this.maxSpeed = this.baseMaxSpeed * multiplier;
    this.speedBoostTimer = duration;
  }

  // ─── DESSIN ──────────────────────────────────────────────
  show() {
    // Trail
    push();
    noStroke();
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 10, 60);
      let sz = map(i, 0, this.trail.length, 4, this.r_pourDessin);
      fill(0, 200, 255, alpha);
      ellipse(this.trail[i].x, this.trail[i].y, sz);
    }
    pop();

    // Flash si invincible
    let visible = true;
    if (this.invincibleTimer > 0) {
      visible = (frameCount % 6) < 3;
    }

    if (visible) {
      push();
      translate(this.pos.x, this.pos.y);
      let angle = this.vel.mag() > 0.5 ? this.vel.heading() : 0;
      rotate(angle);

      // Glow
      noStroke();
      fill(0, 200, 255, 30);
      ellipse(0, 0, this.r * 3);

      // Corps
      stroke(0, 150, 220);
      strokeWeight(2);
      fill(this.color);
      // Forme hexagonale (plus dynamique qu'un triangle)
      beginShape();
      for (let a = 0; a < TWO_PI; a += TWO_PI / 6) {
        let sx = cos(a) * this.r_pourDessin;
        let sy = sin(a) * this.r_pourDessin;
        vertex(sx, sy);
      }
      endShape(CLOSE);

      // Canon (direction du mouvement)
      fill(200, 240, 255);
      noStroke();
      rect(this.r_pourDessin * 0.3, -2.5, this.r_pourDessin * 0.7, 5, 2);

      pop();
    }

    // HP bar
    this.drawHPBar();

    // Shield bubble
    if (this.shieldTimer > 0) {
      push();
      noFill();
      let shieldAlpha = this.shieldTimer < 90 ? map(this.shieldTimer, 0, 90, 40, 160) : 160;
      stroke(80, 200, 255, shieldAlpha);
      strokeWeight(2.5);
      ellipse(this.pos.x, this.pos.y, this.r * 4.5);
      // Flash when about to expire
      if (this.shieldTimer < 90 && frameCount % 8 < 4) {
        stroke(200, 240, 255, 120);
        ellipse(this.pos.x, this.pos.y, this.r * 4.5);
      }
      // Inner glow
      noStroke();
      fill(80, 200, 255, shieldAlpha * 0.1);
      ellipse(this.pos.x, this.pos.y, this.r * 4);
      pop();
    }

    // Speed boost lines
    if (this.speedBoostTimer > 0 && this.vel.mag() > 0.5) {
      push();
      stroke(220, 255, 50, 100);
      strokeWeight(1.5);
      let backDir = this.vel.copy().mult(-1).normalize();
      for (let i = 0; i < 4; i++) {
        let ox = random(-6, 6);
        let oy = random(-6, 6);
        let len = random(12, 22);
        line(
          this.pos.x + ox, this.pos.y + oy,
          this.pos.x + ox + backDir.x * len, this.pos.y + oy + backDir.y * len
        );
      }
      pop();
    }

    // Debug
    if (Vehicle.debug) {
      push();
      noFill();
      stroke(0, 255, 255, 80);
      ellipse(this.pos.x, this.pos.y, this.r * 2);
      if (this.vel.mag() > 0.3) {
        this.drawVector(this.pos, p5.Vector.mult(this.vel, 12), color(0, 255, 255));
      }
      pop();
    }
  }

  drawHPBar() {
    let barW = 36;
    let barH = 5;
    let x = this.pos.x - barW / 2;
    let y = this.pos.y - this.r_pourDessin - 12;
    push();
    noStroke();
    fill(40, 40, 40, 180);
    rect(x - 1, y - 1, barW + 2, barH + 2, 3);
    let ratio = this.hp / this.maxHp;
    let barColor = ratio > 0.5 ? color(0, 220, 100) : ratio > 0.25 ? color(255, 180, 0) : color(255, 50, 50);
    fill(barColor);
    rect(x, y, barW * ratio, barH, 2);
    pop();
  }

  /**
   * Draws a crosshair/reticle in the direction the player is facing.
   * @param {p5.Vector} facingDir normalized facing direction
   */
  drawCrosshair(facingDir) {
    if (!facingDir) return;
    let cx = this.pos.x + facingDir.x * 50;
    let cy = this.pos.y + facingDir.y * 50;
    push();
    stroke(0, 200, 255, 120);
    strokeWeight(1.5);
    noFill();
    // Outer ring
    ellipse(cx, cy, 16, 16);
    // Inner dot
    fill(0, 200, 255, 180);
    noStroke();
    ellipse(cx, cy, 4, 4);
    // Line from player to crosshair
    stroke(0, 200, 255, 40);
    strokeWeight(1);
    line(this.pos.x, this.pos.y, cx, cy);
    pop();
  }
}
