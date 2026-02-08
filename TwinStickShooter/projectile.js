/**
 * Projectile — Véhicule-projectile utilisant les steering behaviors.
 *
 * Comportements :
 *   - seek() vers l'ennemi le plus proche (guidage intelligent)
 *   - avoid() pour contourner les obstacles
 *   - Le projectile est un VRAI Vehicle : il accélère, tourne, etc.
 *
 * Une seule ligne de tir (pas de spread).
 * Détruit au contact d'un ennemi OU d'un obstacle.
 */
class Projectile extends Vehicle {
  /**
   * @param {number} x     Position initiale X
   * @param {number} y     Position initiale Y
   * @param {p5.Vector} dir Direction initiale du tir
   */
  constructor(x, y, dir) {
    super(x, y);
    // ── Stats de véhicule : commence lent, accélère avec les niveaux ──
    this.maxSpeed = 4;
    this.maxForce = 0.4;        // steering force (scales with level too)
    this.r_pourDessin = 4;
    this.r = 6;
    this.largeurZoneEvitementDevantVaisseau = 6;
    this.alive = true;

    // Impulsion initiale dans la direction de tir
    this.vel = dir.copy().setMag(this.maxSpeed);

    // Durée de vie (frames)
    this.lifespan = 100;
    this.age = 0;

    // Dégâts
    this.damage = 1;

    // Couleur
    this.color = color(100, 220, 255);

    // Trail (pour effet visuel)
    this.trail = [];
    this.trailMax = 10;

    // Poids des comportements
    this.seekWeight = 1.5;
    this.avoidWeight = 2.0;
  }

  /**
   * Steering behaviors : seek l'ennemi le plus proche + avoid obstacles.
   * Le projectile est un vrai véhicule autonome !
   *
   * @param {Enemy[]} enemies
   * @param {Obstacle[]} obstacles
   */
  applyBehaviors(enemies, obstacles) {
    if (!this.alive) return;

    // 1) Trouver l'ennemi vivant le plus proche
    let closestDist = Infinity;
    let closestEnemy = null;
    for (let e of enemies) {
      if (!e.alive) continue;
      let d = p5.Vector.dist(this.pos, e.pos);
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = e;
      }
    }

    // 2) Seek / Pursue vers l'ennemi le plus proche
    if (closestEnemy) {
      // Si l'ennemi est assez proche, on utilise pursue (anticipation)
      let steerForce;
      if (closestDist < 300) {
        steerForce = this.pursue(closestEnemy);
      } else {
        steerForce = this.seek(closestEnemy.pos);
      }
      steerForce.mult(this.seekWeight);
      this.applyForce(steerForce);
    }

    // 3) Avoid obstacles (le projectile contourne les obstacles !)
    if (obstacles && obstacles.length > 0) {
      let avoidForce = this.avoid(obstacles);
      avoidForce.mult(this.avoidWeight);
      this.applyForce(avoidForce);
    }
  }

  update() {
    // Vraie physique de Vehicle : acc → vel → pos
    super.update();

    this.age++;
    if (this.age > this.lifespan) this.alive = false;

    // Hors écran → mort
    if (this.pos.x < -30 || this.pos.x > width + 30 ||
        this.pos.y < -30 || this.pos.y > height + 30) {
      this.alive = false;
    }

    // Trail
    this.trail.push(this.pos.copy());
    if (this.trail.length > this.trailMax) this.trail.shift();
  }

  /**
   * Collision avec un ennemi ?
   * @param {Enemy} enemy
   * @returns {boolean}
   */
  hits(enemy) {
    if (!this.alive || !enemy.alive) return false;
    return p5.Vector.dist(this.pos, enemy.pos) < this.r + enemy.r_pourDessin;
  }

  /**
   * Collision avec un obstacle ?
   * @param {Obstacle} obstacle
   * @returns {boolean}
   */
  hitsObstacle(obstacle) {
    if (!this.alive) return false;
    return p5.Vector.dist(this.pos, obstacle.pos) < this.r + obstacle.r;
  }

  // ─── DESSIN ──────────────────────────────────────────────
  show() {
    if (!this.alive) return;

    // Trail lumineux
    push();
    noStroke();
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 10, 140);
      let sz = map(i, 0, this.trail.length, 1, this.r_pourDessin * 1.8);
      fill(100, 220, 255, alpha);
      ellipse(this.trail[i].x, this.trail[i].y, sz);
    }
    pop();

    // Projectile orienté dans la direction du mouvement
    push();
    translate(this.pos.x, this.pos.y);
    let angle = this.vel.heading();
    rotate(angle);

    noStroke();
    // Glow extérieur
    fill(100, 220, 255, 30);
    ellipse(0, 0, this.r_pourDessin * 5);
    // Corps allongé (forme de missile/véhicule)
    fill(this.color);
    ellipse(0, 0, this.r_pourDessin * 3, this.r_pourDessin * 1.5);
    // Nez brillant
    fill(200, 240, 255);
    ellipse(this.r_pourDessin * 0.6, 0, this.r_pourDessin * 1.2, this.r_pourDessin * 0.8);
    // Centre blanc
    fill(255);
    ellipse(this.r_pourDessin * 0.6, 0, this.r_pourDessin * 0.4);

    pop();

    // Debug : vélocité + rayon
    if (Vehicle.debug) {
      push();
      noFill();
      stroke(100, 220, 255, 60);
      ellipse(this.pos.x, this.pos.y, this.r * 2);
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 5), color(100, 220, 255));
      pop();
    }
  }
}
