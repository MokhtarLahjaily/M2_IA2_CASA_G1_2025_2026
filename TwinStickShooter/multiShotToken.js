/**
 * MultiShotToken — Véhicule flottant qui ajoute une ligne de tir.
 *
 * Hérite de Vehicle : utilise wander() pour flotter doucement.
 * Apparaît aléatoirement (orbe bleu/violet), pulse et tourne.
 * Disparaît après ~18s si non ramassé.
 * Chaque jeton ajoute +1 ligne de tir (spread). Max 7 lignes.
 */
class MultiShotToken extends Vehicle {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    super(x, y);
    this.r = 13;
    this.r_pourDessin = 13;
    this.maxSpeed = 0.3;
    this.maxForce = 0.02;
    this.alive = true;

    // Bonus : +1 ligne de tir
    this.shotBonus = 1;

    // Durée de vie (frames) — disparaît après ~18s
    this.lifespan = 1080;
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
    this.pulsePhase += 0.05;
    this.rotAngle += 0.025;
    if (this.age > this.lifespan) this.alive = false;
  }

  /**
   * @param {Player} player
   * @returns {boolean}
   */
  hits(player) {
    if (!this.alive) return false;
    return p5.Vector.dist(this.pos, player.pos) < this.r + player.r;
  }

  show() {
    if (!this.alive) return;

    let pulse = 1 + sin(this.pulsePhase) * 0.18;
    let sz = this.r * pulse;

    // Fade out pendant les 2 dernières secondes
    let fadeAlpha = this.lifespan - this.age < 120
      ? map(this.lifespan - this.age, 0, 120, 0, 255)
      : 255;

    push();
    translate(this.pos.x, this.pos.y);

    // Glow extérieur (bleu-violet)
    noStroke();
    fill(100, 80, 255, 15 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 6);
    fill(120, 100, 255, 30 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 4);

    // Rotation
    rotate(this.rotAngle);

    // Corps principal — diamant / losange avec pointes
    stroke(80, 60, 255, fadeAlpha);
    strokeWeight(1.5);
    fill(140, 120, 255, fadeAlpha);
    beginShape();
    let pts = 8;
    for (let i = 0; i < pts; i++) {
      let a = (TWO_PI / pts) * i - HALF_PI;
      let r = (i % 2 === 0) ? sz * 1.4 : sz * 0.7;
      vertex(cos(a) * r, sin(a) * r);
    }
    endShape(CLOSE);

    // Centre brillant
    noStroke();
    fill(200, 190, 255, fadeAlpha * 0.9);
    ellipse(0, 0, sz * 0.6);

    // Icône triple-line au centre (trois petites barres)
    fill(40, 20, 140, fadeAlpha);
    noStroke();
    rectMode(CENTER);
    let barW = sz * 0.6, barH = sz * 0.15;
    rect(-sz * 0.25, -barH * 1.2, barW, barH, 1);
    rect(0, 0, barW * 1.1, barH, 1);
    rect(sz * 0.25, barH * 1.2, barW, barH, 1);

    pop();
  }
}
