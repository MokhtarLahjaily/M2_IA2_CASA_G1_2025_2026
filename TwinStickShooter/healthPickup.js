/**
 * HealthPickup — Véhicule flottant qui restaure la vie au joueur.
 *
 * Hérite de Vehicle : utilise wander() pour flotter doucement sur la carte.
 * Apparaît aléatoirement, pulse, disparaît après un certain temps.
 */
class HealthPickup extends Vehicle {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    super(x, y);
    this.r = 10;
    this.r_pourDessin = 10;
    this.maxSpeed = 0.3;
    this.maxForce = 0.02;
    this.alive = true;
    this.healAmount = 2;

    // Durée de vie (frames) — disparaît après ~12s
    this.lifespan = 720;
    this.age = 0;

    // Animation
    this.pulsePhase = random(TWO_PI);

    // Wander doux
    this.distanceCercle = 30;
    this.wanderRadius = 15;
    this.wanderTheta = random(TWO_PI);
    this.displaceRange = 0.1;
  }

  applyBehaviors() {
    let wanderForce = this.wander();
    wanderForce.mult(0.4);
    this.applyForce(wanderForce);

    let boundForce = this.boundaries(0, 0, width, height, 30);
    boundForce.mult(2.0);
    this.applyForce(boundForce);
  }

  update() {
    this.applyBehaviors();
    super.update();
    this.age++;
    this.pulsePhase += 0.07;
    if (this.age > this.lifespan) this.alive = false;
  }

  /**
   * Est-ce que le joueur touche ce pickup ?
   * @param {Player} player
   * @returns {boolean}
   */
  hits(player) {
    if (!this.alive) return false;
    return p5.Vector.dist(this.pos, player.pos) < this.r + player.r;
  }

  show() {
    if (!this.alive) return;

    let pulse = 1 + sin(this.pulsePhase) * 0.2;
    let sz = this.r * pulse;

    // Fade out during last 2 seconds (~120 frames)
    let fadeAlpha = this.lifespan - this.age < 120
      ? map(this.lifespan - this.age, 0, 120, 0, 255)
      : 255;

    push();
    translate(this.pos.x, this.pos.y);

    // Outer glow
    noStroke();
    fill(50, 255, 100, 20 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 5);
    fill(50, 255, 100, 40 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 3);

    // Main dot
    stroke(30, 200, 80, fadeAlpha);
    strokeWeight(1.5);
    fill(50, 255, 100, fadeAlpha);
    ellipse(0, 0, sz * 2);

    // White cross (health symbol)
    noStroke();
    fill(255, 255, 255, fadeAlpha * 0.9);
    rectMode(CENTER);
    rect(0, 0, sz * 0.9, sz * 0.3, 1);
    rect(0, 0, sz * 0.3, sz * 0.9, 1);

    // Bright center
    fill(200, 255, 220, fadeAlpha * 0.7);
    ellipse(0, 0, sz * 0.5);

    pop();
  }
}
