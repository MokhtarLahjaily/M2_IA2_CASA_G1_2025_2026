/**
 * EnemyBoid — Flocking enemy (Craig Reynolds Boids algorithm).
 * align + cohesion + separation → group movement
 * flee from player snake AND rival snake heads
 * avoid obstacles, boundaries
 */
class EnemyBoid extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.vel = p5.Vector.random2D().mult(random(2, 4));
    this.maxForce = 0.25;
    this.maxSpeed = 4;
    this.r = 8;
    this.r_pourDessin = 8;
    this.largeurZoneEvitementDevantVaisseau = this.r;
    this.color = color(255, random(50, 120), random(50, 120));

    // Flocking
    this.perceptionRadius = 50;
    this.alignWeight = 1.5;
    this.cohesionWeight = 1;
    this.separationWeight = 2;

    // Other weights
    this.boundariesWeight = 10;
    this.fleeWeight = 4;
    this.avoidWeight = 3;
    this.wanderWeight = 0.3;
    this.snakePerceptionRadius = 180;

    // Wander
    this.distanceCercle = 100;
    this.wanderRadius = 40;
    this.wanderTheta = random(TWO_PI);
    this.displaceRange = 0.2;
  }

  // ── Flocking ──
  align(boids) {
    let steering = createVector();
    let total = 0;
    for (let other of boids) {
      let d = p5.Vector.dist(this.pos, other.pos);
      if (other !== this && d < this.perceptionRadius) {
        steering.add(other.vel);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
    }
    return steering;
  }

  cohesion(boids) {
    let pr = this.perceptionRadius * 2;
    let steering = createVector();
    let total = 0;
    for (let other of boids) {
      let d = p5.Vector.dist(this.pos, other.pos);
      if (other !== this && d < pr) {
        steering.add(other.pos);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total).sub(this.pos).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
    }
    return steering;
  }

  flockSeparation(boids) {
    let steering = createVector();
    let total = 0;
    for (let other of boids) {
      let d = p5.Vector.dist(this.pos, other.pos);
      if (other !== this && d < this.perceptionRadius) {
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.div(d * d);
        steering.add(diff);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
    }
    return steering;
  }

  /**
   * @param {EnemyBoid[]} boids
   * @param {Snake}       snake       Player snake
   * @param {Obstacle[]}  obstacles
   * @param {SnakeRival[]} rivals      AI rival snakes
   */
  applyBehaviors(boids, snake, obstacles, rivals) {
    // Flocking
    let alignment  = this.align(boids);
    let cohesion   = this.cohesion(boids);
    let separation = this.flockSeparation(boids);
    alignment.mult(this.alignWeight);
    cohesion.mult(this.cohesionWeight);
    separation.mult(this.separationWeight);
    this.applyForce(alignment);
    this.applyForce(cohesion);
    this.applyForce(separation);

    // Wander
    let wf = this.wander();
    wf.mult(this.wanderWeight);
    this.applyForce(wf);

    // Flee from player snake
    if (snake && snake.alive) {
      let d = p5.Vector.dist(this.pos, snake.head.pos);
      if (d < this.snakePerceptionRadius) {
        let ff = this.flee(snake.head.pos);
        ff.mult(this.fleeWeight);
        this.applyForce(ff);
      }
    }

    // Flee from rival snake heads too
    if (rivals) {
      for (let r of rivals) {
        if (!r || !r.alive) continue;
        let d = p5.Vector.dist(this.pos, r.head.pos);
        if (d < this.snakePerceptionRadius * 0.8) {
          let ff = this.flee(r.head.pos);
          ff.mult(this.fleeWeight * 0.7);
          this.applyForce(ff);
        }
      }
    }

    // Avoid obstacles
    let af = this.avoid(obstacles);
    af.mult(this.avoidWeight);
    this.applyForce(af);

    // Boundaries
    let bf = this.boundaries(0, 0, width, height, 30);
    bf.mult(this.boundariesWeight);
    this.applyForce(bf);
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    fill(this.color);
    stroke(0); strokeWeight(1);
    triangle(-this.r, -this.r * 0.6, -this.r, this.r * 0.6, this.r, 0);
    fill(255); noStroke();
    ellipse(this.r * 0.3, -this.r * 0.15, this.r * 0.35);
    fill(0);
    ellipse(this.r * 0.4, -this.r * 0.15, this.r * 0.18);
    pop();

    if (Vehicle.debug) {
      push(); noFill();
      stroke(255, 0, 0, 60); strokeWeight(1);
      ellipse(this.pos.x, this.pos.y, this.perceptionRadius * 2);
      stroke(255, 100, 100, 40);
      ellipse(this.pos.x, this.pos.y, this.snakePerceptionRadius * 2);
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 8), color(255, 100, 100));
      pop();
    }
  }
}
