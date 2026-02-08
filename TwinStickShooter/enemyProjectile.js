/**
 * EnemyProjectile — Projectile ennemi utilisant les steering behaviors.
 *
 * Hérite de Vehicle : seek() vers le joueur pour un guidage intelligent.
 * Tiré par les ennemis de type "shooter" à partir de la wave 8.
 * Le projectile est un VRAI Vehicle autonome : il accélère et cherche le joueur.
 *
 * Rouge/orange menaçant, plus lent que les projectiles du joueur
 * mais persistant grâce au homing (seeking) behavior.
 */
class EnemyProjectile extends Vehicle {
  /**
   * @param {number} x       Position initiale X
   * @param {number} y       Position initiale Y
   * @param {p5.Vector} dir  Direction initiale du tir
   */
  constructor(x, y, dir) {
    super(x, y);
    this.maxSpeed = 3.5;
    this.maxForce = 0.25;
    this.r_pourDessin = 5;
    this.r = 7;
    this.largeurZoneEvitementDevantVaisseau = 6;
    this.alive = true;

    // Impulsion initiale dans la direction de tir
    this.vel = dir.copy().setMag(this.maxSpeed);

    // Durée de vie (~3 seconds)
    this.lifespan = 180;
    this.age = 0;

    // Dégâts
    this.damage = 1;

    // Couleur menaçante
    this.color = color(255, 60, 20);

    // Trail
    this.trail = [];
    this.trailMax = 8;

    // Poids des comportements
    this.seekWeight = 2.0;
    this.avoidWeight = 1.0;
  }

  /**
   * Steering behaviors : seek le joueur + avoid obstacles.
   * @param {Player} player
   * @param {Obstacle[]} obstacles
   */
  applyBehaviors(player, obstacles) {
    if (!this.alive || !player || !player.alive) return;

    // Seek vers le joueur — homing missile behavior
    let seekForce = this.seek(player.pos);
    seekForce.mult(this.seekWeight);
    this.applyForce(seekForce);

    // Avoid obstacles
    if (obstacles && obstacles.length > 0) {
      let avoidForce = this.avoid(obstacles);
      avoidForce.mult(this.avoidWeight);
      this.applyForce(avoidForce);
    }
  }

  update() {
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
   * Collision avec le joueur ?
   * @param {Player} player
   * @returns {boolean}
   */
  hitsPlayer(player) {
    if (!this.alive || !player.alive) return false;
    return p5.Vector.dist(this.pos, player.pos) < this.r + player.r;
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

    // Trail rougeoyant
    push();
    noStroke();
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 10, 120);
      let sz = map(i, 0, this.trail.length, 1, this.r_pourDessin * 1.5);
      fill(255, 60, 20, alpha);
      ellipse(this.trail[i].x, this.trail[i].y, sz);
    }
    pop();

    // Corps orienté
    push();
    translate(this.pos.x, this.pos.y);
    let angle = this.vel.heading();
    rotate(angle);

    noStroke();
    // Glow menaçant
    fill(255, 40, 0, 25);
    ellipse(0, 0, this.r_pourDessin * 6);
    fill(255, 60, 10, 40);
    ellipse(0, 0, this.r_pourDessin * 3.5);

    // Corps allongé (missile)
    fill(this.color);
    ellipse(0, 0, this.r_pourDessin * 3, this.r_pourDessin * 1.5);

    // Nez incandescent
    fill(255, 150, 50);
    ellipse(this.r_pourDessin * 0.6, 0, this.r_pourDessin * 1.2, this.r_pourDessin * 0.8);

    // Centre blanc
    fill(255, 220, 100);
    ellipse(this.r_pourDessin * 0.4, 0, this.r_pourDessin * 0.4);

    pop();

    // Debug
    if (Vehicle.debug) {
      push();
      noFill();
      stroke(255, 60, 20, 60);
      ellipse(this.pos.x, this.pos.y, this.r * 2);
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 5), color(255, 80, 30));
      fill(255, 80, 30);
      noStroke();
      textSize(8);
      textAlign(CENTER);
      text("E-PROJ", this.pos.x, this.pos.y - 12);
      pop();
    }
  }
}
