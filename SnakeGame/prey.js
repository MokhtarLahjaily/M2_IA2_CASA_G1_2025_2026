/**
 * Prey — Base food item. Wanders, flees snakes. Extends Vehicle.
 * Sub-classes add variety: BonusPrey, PoisonPrey, FleeingPrey.
 * PowerUp — Collectible buffs that wander and expire.
 */
class Prey extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.r_pourDessin = random(6, 10);
    this.r = this.r_pourDessin * 2;
    this.largeurZoneEvitementDevantVaisseau = this.r_pourDessin;
    this.baseColor = color(random(150, 255), random(150, 255), random(50, 150));
    this.color = this.baseColor;
    this.maxSpeed = random(2, 3);
    this.maxForce = 0.12;
    this.vel = p5.Vector.random2D().mult(random(0.5, 1.5));
    this.distanceCercle = 60;
    this.wanderRadius = 30;
    this.wanderTheta = random(TWO_PI);
    this.displaceRange = 0.3;
    this.perceptionRadius = 100;
    this.wanderWeight = 1;
    this.fleeWeight = 2;
    this.avoidWeight = 2;
    this.boundariesWeight = 5;
    this.pulse = random(TWO_PI);
    this.scared = false;
    this.points = 10;
  }

  applyBehaviors(snake, obstacles, rivalSnakes) {
    let wanderForce = this.wander();
    wanderForce.mult(this.wanderWeight);
    let avoidForce = this.avoid(obstacles);
    avoidForce.mult(this.avoidWeight);
    let boundForce = this.boundaries(0, 0, width, height, 40);
    boundForce.mult(this.boundariesWeight);

    // Flee from closest snake head
    let fleeForce = createVector(0, 0);
    this.scared = false;
    let threats = [];
    if (snake && snake.alive) threats.push(snake.head);
    if (rivalSnakes) {
      for (let r of rivalSnakes) {
        if (r && r.alive) threats.push(r.head);
      }
    }
    let closestDist = Infinity, closestThreat = null;
    for (let t of threats) {
      let d = p5.Vector.dist(this.pos, t.pos);
      if (d < this.perceptionRadius && d < closestDist) {
        closestDist = d; closestThreat = t;
      }
    }
    if (closestThreat) {
      this.scared = true;
      fleeForce = this.evade(closestThreat);
      fleeForce.mult(this.fleeWeight);
      this.maxSpeed = 3.5;
    } else {
      this.maxSpeed = random(2, 3);
    }

    // Body separation from snakes
    let sepForce = createVector(0, 0);
    if (snake && snake.alive) {
      for (let part of [snake.head, ...snake.segments]) {
        let ds = p5.Vector.dist(this.pos, part.pos);
        if (ds < this.r_pourDessin + part.r + 5) {
          let push = p5.Vector.sub(this.pos, part.pos);
          push.normalize().div(max(ds, 1));
          sepForce.add(push);
        }
      }
    }
    if (rivalSnakes) {
      for (let rival of rivalSnakes) {
        if (!rival || !rival.alive) continue;
        for (let part of [rival.head, ...rival.segments]) {
          let ds = p5.Vector.dist(this.pos, part.pos);
          if (ds < this.r_pourDessin + part.r + 5) {
            let push = p5.Vector.sub(this.pos, part.pos);
            push.normalize().div(max(ds, 1));
            sepForce.add(push);
          }
        }
      }
    }
    sepForce.mult(8);

    this.applyForce(wanderForce);
    this.applyForce(avoidForce);
    this.applyForce(boundForce);
    this.applyForce(fleeForce);
    this.applyForce(sepForce);
  }

  show() {
    this.pulse += 0.08;
    let sz = this.r_pourDessin * 2 + sin(this.pulse) * 2;
    push(); noStroke();
    if (this.scared) {
      fill(255, 50, 50, 40);
      ellipse(this.pos.x, this.pos.y, this.perceptionRadius * 2);
      this.color = color(255, 80, 80);
    } else {
      this.color = this.baseColor;
    }
    fill(this.color);
    ellipse(this.pos.x, this.pos.y, sz);
    fill(255, 255, 255, 150);
    ellipse(this.pos.x - this.r_pourDessin * 0.25, this.pos.y - this.r_pourDessin * 0.25, sz * 0.3);
    pop();

    if (Vehicle.debug) {
      push(); noFill(); stroke(255, 255, 0, 80); strokeWeight(1);
      ellipse(this.pos.x, this.pos.y, this.perceptionRadius * 2);
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 10), color(255, 200, 0));
      pop();
    }
  }
}

// ─── BONUS PREY (gold, high points) ───────────────────────
class BonusPrey extends Prey {
  constructor(x, y) {
    super(x, y);
    this.baseColor = color(255, 215, 0);
    this.color = this.baseColor;
    this.r_pourDessin = random(10, 14);
    this.r = this.r_pourDessin * 2;
    this.maxSpeed = random(1.5, 2.5);
    this.points = 30;
    this.sparkle = 0;
  }

  show() {
    this.pulse += 0.08;
    this.sparkle += 0.12;
    let sz = this.r_pourDessin * 2 + sin(this.pulse) * 3;
    push(); noStroke();
    // Golden glow
    fill(255, 215, 0, 30 + sin(this.sparkle) * 15);
    ellipse(this.pos.x, this.pos.y, sz * 2.5);
    fill(255, 215, 0, 60);
    ellipse(this.pos.x, this.pos.y, sz * 1.6);
    // Body
    fill(this.scared ? color(255, 150, 50) : this.baseColor);
    ellipse(this.pos.x, this.pos.y, sz);
    // Star highlight
    fill(255, 255, 200, 200);
    ellipse(this.pos.x - this.r_pourDessin * 0.2, this.pos.y - this.r_pourDessin * 0.2, sz * 0.35);
    // "★" label
    fill(80, 50, 0);
    textAlign(CENTER, CENTER); textSize(sz * 0.35);
    text("★", this.pos.x, this.pos.y + 1);
    pop();
  }
}

// ─── POISON PREY (purple, shrinks snake) ──────────────────
class PoisonPrey extends Prey {
  constructor(x, y) {
    super(x, y);
    this.baseColor = color(160, 50, 200);
    this.color = this.baseColor;
    this.r_pourDessin = random(7, 11);
    this.r = this.r_pourDessin * 2;
    this.maxSpeed = random(1.5, 2.5);
    this.points = 0; // no points
    this.isPoison = true;
  }

  show() {
    this.pulse += 0.1;
    let sz = this.r_pourDessin * 2 + sin(this.pulse) * 2;
    push(); noStroke();
    // Warning glow
    fill(160, 50, 200, 25 + sin(this.pulse * 2) * 15);
    ellipse(this.pos.x, this.pos.y, sz * 2.8);
    // Body
    fill(this.baseColor);
    ellipse(this.pos.x, this.pos.y, sz);
    // Skull icon
    fill(255, 255, 255, 200);
    textAlign(CENTER, CENTER); textSize(sz * 0.4);
    text("☠", this.pos.x, this.pos.y + 1);
    // Pulsing outline
    noFill();
    stroke(200, 80, 255, 100 + sin(this.pulse) * 50);
    strokeWeight(2);
    ellipse(this.pos.x, this.pos.y, sz + 4);
    pop();
  }
}

// ─── FLEEING PREY (blue, fast, high reward) ───────────────
class FleeingPrey extends Prey {
  constructor(x, y) {
    super(x, y);
    this.baseColor = color(80, 180, 255);
    this.color = this.baseColor;
    this.r_pourDessin = random(5, 8);
    this.r = this.r_pourDessin * 2;
    this.maxSpeed = random(4, 5.5);
    this.maxForce = 0.2;
    this.perceptionRadius = 180;
    this.fleeWeight = 4;
    this.points = 50;
    this.trail = [];
  }

  applyBehaviors(snake, obstacles, rivalSnakes) {
    // Always flee aggressively from everything
    super.applyBehaviors(snake, obstacles, rivalSnakes);
    // Extra speed when scared
    if (this.scared) this.maxSpeed = 6;
    else this.maxSpeed = random(4, 5);
  }

  show() {
    // Trail effect
    this.trail.push(this.pos.copy());
    if (this.trail.length > 8) this.trail.shift();
    push(); noStroke();
    for (let i = 0; i < this.trail.length; i++) {
      let t = this.trail[i];
      let alpha = map(i, 0, this.trail.length, 10, 60);
      let sz = map(i, 0, this.trail.length, 2, this.r_pourDessin);
      fill(80, 180, 255, alpha);
      ellipse(t.x, t.y, sz);
    }
    pop();

    this.pulse += 0.1;
    let sz = this.r_pourDessin * 2 + sin(this.pulse) * 1.5;
    push(); noStroke();
    fill(this.scared ? color(50, 130, 255) : this.baseColor);
    ellipse(this.pos.x, this.pos.y, sz);
    // Speed lines
    fill(200, 230, 255, 180);
    ellipse(this.pos.x - this.r_pourDessin * 0.2, this.pos.y - this.r_pourDessin * 0.15, sz * 0.25);
    // "⚡" when scared
    if (this.scared) {
      fill(255, 255, 100, 200);
      textAlign(CENTER, CENTER); textSize(sz * 0.45);
      text("⚡", this.pos.x, this.pos.y);
    }
    pop();
  }
}

// ─── POWER-UP (shield / speed / multiplier) ──────────────
class PowerUp extends Vehicle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'shield'|'speed'|'multiplier'} type
   */
  constructor(x, y, type) {
    super(x, y);
    this.type = type;
    this.maxSpeed = 1;
    this.maxForce = 0.05;
    this.vel = p5.Vector.random2D().mult(0.5);
    this.lifetime = 600; // 10 seconds
    this.r = 14;
    this.r_pourDessin = 14;
    this.distanceCercle = 50;
    this.wanderRadius = 25;
    this.wanderTheta = random(TWO_PI);
    this.displaceRange = 0.15;
    this.pulsePhase = random(TWO_PI);

    switch (type) {
      case 'shield':
        this.baseColor = color(0, 200, 255);
        this.emoji = '🛡️';
        break;
      case 'speed':
        this.baseColor = color(0, 255, 100);
        this.emoji = '⚡';
        break;
      case 'multiplier':
        this.baseColor = color(255, 215, 0);
        this.emoji = '✨';
        break;
    }
  }

  applyBehaviors() {
    let wf = this.wander(); wf.mult(0.5);
    let bf = this.boundaries(0, 0, width, height, 60); bf.mult(3);
    this.applyForce(wf);
    this.applyForce(bf);
  }

  updatePowerUp() {
    this.applyBehaviors();
    super.update();
    this.lifetime--;
    this.pulsePhase += 0.08;
  }

  get expired() { return this.lifetime <= 0; }

  show() {
    let pulse = sin(this.pulsePhase) * 3;
    let sz = this.r + pulse;
    let fade = this.lifetime < 120 ? map(this.lifetime, 0, 120, 60, 255) : 255;
    // Blink when about to expire
    if (this.lifetime < 120 && frameCount % 10 < 5) return;

    push(); noStroke();
    // Outer glow
    fill(red(this.baseColor), green(this.baseColor), blue(this.baseColor), 30 * (fade / 255));
    ellipse(this.pos.x, this.pos.y, sz * 4);
    // Inner glow
    fill(red(this.baseColor), green(this.baseColor), blue(this.baseColor), 80 * (fade / 255));
    ellipse(this.pos.x, this.pos.y, sz * 2.5);
    // Core
    fill(red(this.baseColor), green(this.baseColor), blue(this.baseColor), fade);
    ellipse(this.pos.x, this.pos.y, sz * 2);
    // Emoji
    fill(255, fade);
    textAlign(CENTER, CENTER); textSize(16);
    text(this.emoji, this.pos.x, this.pos.y);
    pop();
  }
}
