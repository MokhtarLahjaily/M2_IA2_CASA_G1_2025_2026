/**
 * FireRateToken — Véhicule flottant qui augmente la cadence de tir.
 *
 * Hérite de Vehicle : utilise wander() pour flotter doucement.
 * Apparaît aléatoirement sur la carte (loot doré/jaune),
 * pulse et tourne doucement. Disparaît après ~15s si non ramassé.
 * Chaque jeton réduit le fireRate du joueur de 1 frame (min 1).
 */
class FireRateToken extends Vehicle {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    super(x, y);
    this.r = 12;
    this.r_pourDessin = 12;
    this.maxSpeed = 0.3;
    this.maxForce = 0.02;
    this.alive = true;

    // Bonus : réduit fireRate de 1 frame
    this.fireRateBonus = 1;

    // Durée de vie (frames) — disparaît après ~15s
    this.lifespan = 900;
    this.age = 0;

    // Animation
    this.pulsePhase = random(TWO_PI);
    this.rotAngle = random(TWO_PI);

    // Wander doux
    this.distanceCercle = 25;
    this.wanderRadius = 12;
    this.wanderTheta = random(TWO_PI);
    this.displaceRange = 0.08;
  }

  applyBehaviors() {
    let wanderForce = this.wander();
    wanderForce.mult(0.4);
    this.applyForce(wanderForce);

    let boundForce = this.boundaries(0, 0, width, height, 35);
    boundForce.mult(2.0);
    this.applyForce(boundForce);
  }

  update() {
    this.applyBehaviors();
    super.update();
    this.age++;
    this.pulsePhase += 0.06;
    this.rotAngle += 0.03;
    if (this.age > this.lifespan) this.alive = false;
  }

  /**
   * Est-ce que le joueur touche ce token ?
   * @param {Player} player
   * @returns {boolean}
   */
  hits(player) {
    if (!this.alive) return false;
    return p5.Vector.dist(this.pos, player.pos) < this.r + player.r;
  }

  show() {
    if (!this.alive) return;

    let pulse = 1 + sin(this.pulsePhase) * 0.15;
    let sz = this.r * pulse;

    // Fade out pendant les 2 dernières secondes (~120 frames)
    let fadeAlpha = this.lifespan - this.age < 120
      ? map(this.lifespan - this.age, 0, 120, 0, 255)
      : 255;

    push();
    translate(this.pos.x, this.pos.y);

    // Glow extérieur (doré)
    noStroke();
    fill(255, 200, 50, 15 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 6);
    fill(255, 200, 50, 30 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 4);

    // Rotation du jeton
    rotate(this.rotAngle);

    // Corps principal — forme d'éclair/étoile
    stroke(255, 180, 0, fadeAlpha);
    strokeWeight(1.5);
    fill(255, 220, 50, fadeAlpha);
    beginShape();
    for (let i = 0; i < 6; i++) {
      let a = (TWO_PI / 6) * i - HALF_PI;
      let outerR = sz * 1.3;
      let innerR = sz * 0.6;
      vertex(cos(a) * outerR, sin(a) * outerR);
      let mid = a + TWO_PI / 12;
      vertex(cos(mid) * innerR, sin(mid) * innerR);
    }
    endShape(CLOSE);

    // Centre brillant
    noStroke();
    fill(255, 255, 200, fadeAlpha * 0.9);
    ellipse(0, 0, sz * 0.7);

    // Icône éclair au centre
    fill(180, 100, 0, fadeAlpha);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(sz * 0.9);
    text("⚡", 0, -1);

    pop();
  }
}
