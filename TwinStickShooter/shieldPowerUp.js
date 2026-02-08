/**
 * ShieldPowerUp — Véhicule flottant qui donne un bouclier temporaire.
 *
 * Hérite de Vehicle et utilise wander() pour flotter doucement sur la carte.
 * Le bouclier rend le joueur invulnérable pendant quelques secondes.
 * Apparence : orbe bleu cyan avec anneau rotatif.
 */
class ShieldPowerUp extends Vehicle {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    super(x, y);
    this.r = 12;
    this.r_pourDessin = 12;
    this.maxSpeed = 0.35;
    this.maxForce = 0.02;
    this.alive = true;

    // Bonus : durée du bouclier en frames (5 seconds @60fps)
    this.shieldDuration = 300;

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

    let boundForce = this.boundaries(0, 0, width, height, 40);
    boundForce.mult(2.0);
    this.applyForce(boundForce);
  }

  update() {
    this.applyBehaviors();
    super.update();
    this.age++;
    this.pulsePhase += 0.06;
    this.rotAngle += 0.04;
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

    let fadeAlpha = this.lifespan - this.age < 120
      ? map(this.lifespan - this.age, 0, 120, 0, 255)
      : 255;

    push();
    translate(this.pos.x, this.pos.y);

    // Outer glow (cyan)
    noStroke();
    fill(80, 200, 255, 15 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 6);
    fill(100, 220, 255, 30 * (fadeAlpha / 255));
    ellipse(0, 0, sz * 3.5);

    // Rotating shield ring
    push();
    rotate(this.rotAngle);
    noFill();
    stroke(80, 200, 255, fadeAlpha * 0.6);
    strokeWeight(2);
    arc(0, 0, sz * 3, sz * 3, 0, PI);
    arc(0, 0, sz * 3, sz * 3, PI + 0.5, TWO_PI + 0.3);
    pop();

    // Main orb
    stroke(60, 180, 240, fadeAlpha);
    strokeWeight(1.5);
    fill(80, 200, 255, fadeAlpha * 0.8);
    ellipse(0, 0, sz * 2);

    // Shield arcs inside
    noFill();
    stroke(200, 240, 255, fadeAlpha * 0.7);
    strokeWeight(1.5);
    arc(0, 0, sz * 1.2, sz * 1.2, -PI * 0.7, PI * 0.7);
    arc(0, 0, sz * 0.7, sz * 0.7, -PI * 0.5, PI * 0.5);

    // Bright center
    noStroke();
    fill(200, 240, 255, fadeAlpha * 0.9);
    ellipse(0, 0, sz * 0.5);

    // Shield emoji
    fill(40, 100, 180, fadeAlpha);
    textAlign(CENTER, CENTER);
    textSize(sz * 0.7);
    text("🛡️", 0, -1);

    pop();
  }
}
