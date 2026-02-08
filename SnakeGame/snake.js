/**
 * Snake — Player-controlled (or AI auto-play) snake.
 * Architecture « Leader Following » (Craig Reynolds):
 *   - Head is a Vehicle using arrive() toward mouse (player) or AI seek/wander.
 *   - Each body segment uses arrive() to follow the previous one.
 *   - Head uses avoid() for obstacles and boundaries().
 *
 * In Watch mode, autoPlay = true → snake behaves like a smart SnakeRival.
 * Supports power-ups: shield, speed boost, score multiplier.
 */
class Snake {
  constructor(x, y, length = 10, segSize = 14) {
    this.segSize = segSize;
    this.alive = true;
    this.autoPlay = false;

    // ── Head ──
    this.head = new Vehicle(x, y);
    this.head.maxSpeed = 8;
    this.head.maxForce = 0.4;
    this.head.r = segSize;
    this.head.r_pourDessin = segSize;
    this.head.largeurZoneEvitementDevantVaisseau = segSize;
    this.head.color = "#00FF88";

    // Behavior weights
    this.seekWeight = 0.6;
    this.avoidWeight = 4;
    this.boundariesWeight = 5;

    // ── Dash ──
    this.dashing = false;
    this.dashSpeed = 14;
    this.normalSpeed = 8;
    this.dashDuration = 0;
    this.dashMaxDuration = 60;
    this.dashCooldown = 0;
    this.dashCooldownMax = 90;
    this.dashSegTimer = 0;

    // ── Power-ups ──
    this.shieldTimer = 0;
    this.speedBoostTimer = 0;
    this.scoreMultiplier = 1;
    this.multiplierTimer = 0;

    // ── Auto-play AI config ──
    this.aiPerceptionRadius = 380;
    this.aiState = "foraging";
    this.head.distanceCercle = 120;
    this.head.wanderRadius = 60;
    this.head.wanderTheta = random(TWO_PI);
    this.head.displaceRange = 0.25;

    // ── Body ──
    this.segments = [];
    for (let i = 0; i < length; i++) {
      let seg = new Vehicle(x - (i + 1) * segSize, y);
      seg.maxSpeed = 9;
      seg.maxForce = 0.5;
      seg.r = segSize;
      seg.r_pourDessin = segSize;
      seg.color = "#00CC66";
      this.segments.push(seg);
    }
  }

  get length() { return 1 + this.segments.length; }
  get pos() { return this.head.pos; }

  // ── Power-up API ──
  activateShield()     { this.shieldTimer = 300; }
  activateSpeedBoost() { this.speedBoostTimer = 300; }
  activateMultiplier() { this.scoreMultiplier = 2; this.multiplierTimer = 480; }
  get hasShield()      { return this.shieldTimer > 0; }
  get hasSpeedBoost()  { return this.speedBoostTimer > 0; }
  get hasMultiplier()  { return this.multiplierTimer > 0; }

  // ────────────────────────────────────────────────────────
  //  Player-controlled update (mouse → arrive)
  // ────────────────────────────────────────────────────────
  update(target, obstacles) {
    if (!this.alive) return;
    this._tickTimers();

    let arriveForce = this.head.arrive(target);
    let avoidForce  = this.head.avoid(obstacles);
    let boundForce  = this.head.boundaries(0, 0, width, height, 40);

    arriveForce.mult(this.seekWeight);
    avoidForce.mult(this.avoidWeight);
    boundForce.mult(this.dashing ? this.boundariesWeight * 3 : this.boundariesWeight);

    this.head.applyForce(arriveForce);
    this.head.applyForce(avoidForce);
    this.head.applyForce(boundForce);

    this.head.update();
    this.head.pos.x = constrain(this.head.pos.x, 5, width - 5);
    this.head.pos.y = constrain(this.head.pos.y, 5, height - 5);

    this._updateBody();
    this._checkObstacleCollision(obstacles);
  }

  // ────────────────────────────────────────────────────────
  //  AI auto-play update (Watch mode — identical gameplay)
  // ────────────────────────────────────────────────────────
  updateAutoPlay(obstacles, preys, foodItems, rivals) {
    if (!this.alive) return;
    this._tickTimers();

    // ── Threat detection: flee from bigger snakes ──
    let fleeTarget = null;
    let fleeDist = 200;
    for (let r of rivals) {
      if (!r.alive) continue;
      let d = p5.Vector.dist(this.head.pos, r.head.pos);
      if (r.length > this.length && d < fleeDist) {
        fleeDist = d;
        fleeTarget = r;
      }
    }

    if (fleeTarget && fleeDist < 160) {
      // FLEE + EVADE (Craig Reynolds)
      let fleeForce = this.head.flee(fleeTarget.head.pos);
      fleeForce.mult(4);
      this.head.applyForce(fleeForce);
      let evadeForce = this.head.evade(fleeTarget.head);
      evadeForce.mult(2);
      this.head.applyForce(evadeForce);
      if (this.dashCooldown <= 0 && this.segments.length > 4) this.startDash();
      this.aiState = "fleeing";
    } else {
      // ── Forage: seek nearest food ──
      let bestTarget = null;
      let bestDist = this.aiPerceptionRadius;

      for (let p of preys) {
        if (p.constructor && p.constructor.name === 'PoisonPrey') continue;
        let d = p5.Vector.dist(this.head.pos, p.pos);
        if (d < bestDist) { bestDist = d; bestTarget = p.pos; }
      }
      for (let f of foodItems) {
        let d = p5.Vector.dist(this.head.pos, f.pos);
        if (d < bestDist * 0.8) { bestDist = d; bestTarget = f.pos; }
      }

      if (bestTarget) {
        let seekForce = this.head.seek(bestTarget);
        seekForce.mult(2.5);
        this.head.applyForce(seekForce);
        let wf = this.head.wander(); wf.mult(0.3);
        this.head.applyForce(wf);
        this.aiState = "seeking";
      } else {
        let wf = this.head.wander(); wf.mult(1.0);
        this.head.applyForce(wf);
        this.aiState = "wandering";
      }

      // Hunt smaller rivals when big enough
      if (this.length > 8) {
        for (let r of rivals) {
          if (!r.alive) continue;
          let d = p5.Vector.dist(this.head.pos, r.head.pos);
          if (r.length < this.length - 3 && d < 160) {
            let pf = this.head.pursue(r.head); pf.mult(2);
            this.head.applyForce(pf);
            this.aiState = "hunting";
            if (d < 80 && this.dashCooldown <= 0 && this.segments.length > 5) this.startDash();
            break;
          }
        }
      }
    }

    // Avoid obstacles
    let avoidForce = this.head.avoid(obstacles);
    avoidForce.mult(this.avoidWeight);
    this.head.applyForce(avoidForce);

    // Direct proximity push from obstacles
    for (let obs of obstacles) {
      let d = p5.Vector.dist(this.head.pos, obs.pos);
      let safe = obs.r + this.segSize * 3;
      if (d < safe && d > 0) {
        let push = p5.Vector.sub(this.head.pos, obs.pos);
        push.normalize().mult(map(d, 0, safe, this.head.maxSpeed, 0) * 4);
        this.head.applyForce(push);
      }
    }

    // Boundaries
    let boundForce = this.head.boundaries(0, 0, width, height, 50);
    boundForce.mult(this.dashing ? this.boundariesWeight * 3 : this.boundariesWeight);
    this.head.applyForce(boundForce);

    // Avoid rival snake bodies
    let bodyAvoid = createVector(0, 0);
    for (let r of rivals) {
      if (!r.alive) continue;
      for (let seg of r.segments) {
        let d = p5.Vector.dist(this.head.pos, seg.pos);
        if (d < this.segSize * 5 && d >= 0) {
          let push = p5.Vector.sub(this.head.pos, seg.pos);
          push.normalize().div(max(d, 0.001) / (this.segSize * 5));
          bodyAvoid.add(push);
        }
      }
    }
    bodyAvoid.mult(3);
    this.head.applyForce(bodyAvoid);

    this.head.update();
    this.head.pos.x = constrain(this.head.pos.x, 5, width - 5);
    this.head.pos.y = constrain(this.head.pos.y, 5, height - 5);

    this._updateBody();
    this._checkObstacleCollision(obstacles);
  }

  // ── Shared internals ──
  _tickTimers() {
    if (this.shieldTimer > 0) this.shieldTimer--;
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer--;
      if (!this.dashing) this.head.maxSpeed = this.normalSpeed * 1.5;
    } else if (!this.dashing) {
      this.head.maxSpeed = this.normalSpeed;
    }
    if (this.multiplierTimer > 0) {
      this.multiplierTimer--;
      if (this.multiplierTimer <= 0) this.scoreMultiplier = 1;
    }
    // Dash
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.dashing && this.segments.length > 2) {
      this.head.maxSpeed = this.hasSpeedBoost ? this.dashSpeed * 1.3 : this.dashSpeed;
      this.dashDuration++;
      this.dashSegTimer++;
      if (this.dashSegTimer >= 10) {
        this.dashSegTimer = 0;
        let lost = this.segments.pop();
        if (lost && typeof spawnFoodAt === 'function')
          spawnFoodAt(lost.pos.x, lost.pos.y, this.head.color);
        if (lost && typeof createBoostParticle === 'function')
          for (let k = 0; k < 3; k++) createBoostParticle(lost.pos.x, lost.pos.y, this.head.color);
      }
      if (this.dashDuration >= this.dashMaxDuration || this.segments.length <= 2)
        this.stopDash();
    }
  }

  _updateBody() {
    let leader = this.head;
    for (let seg of this.segments) {
      let desired = this.segSize * 1.2;
      let d = p5.Vector.dist(seg.pos, leader.pos);
      if (d > desired) {
        let force = seg.arrive(leader.pos);
        force.mult(1.5);
        seg.applyForce(force);
      }
      seg.maxSpeed = this.dashing ? this.dashSpeed + 2 : 9;
      seg.update();
      seg.pos.x = constrain(seg.pos.x, 2, width - 2);
      seg.pos.y = constrain(seg.pos.y, 2, height - 2);
      leader = seg;
    }
  }

  _checkObstacleCollision(obstacles) {
    if (this.hasShield) return;
    for (let obs of obstacles) {
      if (obs.contains(this.head.pos)) this.alive = false;
    }
  }

  // ── Dash ──
  startDash() {
    if (this.dashCooldown <= 0 && this.segments.length > 2) {
      this.dashing = true;
      this.dashDuration = 0;
      this.dashSegTimer = 0;
    }
  }
  stopDash() {
    if (this.dashing) {
      this.dashing = false;
      this.dashCooldown = this.dashCooldownMax;
      if (!this.hasSpeedBoost) this.head.maxSpeed = this.normalSpeed;
    }
  }

  // ── Eating ──
  tryEat(prey) {
    let d = p5.Vector.dist(this.head.pos, prey.pos);
    if (d < this.segSize + prey.r_pourDessin) {
      this.grow();
      return true;
    }
    return false;
  }

  grow() {
    let last = this.segments.length > 0
      ? this.segments[this.segments.length - 1] : this.head;
    let seg = new Vehicle(last.pos.x, last.pos.y);
    seg.maxSpeed = 9;
    seg.maxForce = 0.5;
    seg.r = this.segSize;
    seg.r_pourDessin = this.segSize;
    let bodyBase = this.skinBody || "#00CC66";
    let t = constrain(map(this.segments.length, 0, 50, 0, 1), 0, 1);
    seg.color = lerpColor(color(bodyBase), color("#111111"), t);
    this.segments.push(seg);
  }

  shrink(count) {
    for (let i = 0; i < count && this.segments.length > 1; i++) {
      let lost = this.segments.pop();
      if (lost && typeof spawnFoodAt === 'function')
        spawnFoodAt(lost.pos.x, lost.pos.y, '#aa44ff');
    }
  }

  // ── Collision checks ──
  checkEnemyCollision(enemies) {
    if (this.hasShield) return false;
    for (let e of enemies) {
      let d = p5.Vector.dist(this.head.pos, e.pos);
      if (d < this.segSize + e.r) { this.alive = false; return true; }
    }
    return false;
  }

  checkSnakeIoCollision(rival) {
    if (!this.alive || !rival.alive) return 'none';
    let headDist = p5.Vector.dist(this.head.pos, rival.head.pos);

    if (headDist < this.segSize + rival.segSize) {
      if (this.hasShield) return 'rival_dies';
      if (this.length > rival.length) return 'rival_dies';
      if (this.length < rival.length) return 'player_dies';
      return 'both_die';
    }
    for (let seg of rival.segments) {
      let d = p5.Vector.dist(this.head.pos, seg.pos);
      if (d < this.segSize + rival.segSize * 0.8) {
        return this.hasShield ? 'none' : 'player_dies';
      }
    }
    for (let seg of this.segments) {
      let d = p5.Vector.dist(rival.head.pos, seg.pos);
      if (d < rival.segSize + this.segSize * 0.8) return 'rival_dies';
    }
    return 'none';
  }

  checkSelfCollision() {
    if (this.hasShield) return false;
    for (let i = 6; i < this.segments.length; i++) {
      if (p5.Vector.dist(this.head.pos, this.segments[i].pos) < this.segSize * 0.8) return true;
    }
    return false;
  }

  getSegmentPositions() {
    let positions = [{ x: this.head.pos.x, y: this.head.pos.y, color: this.head.color }];
    for (let seg of this.segments)
      positions.push({ x: seg.pos.x, y: seg.pos.y, color: seg.color });
    return positions;
  }

  // ── Drawing ──
  show() {
    // Body (back to front)
    for (let i = this.segments.length - 1; i >= 0; i--) {
      let seg = this.segments[i];
      push(); noStroke();
      fill(0, 35);
      ellipse(seg.pos.x + 2, seg.pos.y + 2, seg.r * 2);
      fill(seg.color);
      ellipse(seg.pos.x, seg.pos.y, seg.r * 2);
      if (i % 2 === 0) {
        let c = color(seg.color);
        fill(red(c) + 40, green(c) + 40, blue(c) + 40, 60);
        ellipse(seg.pos.x - seg.r * 0.2, seg.pos.y - seg.r * 0.2, seg.r * 0.5);
      }
      pop();
    }

    push();
    // Shield bubble
    if (this.hasShield) {
      noFill();
      stroke(0, 200, 255, 120 + sin(frameCount * 0.15) * 60);
      strokeWeight(3);
      ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 4);
      noStroke(); fill(0, 200, 255, 25);
      ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 4);
    }
    // Speed lines
    if (this.hasSpeedBoost) {
      noStroke(); fill(0, 255, 100, 20 + sin(frameCount * 0.2) * 15);
      ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 3);
    }
    // Multiplier sparkle
    if (this.hasMultiplier) {
      noStroke(); fill(255, 215, 0, 30 + sin(frameCount * 0.12) * 20);
      ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 3.2);
    }
    // Dash glow
    if (this.dashing) {
      fill(0, 255, 136, 60); noStroke();
      ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 3.5);
    }

    // Head shadow + body
    fill(0, 40); noStroke();
    ellipse(this.head.pos.x + 2, this.head.pos.y + 2, this.head.r * 2.2);
    fill(this.dashing ? "#44FFAA" : this.head.color); noStroke();
    ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 2);

    // Head highlight
    let hc = color(this.head.color);
    fill(red(hc) + 60, green(hc) + 60, blue(hc) + 60, 80);
    ellipse(this.head.pos.x - this.segSize * 0.2, this.head.pos.y - this.segSize * 0.25, this.segSize * 0.6);

    // Tongue
    let angle = this.head.vel.heading();
    push();
    translate(this.head.pos.x, this.head.pos.y);
    rotate(angle);
    let tw = sin(frameCount * 0.3) * 3;
    stroke(255, 50, 50); strokeWeight(2.5); strokeCap(ROUND);
    let ts = this.segSize * 0.8, te = this.segSize * 1.6;
    line(ts, 0, te, tw);
    line(te, tw, te + 4, tw - 4);
    line(te, tw, te + 4, tw + 4);
    pop();

    // Eyes
    let eo = this.segSize * 0.4, es = this.segSize * 0.45;
    let ex1 = this.head.pos.x + cos(angle - 0.5) * eo;
    let ey1 = this.head.pos.y + sin(angle - 0.5) * eo;
    let ex2 = this.head.pos.x + cos(angle + 0.5) * eo;
    let ey2 = this.head.pos.y + sin(angle + 0.5) * eo;
    fill(255); stroke(0); strokeWeight(0.5);
    ellipse(ex1, ey1, es, es * 1.15);
    ellipse(ex2, ey2, es, es * 1.15);
    let po = es * 0.15;
    fill(0); noStroke();
    ellipse(ex1 + cos(angle) * po, ey1 + sin(angle) * po, es * 0.5);
    ellipse(ex2 + cos(angle) * po, ey2 + sin(angle) * po, es * 0.5);
    fill(255);
    ellipse(ex1 + cos(angle) * po - 1, ey1 + sin(angle) * po - 1.5, es * 0.15);
    ellipse(ex2 + cos(angle) * po - 1, ey2 + sin(angle) * po - 1.5, es * 0.15);
    pop();

    // Name + behavior label
    push();
    textAlign(CENTER, BOTTOM); noStroke();
    let dn = (typeof playerName !== 'undefined' && playerName) ? playerName : 'Player';
    fill(255, 255, 255, 220); textSize(12); textStyle(BOLD);
    text(dn, this.head.pos.x, this.head.pos.y - this.segSize - 16);
    textStyle(NORMAL); textSize(10);
    let bl = this.autoPlay ? this.aiState.toUpperCase() : 'ARRIVE';
    if (this.dashing) bl += ' + DASH';
    fill(0, 255, 136, 180);
    text(bl, this.head.pos.x, this.head.pos.y - this.segSize - 4);
    pop();

    if (Vehicle.debug) {
      push();
      this.head.drawVector(this.head.pos, p5.Vector.mult(this.head.vel, 10), color(0, 255, 0));
      noFill(); stroke(255, 255, 0, 100); strokeWeight(1);
      ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 2);
      pop();
    }
  }
}
