/**
 * MovingObstacle — Obstacle mobile qui wander sur la carte.
 *
 * Hérite de Vehicle pour bénéficier de wander() + boundaries().
 * Se comporte comme un obstacle classique (les agents doivent l'éviter
 * via avoid()) mais bouge lentement en wanderant.
 *
 * Apparaît progressivement pour augmenter la difficulté.
 * Comportements : wander() + boundaries() + separate() des autres obstacles.
 */
class MovingObstacle extends Vehicle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius  Rayon de l'obstacle
   */
  constructor(x, y, radius) {
    super(x, y);
    this.r = radius;
    this.r_pourDessin = radius;
    this.maxSpeed = random(0.6, 1.5);
    this.maxForce = 0.04;
    this.alive = true;

    // Wander parameters (lent et flottant)
    this.distanceCercle = 80;
    this.wanderRadius = 40;
    this.wanderTheta = random(TWO_PI);
    this.displaceRange = 0.12;

    // Zone d'évitement
    this.largeurZoneEvitementDevantVaisseau = radius;

    // Animation
    this.pulsePhase = random(TWO_PI);

    // Vitesse initiale aléatoire
    this.vel = p5.Vector.random2D().mult(random(0.2, 0.6));
  }

  applyBehaviors(allObstacles) {
    // 1) Wander : mouvement organique
    let wanderForce = this.wander();
    wanderForce.mult(1.0);
    this.applyForce(wanderForce);

    // 2) Boundaries : rester dans le canvas
    let boundForce = this.boundaries(0, 0, width, height, 100);
    boundForce.mult(3.5);
    this.applyForce(boundForce);

    // 3) Separate : ne pas chevaucher les obstacles statiques ou mobiles
    if (allObstacles && allObstacles.length > 0) {
      let sepForce = this.separateFromObstacles(allObstacles);
      sepForce.mult(2.5);
      this.applyForce(sepForce);
    }
  }

  /**
   * Séparation personnalisée pour éviter les autres obstacles.
   */
  separateFromObstacles(obstacles) {
    let desiredSep = this.r * 3;
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of obstacles) {
      if (other === this) continue;
      let d = p5.Vector.dist(this.pos, other.pos);
      let minDist = this.r + (other.r || 30) + 25;
      if (d > 0 && d < max(desiredSep, minDist)) {
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize();
        diff.div(d);
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) {
      steer.div(count);
      steer.setMag(this.maxSpeed);
      steer.sub(this.vel);
      steer.limit(this.maxForce);
    }
    return steer;
  }

  update(allObstacles) {
    this.applyBehaviors(allObstacles);
    super.update();

    // Hard clamp in canvas
    this.pos.x = constrain(this.pos.x, this.r + 15, width - this.r - 15);
    this.pos.y = constrain(this.pos.y, this.r + 15, height - this.r - 15);

    // Pulse animation
    this.pulsePhase += 0.04;
  }

  /**
   * Compatibilité avec obstacle.contains() pour les collisions.
   */
  contains(point) {
    return p5.Vector.dist(point, this.pos) < this.r;
  }

  show() {
    if (!this.alive) return;

    let pulse = 1 + sin(this.pulsePhase) * 0.08;
    let sz = this.r * pulse;

    push();
    translate(this.pos.x, this.pos.y);

    // Aura de danger (pulsante, rouge-orange)
    noStroke();
    let dangerAlpha = 20 + sin(this.pulsePhase * 2) * 12;
    fill(255, 60, 20, dangerAlpha);
    ellipse(0, 0, sz * 3.5);

    // Ombre
    fill(0, 40);
    ellipse(3, 4, sz * 2.1);

    // Corps : dégradé rouge foncé pulsant
    let r = 160 + sin(this.pulsePhase) * 35;
    let g = 50 + sin(this.pulsePhase * 1.2) * 25;
    let b = 25;
    stroke(r + 30, g + 15, b, 170);
    strokeWeight(2.5);
    fill(r, g, b, 220);
    ellipse(0, 0, sz * 2);

    // Motif intérieur tournant (4 cercles = engrenage)
    noStroke();
    fill(255, 100, 40, 70);
    let spinAngle = this.pulsePhase * 0.6;
    for (let i = 0; i < 4; i++) {
      let a = spinAngle + i * HALF_PI;
      let ex = cos(a) * sz * 0.4;
      let ey = sin(a) * sz * 0.4;
      ellipse(ex, ey, sz * 0.3);
    }

    // Centre brillant
    fill(255, 160, 60, 140);
    ellipse(0, 0, sz * 0.55);
    fill(255, 210, 140, 90);
    ellipse(0, 0, sz * 0.25);

    // Flèche de direction
    if (this.vel.mag() > 0.15) {
      let vAngle = this.vel.heading();
      push();
      rotate(vAngle);
      fill(255, 180, 80, 100);
      noStroke();
      triangle(sz * 0.85, 0, sz * 0.5, -sz * 0.18, sz * 0.5, sz * 0.18);
      pop();
    }

    pop();

    // Debug
    if (Vehicle.debug) {
      push();
      noFill();
      stroke(255, 80, 20, 80);
      ellipse(this.pos.x, this.pos.y, this.r * 2);
      if (this.vel.mag() > 0.08) {
        this.drawVector(this.pos, p5.Vector.mult(this.vel, 15), color(255, 100, 40));
      }
      fill(255, 120, 40);
      noStroke();
      textSize(9);
      textAlign(CENTER);
      text("MOVING", this.pos.x, this.pos.y - this.r - 8);
      pop();
    }
  }
}
