/**
 * MovingObstacle — Obstacle mobile qui utilise les steering behaviors.
 *
 * Hérite de Vehicle pour bénéficier de wander() + boundaries().
 * Se comporte comme un obstacle classique (les agents doivent l'éviter)
 * mais bouge lentement en wanderant sur la carte.
 *
 * Apparaît à partir de la vague 4 pour augmenter la difficulté.
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
    this.maxSpeed = random(0.8, 1.8);
    this.maxForce = 0.05;
    this.alive = true;

    // Wander parameters (lent et flottant)
    this.distanceCercle = 80;
    this.wanderRadius = 40;
    this.wanderTheta = random(TWO_PI);
    this.displaceRange = 0.15;

    // Zone d'évitement
    this.largeurZoneEvitementDevantVaisseau = radius;

    // Couleur pulsante (rouge/orange pour signaler le danger)
    this.baseHue = random(0, 40);      // teinte rouge-orange
    this.pulsePhase = random(TWO_PI);

    // Vitesse initiale aléatoire
    this.vel = p5.Vector.random2D().mult(random(0.3, 0.8));
  }

  applyBehaviors(obstacles) {
    // 1) Wander : mouvement organique
    let wanderForce = this.wander();
    wanderForce.mult(1.0);
    this.applyForce(wanderForce);

    // 2) Boundaries : rester dans le canvas
    let boundForce = this.boundaries(0, 0, width, height, 80);
    boundForce.mult(3.0);
    this.applyForce(boundForce);

    // 3) Separate : ne pas chevaucher les autres obstacles
    if (obstacles && obstacles.length > 1) {
      let sepForce = this.separateFromObstacles(obstacles);
      sepForce.mult(2.0);
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
      let minDist = this.r + (other.r || 30) + 20;
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

  update() {
    // Apply wander + boundaries
    this.applyBehaviors();
    super.update();

    // Hard clamp in canvas
    this.pos.x = constrain(this.pos.x, this.r + 10, width - this.r - 10);
    this.pos.y = constrain(this.pos.y, this.r + 10, height - this.r - 10);

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

    // Aura de danger (pulsante)
    noStroke();
    let dangerAlpha = 20 + sin(this.pulsePhase * 2) * 15;
    fill(255, 80, 30, dangerAlpha);
    ellipse(0, 0, sz * 3.5);

    // Ombre
    fill(0, 50);
    ellipse(3, 3, sz * 2);

    // Corps : dégradé rouge-orange
    let r = 180 + sin(this.pulsePhase) * 40;
    let g = 60 + sin(this.pulsePhase * 1.3) * 30;
    let b = 30;
    stroke(r + 30, g + 20, b, 180);
    strokeWeight(2.5);
    fill(r, g, b, 220);
    ellipse(0, 0, sz * 2);

    // Motif intérieur (engrenage / danger)
    noStroke();
    fill(255, 120, 50, 80);
    let angle = this.pulsePhase * 0.5;
    for (let i = 0; i < 4; i++) {
      let a = angle + i * HALF_PI;
      let ex = cos(a) * sz * 0.4;
      let ey = sin(a) * sz * 0.4;
      ellipse(ex, ey, sz * 0.35);
    }

    // Centre brillant
    fill(255, 180, 80, 150);
    ellipse(0, 0, sz * 0.6);
    fill(255, 220, 150, 100);
    ellipse(0, 0, sz * 0.3);

    // Indicateur de mouvement : petite flèche de direction
    if (this.vel.mag() > 0.2) {
      let vAngle = this.vel.heading();
      push();
      rotate(vAngle);
      fill(255, 200, 100, 120);
      noStroke();
      triangle(sz * 0.9, 0, sz * 0.5, -sz * 0.2, sz * 0.5, sz * 0.2);
      pop();
    }

    pop();

    // Debug
    if (Vehicle.debug) {
      push();
      noFill();
      stroke(255, 100, 30, 80);
      ellipse(this.pos.x, this.pos.y, this.r * 2);
      if (this.vel.mag() > 0.1) {
        this.drawVector(this.pos, p5.Vector.mult(this.vel, 15), color(255, 120, 50));
      }
      fill(255, 150, 50);
      noStroke();
      textSize(9);
      textAlign(CENTER);
      text("MOVING", this.pos.x, this.pos.y - this.r - 8);
      pop();
    }
  }
}
