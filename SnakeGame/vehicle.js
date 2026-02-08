/**
 * Vehicle — Classe de base pour tous les agents autonomes.
 * Basée sur l'implémentation du cours de M. Buffa (Craig Reynolds Steering Behaviors).
 * Contient : seek, arrive, flee, pursue, evade, wander, avoid, separate, boundaries.
 */

function findProjection(pos, a, b) {
  let v1 = p5.Vector.sub(a, pos);
  let v2 = p5.Vector.sub(b, pos);
  v2.normalize();
  let sp = v1.dot(v2);
  v2.mult(sp);
  v2.add(pos);
  return v2;
}

class Vehicle {
  static debug = false;

  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 4;
    this.maxForce = 0.2;
    this.color = "white";

    this.r_pourDessin = 16;
    this.r = this.r_pourDessin * 3;

    // Pour évitement d'obstacle
    this.largeurZoneEvitementDevantVaisseau = this.r / 2;

    // chemin derrière le véhicule
    this.path = [];
    this.pathMaxLength = 30;

    // Pour wander
    this.distanceCercle = 200;
    this.wanderRadius = 80;
    this.wanderTheta = -Math.PI / 2;
    this.displaceRange = 0.3;
  }

  applyBehaviors() {
    // à redéfinir dans les sous-classes
  }

  // ─── SEEK & ARRIVE ───────────────────────────────────────
  seek(target, arrival = false) {
    let force = p5.Vector.sub(target, this.pos);
    let desiredSpeed = this.maxSpeed;
    if (arrival) {
      let slowRadius = 100;
      let distance = force.mag();
      if (distance < slowRadius) {
        desiredSpeed = map(distance, 0, slowRadius, 0, this.maxSpeed);
      }
    }
    force.setMag(desiredSpeed);
    force.sub(this.vel);
    force.limit(this.maxForce);
    return force;
  }

  arrive(target) {
    return this.seek(target, true);
  }

  // ─── FLEE ────────────────────────────────────────────────
  flee(target) {
    return this.seek(target).mult(-1);
  }

  // ─── PURSUE & EVADE ──────────────────────────────────────
  pursue(vehicle) {
    let target = vehicle.pos.copy();
    let prediction = vehicle.vel.copy();
    prediction.mult(10);
    target.add(prediction);
    return this.seek(target);
  }

  evade(vehicle) {
    let pursuit = this.pursue(vehicle);
    pursuit.mult(-1);
    return pursuit;
  }

  // ─── WANDER ──────────────────────────────────────────────
  wander() {
    let pointDevant = this.vel.copy();
    pointDevant.setMag(this.distanceCercle);
    pointDevant.add(this.pos);

    if (Vehicle.debug) {
      push();
      fill("red");
      noStroke();
      circle(pointDevant.x, pointDevant.y, 8);
      noFill();
      stroke(255);
      circle(pointDevant.x, pointDevant.y, this.wanderRadius * 2);
      strokeWeight(2);
      stroke(255, 255, 255, 80);
      drawingContext.setLineDash([5, 15]);
      line(this.pos.x, this.pos.y, pointDevant.x, pointDevant.y);
      pop();
    }

    let theta = this.wanderTheta + this.vel.heading();
    let pointSurLeCercle = createVector(
      this.wanderRadius * cos(theta),
      this.wanderRadius * sin(theta)
    );
    pointSurLeCercle.add(pointDevant);

    if (Vehicle.debug) {
      push();
      fill("green");
      noStroke();
      circle(pointSurLeCercle.x, pointSurLeCercle.y, 16);
      stroke("yellow");
      strokeWeight(1);
      drawingContext.setLineDash([]);
      line(this.pos.x, this.pos.y, pointSurLeCercle.x, pointSurLeCercle.y);
      pop();
    }

    this.wanderTheta += random(-this.displaceRange, this.displaceRange);

    let force = p5.Vector.sub(pointSurLeCercle, this.pos);
    force.setMag(this.maxForce);
    return force;
  }

  // ─── AVOID OBSTACLES (cercles) ───────────────────────────
  avoid(obstacles) {
    let ahead = this.vel.copy();
    ahead.mult(30);
    let ahead2 = ahead.copy();
    ahead2.mult(0.5);

    if (Vehicle.debug) {
      this.drawVector(this.pos, ahead, "yellow");
    }

    let pointAuBoutDeAhead = this.pos.copy().add(ahead);
    let pointAuBoutDeAhead2 = this.pos.copy().add(ahead2);

    let obstacleLePlusProche = this.getObstacleLePlusProche(obstacles);
    if (obstacleLePlusProche == undefined) {
      return createVector(0, 0);
    }

    let distance1 = pointAuBoutDeAhead.dist(obstacleLePlusProche.pos);
    let distance2 = pointAuBoutDeAhead2.dist(obstacleLePlusProche.pos);
    let distance = min(distance1, distance2);

    if (Vehicle.debug) {
      push();
      fill("red");
      circle(pointAuBoutDeAhead.x, pointAuBoutDeAhead.y, 10);
      fill("blue");
      circle(pointAuBoutDeAhead2.x, pointAuBoutDeAhead2.y, 10);
      stroke(100, 100);
      strokeWeight(this.largeurZoneEvitementDevantVaisseau);
      line(this.pos.x, this.pos.y, pointAuBoutDeAhead.x, pointAuBoutDeAhead.y);
      pop();
    }

    if (distance < obstacleLePlusProche.r + this.largeurZoneEvitementDevantVaisseau) {
      let force;
      if (distance1 < distance2) {
        force = p5.Vector.sub(pointAuBoutDeAhead, obstacleLePlusProche.pos);
      } else {
        force = p5.Vector.sub(pointAuBoutDeAhead2, obstacleLePlusProche.pos);
      }
      if (Vehicle.debug) {
        this.drawVector(obstacleLePlusProche.pos, force, "yellow");
      }
      force.setMag(this.maxSpeed);
      force.sub(this.vel);
      force.limit(this.maxForce);
      return force;
    } else {
      return createVector(0, 0);
    }
  }

  // ─── SEPARATION ──────────────────────────────────────────
  separate(boids) {
    let desiredSeparation = this.r;
    let steer = createVector(0, 0);
    let count = 0;

    for (let other of boids) {
      let d = p5.Vector.dist(this.pos, other.pos);
      if (d > 0 && d < desiredSeparation) {
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize();
        diff.div(d);
        steer.add(diff);
        count++;
      }
    }

    if (count > 0) {
      steer.div(count);
    }

    if (steer.mag() > 0) {
      steer.setMag(this.maxSpeed);
      steer.sub(this.vel);
      steer.limit(this.maxForce);
    }
    return steer;
  }

  // ─── BOUNDARIES ──────────────────────────────────────────
  boundaries(bx, by, bw, bh, d) {
    let vitesseDesiree = null;

    if (this.pos.x < bx + d) {
      vitesseDesiree = createVector(this.maxSpeed, this.vel.y);
    } else if (this.pos.x > bx + bw - d) {
      vitesseDesiree = createVector(-this.maxSpeed, this.vel.y);
    }

    if (this.pos.y < by + d) {
      vitesseDesiree = createVector(this.vel.x, this.maxSpeed);
    } else if (this.pos.y > by + bh - d) {
      vitesseDesiree = createVector(this.vel.x, -this.maxSpeed);
    }

    if (vitesseDesiree !== null) {
      vitesseDesiree.setMag(this.maxSpeed);
      const force = p5.Vector.sub(vitesseDesiree, this.vel);
      force.limit(this.maxForce);
      return force;
    }

    if (Vehicle.debug) {
      push();
      noFill();
      stroke("white");
      strokeWeight(1);
      rect(bx + d, by + d, bw - 2 * d, bh - 2 * d);
      pop();
    }

    return createVector(0, 0);
  }

  // ─── UTILITAIRES ─────────────────────────────────────────
  getObstacleLePlusProche(obstacles) {
    let plusPetiteDistance = Infinity;
    let obstacleLePlusProche = undefined;
    for (let o of obstacles) {
      const distance = this.pos.dist(o.pos);
      if (distance < plusPetiteDistance) {
        plusPetiteDistance = distance;
        obstacleLePlusProche = o;
      }
    }
    return obstacleLePlusProche;
  }

  getVehiculeLePlusProche(vehicules) {
    let plusPetiteDistance = Infinity;
    let vehiculeLePlusProche = undefined;
    for (let v of vehicules) {
      if (v !== this) {
        const distance = this.pos.dist(v.pos);
        if (distance < plusPetiteDistance) {
          plusPetiteDistance = distance;
          vehiculeLePlusProche = v;
        }
      }
    }
    return vehiculeLePlusProche;
  }

  // ─── PHYSIQUE ────────────────────────────────────────────
  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
  }

  // ─── DESSIN ──────────────────────────────────────────────
  show() {
    this.drawVehicle();
  }

  drawVehicle() {
    push();
    stroke(255);
    strokeWeight(2);
    fill(this.color);
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    triangle(
      -this.r_pourDessin, -this.r_pourDessin / 2,
      -this.r_pourDessin, this.r_pourDessin / 2,
      this.r_pourDessin, 0
    );
    if (Vehicle.debug) {
      stroke(255);
      noFill();
      circle(0, 0, this.r);
    }
    pop();
  }

  drawVector(pos, v, color) {
    push();
    strokeWeight(3);
    stroke(color);
    line(pos.x, pos.y, pos.x + v.x, pos.y + v.y);
    let arrowSize = 5;
    translate(pos.x + v.x, pos.y + v.y);
    rotate(v.heading());
    translate(-arrowSize / 2, 0);
    triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);
    pop();
  }

  edges() {
    if (this.pos.x > width + this.r) this.pos.x = -this.r;
    else if (this.pos.x < -this.r) this.pos.x = width + this.r;
    if (this.pos.y > height + this.r) this.pos.y = -this.r;
    else if (this.pos.y < -this.r) this.pos.y = height + this.r;
  }
}
