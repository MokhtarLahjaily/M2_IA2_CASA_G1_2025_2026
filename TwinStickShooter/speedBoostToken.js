/**
 * SpeedBoostToken — Véhicule flottant qui donne un boost de vitesse temporaire.
 *
 * Hérite de Vehicle et utilise wander() pour flotter doucement.
 * Augmente la vitesse max du joueur pendant quelques secondes.
 * Apparence : orbe vert-jaune avec traînées de vitesse.
 */
class SpeedBoostToken extends Vehicle {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    super(x, y);
    this.r = 11;
    this.r_pourDessin = 11;
    this.maxSpeed = 0.4;
    this.maxForce = 0.02;
    this.alive = true;

    // Bonus
    this.speedMultiplier = 1.6;
    this.boostDuration = 360; // 6 seconds @60fps

    // Durée de vie (frames) — disparaît après ~14s
    this.lifespan = 840;
    this.age = 0;

    // Animation
    this.pulsePhase = random(TWO_PI);
    this.rotAngle = random(TWO_PI);

    // Wander doux
    this.distanceCercle = 30;
    this.wanderRadius = 15;
    this.wanderTheta = random(TWO_PI);
    this.displaceRange = 0.1;
  }

  applyBehaviors() {
    let wanderForce = this.wander();
    wanderForce.mult(0.5);
    this.applyForce(wanderForce);

    let boundForce = this.boundaries(0, 0, width, height, 35);
    boundForce.mult(2.0);
    this.applyForce(boundForce);
  }

  update() {
    this.applyBehaviors();
    super.update();
    this.age++;
    this.pulsePhase += 0.07;
    this.rotAngle += 0.05;
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

    let pulse = 1 + sin(this.pulsePhase) * 0.15;
    let sz = this.r * pulse;

    let fadeAlpha = this.lifespan - this.age < 120
      ? map(this.lifespan - this.age, 0, 120, 0, 255)
      : 255;

    push();
    translate(this.pos.x, this.pos.y);

    // Outer glow (green-yellow)
    noStroke();
    fill(180, 255, 50, 15 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 6);
    fill(200, 255, 80, 30 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 3.5);

    // Speed lines (rotating)
    push();
    rotate(this.rotAngle);
    stroke(200, 255, 50, fadeAlpha * 0.4);
    strokeWeight(2);
    for (let i = 0; i < 3; i++) {
      let a = (TWO_PI / 3) * i;
      let x1 = cos(a) * sz * 1.0;
      let y1 = sin(a) * sz * 1.0;
      let x2 = cos(a) * sz * 1.8;
      let y2 = sin(a) * sz * 1.8;
      line(x1, y1, x2, y2);
    }
    pop();

    // Main body — star shape
    rotate(this.rotAngle * 0.3);
    stroke(150, 220, 30, fadeAlpha);
    strokeWeight(1.5);
    fill(180, 255, 50, fadeAlpha);
    beginShape();
    let pts = 6;
    for (let i = 0; i < pts; i++) {
      let a = (TWO_PI / pts) * i - HALF_PI;
      let r = (i % 2 === 0) ? sz * 1.3 : sz * 0.65;
      vertex(cos(a) * r, sin(a) * r);
    }
    endShape(CLOSE);

    // Bright center
    noStroke();
    fill(230, 255, 180, fadeAlpha * 0.9);
    ellipse(0, 0, sz * 0.6);

    // Speed icon
    fill(80, 140, 10, fadeAlpha);
    textAlign(CENTER, CENTER);
    textSize(sz * 0.8);
    text("💨", 0, -1);

    pop();
  }
}
