/**
 * SnakeRival — Serpent ennemi autonome avec IA snake.io.
 * Architecture « Leader Following » (page 50 du PDF) :
 *   - La tête utilise wander() + avoid(obstacles) + boundaries()
 *   - IA stratégique : mange proies (seek), chasse les plus petits (pursue),
 *     fuit les plus gros (flee), dash pour couper les routes.
 *   - Comportements utilisés : seek, arrive, flee, pursue, wander, avoid, boundaries, separation.
 *   - Chaque segment du corps utilise arrive() sur le segment précédent.
 */
// ─── RIVAL NAMES ───────────────────────────────────────────
const RIVAL_NAMES = [
  "Speedy", "Viper", "Cobra", "Mamba", "Fang",
  "Shadow", "Blaze", "Frost", "Toxic", "Hunter",
  "Rattler", "Asp", "Naga", "Hydra", "Striker",
  "Zigzag", "Phantom", "Frenzy", "Sparky", "Jinx"
];
let _rivalNameIndex = 0;

class SnakeRival {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} length
   * @param {number} segSize
   * @param {string} headColor
   * @param {string} bodyColor
   * @param {number} difficulty  0.0 (easy) – 1.0 (pro). Caps the skill level.
   */
  constructor(x, y, length = 3, segSize = 12, headColor = "#FF4444", bodyColor = "#CC2222", difficulty = 1.0) {
    this.segSize = segSize;
    this.alive = true;
    this.headColor = headColor;
    this.bodyColor = bodyColor;

    // ── Name ──
    this.name = RIVAL_NAMES[_rivalNameIndex % RIVAL_NAMES.length];
    _rivalNameIndex++;

    // ── Skill tier: random personality, CAPPED by difficulty ──
    // difficulty 0.0 → skillLevel in [0.05, 0.25]  (very dumb)
    // difficulty 1.0 → skillLevel in [0.2, 1.0]     (original range)
    let maxSkill = map(difficulty, 0, 1, 0.25, 1.0);
    let minSkill = map(difficulty, 0, 1, 0.05, 0.2);
    let rawSkill = random() < 0.3 ? random(0.6, 1.0) : random(0.15, 0.65);
    this.skillLevel = constrain(map(rawSkill, 0, 1, minSkill, maxSkill), 0.05, 1.0);

    // ── Tête ──
    this.head = new Vehicle(x, y);
    // Speed varies: 3.5 (slow) to 5.5 (fast) based on skill + randomness
    this.normalSpeed = map(this.skillLevel, 0, 1, 3.5, 5.5) + random(-0.3, 0.3);
    this.head.maxSpeed = this.normalSpeed;
    // Smarter = more agile (higher maxForce)
    this.head.maxForce = map(this.skillLevel, 0, 1, 0.2, 0.45) + random(-0.03, 0.03);
    this.head.r = segSize;
    this.head.r_pourDessin = segSize;
    // Wider avoidance zone for obstacle detection (was just segSize)
    this.head.largeurZoneEvitementDevantVaisseau = map(this.skillLevel, 0, 1, segSize * 1.5, segSize * 3);
    this.head.color = headColor;

    // Direction initiale aléatoire
    this.head.vel = p5.Vector.random2D().mult(2);

    // Wander params — smarter snakes wander more purposefully
    this.head.distanceCercle = map(this.skillLevel, 0, 1, 80, 150);
    this.head.wanderRadius = map(this.skillLevel, 0, 1, 40, 70);
    this.head.wanderTheta = random(TWO_PI);
    this.head.displaceRange = map(this.skillLevel, 0, 1, 0.4, 0.2); // smart = steadier

    // Poids des comportements — randomized around skill-based center
    this.wanderWeight = random(0.5, 1.2);
    this.avoidWeight = map(this.skillLevel, 0, 1, 4, 8) + random(-0.5, 0.5);
    this.boundariesWeight = map(this.skillLevel, 0, 1, 4, 7);
    this.seekPreyWeight = map(this.skillLevel, 0, 1, 1.5, 3.5) + random(-0.3, 0.3);

    // Perception — smarter snakes see much further
    this.preyPerceptionRadius = map(this.skillLevel, 0, 1, 200, 400) + random(-20, 20);
    this.huntPerceptionRadius = map(this.skillLevel, 0, 1, 250, 500) + random(-20, 20);
    this.foodPerceptionRadius = map(this.skillLevel, 0, 1, 220, 420) + random(-20, 20);

    // ── AI State ──
    // "foraging" = eat prey/food (wander+seek), "hunting" = pursue a target, "fleeing" = flee from bigger snake
    this.aiState = "foraging";
    this.aiTarget = null;
    this.aiStateTimer = 0;
    // Aggression: smart snakes are more aggressive
    this.aggression = map(this.skillLevel, 0, 1, 0.2, 0.95) + random(-0.1, 0.1);
    this.aggression = constrain(this.aggression, 0.1, 1.0);

    // ── Dash ──
    this.dashing = false;
    this.dashSpeed = map(this.skillLevel, 0, 1, 8, 12);
    this.dashDuration = 0;
    this.dashMaxDuration = floor(map(this.skillLevel, 0, 1, 30, 50));
    this.dashCooldown = 0;
    this.dashCooldownMax = floor(map(this.skillLevel, 0, 1, 150, 80)); // smart = shorter cooldown
    this.dashSegTimer = 0;

    // ── Obstacle proximity avoidance (direct push when too close) ──
    this.obstacleProximityWeight = map(this.skillLevel, 0, 1, 3, 6);

    // ── Corps (tableau de Vehicle) ──
    this.segments = [];
    for (let i = 0; i < length; i++) {
      let seg = new Vehicle(x - (i + 1) * segSize, y);
      seg.maxSpeed = this.normalSpeed + 1;
      seg.maxForce = 0.4;
      seg.r = segSize;
      seg.r_pourDessin = segSize;
      seg.color = bodyColor;
      this.segments.push(seg);
    }
  }

  get length() { return 1 + this.segments.length; }
  get pos() { return this.head.pos; }

  // ────────────────────────────────────────────────────────
  //  AI Decision: pick what to do this frame
  // ────────────────────────────────────────────────────────
  updateAI(allSnakes, playerSnake) {
    this.aiStateTimer++;

    // Gather all living snakes nearby (player + other rivals)
    let nearbyTargets = [];

    // Consider the player
    if (playerSnake && playerSnake.alive) {
      let d = p5.Vector.dist(this.head.pos, playerSnake.head.pos);
      if (d < this.huntPerceptionRadius) {
        nearbyTargets.push({ snake: playerSnake, dist: d, isPlayer: true });
      }
    }

    // Consider other rivals
    for (let other of allSnakes) {
      if (other === this || !other.alive) continue;
      let d = p5.Vector.dist(this.head.pos, other.head.pos);
      if (d < this.huntPerceptionRadius) {
        nearbyTargets.push({ snake: other, dist: d, isPlayer: false });
      }
    }

    // ── State transitions ──
    if (this.aiState === "foraging") {
      // Look for a kill opportunity
      for (let t of nearbyTargets) {
        // Only hunt if we're longer (we'd win head-to-head or can cut them off)
        let dominated = this.length > t.snake.length + 2;
        let canKill = this.length > t.snake.length;
        let closeEnough = t.dist < 180;

        // Aggressive snakes hunt more, passive snakes need bigger advantage
        let wantToHunt = (dominated && random() < this.aggression) ||
                         (canKill && closeEnough && random() < this.aggression * 0.5);

        if (wantToHunt && this.length > 5) {
          this.aiState = "hunting";
          this.aiTarget = t.snake;
          this.aiStateTimer = 0;
          break;
        }
      }
    } else if (this.aiState === "hunting") {
      // Stop hunting if target died, too far, or we got too small
      if (!this.aiTarget || !this.aiTarget.alive) {
        this.aiState = "foraging";
        this.aiTarget = null;
      } else {
        let d = p5.Vector.dist(this.head.pos, this.aiTarget.head.pos);
        if (d > this.huntPerceptionRadius * 1.5 || this.length <= 4) {
          this.aiState = "foraging";
          this.aiTarget = null;
        }
        // Timeout hunt after a while to avoid tunnel vision
        if (this.aiStateTimer > 300) {
          this.aiState = "foraging";
          this.aiTarget = null;
        }
      }
    }

    // ── Avoid being hunted: flee from bigger snakes ──
    for (let t of nearbyTargets) {
      // Flee if the other snake is bigger (even by 1 segment) and close
      let sizeDiff = t.snake.length - this.length;
      let fleeRange = map(this.skillLevel, 0, 1, 120, 200); // smarter snakes detect danger from further
      if (sizeDiff > 0 && t.dist < fleeRange) {
        // Panic! Forget hunting, just run
        this.aiState = "fleeing";
        this.aiTarget = t.snake;
        this.aiStateTimer = 0;
        break;
      }
    }
    if (this.aiState === "fleeing") {
      if (!this.aiTarget || !this.aiTarget.alive) {
        this.aiState = "foraging";
        this.aiTarget = null;
      } else {
        let d = p5.Vector.dist(this.head.pos, this.aiTarget.head.pos);
        if (d > 350 || this.aiStateTimer > 240) {
          this.aiState = "foraging";
          this.aiTarget = null;
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────
  //  Mise à jour principale
  // ────────────────────────────────────────────────────────
  update(preys, obstacles, allSnakes, playerSnake, foodItems) {
    if (!this.alive) return;

    // AI decision
    this.updateAI(allSnakes || [], playerSnake);

    // ── Dash management ──
    if (this.dashCooldown > 0) this.dashCooldown--;

    if (this.dashing && this.segments.length > 2) {
      this.head.maxSpeed = this.dashSpeed;
      this.dashDuration++;
      this.dashSegTimer++;
      if (this.dashSegTimer >= 8) {
        this.dashSegTimer = 0;
        let lost = this.segments.pop();
        if (lost && typeof spawnFoodAt === 'function') {
          spawnFoodAt(lost.pos.x, lost.pos.y, this.headColor);
        }
      }
      if (this.dashDuration >= this.dashMaxDuration || this.segments.length <= 2) {
        this.stopDash();
      }
    } else {
      this.head.maxSpeed = this.normalSpeed;
    }

    // ── Base behaviors: wander + avoid + boundaries ──
    let wanderForce = this.head.wander();
    let avoidForce = this.head.avoid(obstacles);
    let boundForce = this.head.boundaries(0, 0, width, height, 50);

    // Direct proximity avoidance: flee from any obstacle that's too close
    let proximityForce = createVector(0, 0);
    for (let obs of obstacles) {
      let d = p5.Vector.dist(this.head.pos, obs.pos);
      let safeDist = obs.r + this.segSize * 3;
      if (d < safeDist && d > 0) {
        let push = p5.Vector.sub(this.head.pos, obs.pos);
        push.normalize();
        push.mult(map(d, 0, safeDist, this.head.maxSpeed, 0));
        proximityForce.add(push);
      }
    }
    proximityForce.mult(this.obstacleProximityWeight);

    wanderForce.mult(this.wanderWeight);
    avoidForce.mult(this.avoidWeight);
    // Stronger boundaries when dashing to prevent escaping screen
    let bWeight = this.dashing ? this.boundariesWeight * 3 : this.boundariesWeight;
    boundForce.mult(bWeight);

    this.head.applyForce(avoidForce);
    this.head.applyForce(proximityForce);
    this.head.applyForce(boundForce);

    // ── State-based behavior ──
    if (this.aiState === "foraging") {
      // Wander + seek closest prey or food
      this.head.applyForce(wanderForce);
      this._seekFood(preys, foodItems);

    } else if (this.aiState === "hunting" && this.aiTarget) {
      // Pursue the target (course behavior: predict future position + seek)
      this._huntTarget();

    } else if (this.aiState === "fleeing" && this.aiTarget) {
      // Flee (Craig Reynolds): run away from bigger snake
      let fleeForce = this.head.flee(this.aiTarget.head.pos);
      fleeForce.mult(4);
      this.head.applyForce(fleeForce);
      // Also add evade for prediction-based fleeing
      let evadeForce = this.head.evade(this.aiTarget.head);
      evadeForce.mult(2);
      this.head.applyForce(evadeForce);
      // Speed boost while fleeing
      this.head.maxSpeed = this.normalSpeed * 1.3;
      // Dash to escape if possible
      if (this.dashCooldown <= 0 && this.segments.length > 4) {
        this.startDash();
      }
    } else {
      // Fallback: wander + eat
      this.head.applyForce(wanderForce);
      this._seekFood(preys, foodItems);
    }

    // ── Avoid other snake bodies (don't suicide) ──
    this._avoidSnakeBodies(allSnakes, playerSnake);

    this.head.update();

    // Hard clamp: never leave the screen
    this.head.pos.x = constrain(this.head.pos.x, 5, width - 5);
    this.head.pos.y = constrain(this.head.pos.y, 5, height - 5);

    // ── Body follows head (Leader Following) ──
    let leader = this.head;
    for (let seg of this.segments) {
      let desired = this.segSize * 1.2;
      let d = p5.Vector.dist(seg.pos, leader.pos);
      if (d > desired) {
        let force = seg.arrive(leader.pos);
        force.mult(1.5);
        seg.applyForce(force);
      }
      seg.maxSpeed = this.dashing ? this.dashSpeed + 2 : 5.5;
      seg.update();
      // Clamp segments to screen
      seg.pos.x = constrain(seg.pos.x, 2, width - 2);
      seg.pos.y = constrain(seg.pos.y, 2, height - 2);
      leader = seg;
    }

    // ── Obstacle collision → death ──
    for (let obs of obstacles) {
      if (obs.contains(this.head.pos)) {
        this.alive = false;
      }
    }
  }

  // ── Seek nearest prey or dead-snake food ──
  _seekFood(preys, foodItems) {
    let closestTarget = null;
    let closestDist = this.preyPerceptionRadius;

    // Check preys
    for (let p of preys) {
      let d = p5.Vector.dist(this.head.pos, p.pos);
      if (d < closestDist) {
        closestDist = d;
        closestTarget = p.pos;
      }
    }

    // Check food items (dead snake segments) — prefer these, they're bigger rewards
    if (foodItems) {
      for (let f of foodItems) {
        let d = p5.Vector.dist(this.head.pos, f.pos);
        if (d < this.foodPerceptionRadius && d < closestDist * 0.8) {
          closestDist = d;
          closestTarget = f.pos;
        }
      }
    }

    if (closestTarget) {
      let seekForce = this.head.seek(closestTarget);
      seekForce.mult(this.seekPreyWeight);
      this.head.applyForce(seekForce);
    }
  }

  // ── Hunt: use pursue (course behavior) to intercept the target ──
  _huntTarget() {
    let target = this.aiTarget;

    // pursue() from Vehicle: predict target's future position and seek it
    // This is the exact steering behavior from the course (pursue = seek(pos + vel * T))
    let pursueForce = this.head.pursue(target.head);
    pursueForce.mult(2.5);
    this.head.applyForce(pursueForce);

    // Also steer to cut the path perpendicularly (seek a side offset)
    let targetVel = target.head.vel.copy();
    let futurePos = p5.Vector.add(target.head.pos, p5.Vector.mult(targetVel, 15));
    let perp = createVector(-targetVel.y, targetVel.x);
    perp.normalize();
    let sideA = p5.Vector.add(futurePos, p5.Vector.mult(perp, 35));
    let sideB = p5.Vector.sub(futurePos, p5.Vector.mult(perp, 35));
    let dA = p5.Vector.dist(this.head.pos, sideA);
    let dB = p5.Vector.dist(this.head.pos, sideB);
    let cutPoint = dA < dB ? sideA : sideB;

    let cutForce = this.head.seek(cutPoint);
    cutForce.mult(1.0);
    this.head.applyForce(cutForce);

    // Dash for the kill when close and in a good angle
    let distToTarget = p5.Vector.dist(this.head.pos, target.head.pos);
    if (distToTarget < 80 && this.dashCooldown <= 0 && this.segments.length > 4) {
      let myHeading = this.head.vel.heading();
      let toTarget = p5.Vector.sub(target.head.pos, this.head.pos);
      let angleDiff = abs(myHeading - toTarget.heading());
      if (angleDiff < PI / 3) {
        this.startDash();
      }
    }
  }

  // ── Avoid colliding with other snake bodies (self-preservation) ──
  _avoidSnakeBodies(allSnakes, playerSnake) {
    let avoidForce = createVector(0, 0);
    let dangerDist = this.segSize * 6;

    // Check all snake bodies (player + rivals)
    let bodiesToCheck = [];
    if (playerSnake && playerSnake.alive) {
      bodiesToCheck.push(playerSnake);
    }
    for (let s of allSnakes) {
      if (s !== this && s.alive) bodiesToCheck.push(s);
    }

    for (let other of bodiesToCheck) {
      // Avoid body segments (not head — we might want to head-to-head)
      for (let seg of other.segments) {
        let d = p5.Vector.dist(this.head.pos, seg.pos);
        if (d < dangerDist && d > 0) {
          let push = p5.Vector.sub(this.head.pos, seg.pos);
          push.normalize();
          push.div(d / dangerDist); // stronger when closer
          avoidForce.add(push);
        }
      }
    }

    avoidForce.mult(3);
    this.head.applyForce(avoidForce);
  }

  // ── Dash ──
  startDash() {
    if (this.dashCooldown <= 0 && this.segments.length > 2 && !this.dashing) {
      this.dashing = true;
      this.dashDuration = 0;
      this.dashSegTimer = 0;
    }
  }

  stopDash() {
    if (this.dashing) {
      this.dashing = false;
      this.dashCooldown = this.dashCooldownMax;
      this.head.maxSpeed = this.normalSpeed;
    }
  }

  // ── Eat ──
  tryEat(prey) {
    if (!this.alive) return false;
    let d = p5.Vector.dist(this.head.pos, prey.pos);
    if (d < this.segSize + prey.r_pourDessin) {
      this.grow();
      return true;
    }
    return false;
  }

  grow() {
    let last = this.segments.length > 0
      ? this.segments[this.segments.length - 1]
      : this.head;
    let seg = new Vehicle(last.pos.x, last.pos.y);
    seg.maxSpeed = 5.5;
    seg.maxForce = 0.4;
    seg.r = this.segSize;
    seg.r_pourDessin = this.segSize;
    let t = map(this.segments.length, 0, 40, 0, 1);
    t = constrain(t, 0, 1);
    seg.color = lerpColor(color(this.bodyColor), color("#220000"), t);
    this.segments.push(seg);
  }

  // ── Snake.io collision between two rival snakes ──
  checkSnakeIoCollision(otherSnake) {
    if (!this.alive || !otherSnake.alive) return 'none';

    let headDist = p5.Vector.dist(this.head.pos, otherSnake.head.pos);

    // Head-to-head
    if (headDist < this.segSize + otherSnake.segSize) {
      if (this.length > otherSnake.length) return 'other_dies';
      if (this.length < otherSnake.length) return 'self_dies';
      return 'both_die';
    }

    // My head hits other's body
    for (let seg of otherSnake.segments) {
      let d = p5.Vector.dist(this.head.pos, seg.pos);
      if (d < this.segSize + otherSnake.segSize * 0.8) {
        return 'self_dies';
      }
    }

    // Other's head hits my body
    for (let seg of this.segments) {
      let d = p5.Vector.dist(otherSnake.head.pos, seg.pos);
      if (d < otherSnake.segSize + this.segSize * 0.8) {
        return 'other_dies';
      }
    }

    return 'none';
  }

  getSegmentPositions() {
    let positions = [];
    positions.push({ x: this.head.pos.x, y: this.head.pos.y, color: this.headColor });
    for (let seg of this.segments) {
      positions.push({ x: seg.pos.x, y: seg.pos.y, color: seg.color });
    }
    return positions;
  }

  // Dummy for compatibility with Snake.checkSnakeIoCollision
  checkCollisionWithPlayer() { return false; }

  // ────────────────────────────────────────────────────────
  //  Dessin
  // ────────────────────────────────────────────────────────
  show() {
    if (!this.alive) return;

    // Corps (du dernier au premier)
    for (let i = this.segments.length - 1; i >= 0; i--) {
      let seg = this.segments[i];
      push();
      noStroke();
      // Shadow
      fill(0, 30);
      ellipse(seg.pos.x + 2, seg.pos.y + 2, seg.r * 2);
      // Main body
      fill(seg.color);
      ellipse(seg.pos.x, seg.pos.y, seg.r * 2);
      // Highlight stripe
      if (i % 2 === 0) {
        let c = color(seg.color);
        fill(red(c) + 40, green(c) + 40, blue(c) + 40, 50);
        ellipse(seg.pos.x - seg.r * 0.2, seg.pos.y - seg.r * 0.2, seg.r * 0.5);
      }
      pop();
    }

    // Tête
    push();
    // Dash glow
    if (this.dashing) {
      let c = color(this.headColor);
      c.setAlpha(60);
      fill(c);
      noStroke();
      ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 3.5);
    }

    // Shadow under head
    fill(0, 35);
    noStroke();
    ellipse(this.head.pos.x + 2, this.head.pos.y + 2, this.head.r * 2.2);

    fill(this.head.color);
    noStroke();
    ellipse(this.head.pos.x, this.head.pos.y, this.head.r * 2);

    // Highlight on head
    let hc = color(this.headColor);
    fill(red(hc) + 50, green(hc) + 50, blue(hc) + 50, 70);
    ellipse(this.head.pos.x - this.segSize * 0.2, this.head.pos.y - this.segSize * 0.2, this.segSize * 0.5);

    // Tongue (forked, animated)
    let angle = this.head.vel.heading();
    push();
    translate(this.head.pos.x, this.head.pos.y);
    rotate(angle);
    let tongueWave = sin(frameCount * 0.3 + this.head.pos.x * 0.01) * 3;
    stroke(255, 50, 50);
    strokeWeight(2.5);
    strokeCap(ROUND);
    let tongueStart = this.segSize * 0.8;
    let tongueEnd = this.segSize * 1.6;
    line(tongueStart, 0, tongueEnd, tongueWave);
    line(tongueEnd, tongueWave, tongueEnd + 4, tongueWave - 4);
    line(tongueEnd, tongueWave, tongueEnd + 4, tongueWave + 4);
    pop();

    // Yeux
    let eyeOffset = this.segSize * 0.4;
    let eyeSize = this.segSize * 0.45;

    let ex1 = this.head.pos.x + cos(angle - 0.5) * eyeOffset;
    let ey1 = this.head.pos.y + sin(angle - 0.5) * eyeOffset;
    let ex2 = this.head.pos.x + cos(angle + 0.5) * eyeOffset;
    let ey2 = this.head.pos.y + sin(angle + 0.5) * eyeOffset;

    fill(255);
    stroke(0);
    strokeWeight(0.5);
    ellipse(ex1, ey1, eyeSize, eyeSize * 1.15);
    ellipse(ex2, ey2, eyeSize, eyeSize * 1.15);

    // Pupilles — red when hunting, normal otherwise
    let pupilOff = eyeSize * 0.15;
    fill(this.aiState === "hunting" ? color(255, 0, 0) : color(180, 0, 0));
    noStroke();
    ellipse(ex1 + cos(angle) * pupilOff, ey1 + sin(angle) * pupilOff, eyeSize * 0.5);
    ellipse(ex2 + cos(angle) * pupilOff, ey2 + sin(angle) * pupilOff, eyeSize * 0.5);

    // Eye highlights
    fill(255);
    ellipse(ex1 + cos(angle) * pupilOff - 1, ey1 + sin(angle) * pupilOff - 1.5, eyeSize * 0.15);
    ellipse(ex2 + cos(angle) * pupilOff - 1, ey2 + sin(angle) * pupilOff - 1.5, eyeSize * 0.15);
    pop();

    // ── Name + Craig Reynolds behavior label (always visible) ──
    push();
    textAlign(CENTER, BOTTOM);
    noStroke();
    // Name
    fill(255, 255, 255, 210);
    textSize(11);
    textStyle(BOLD);
    text(this.name, this.head.pos.x, this.head.pos.y - this.segSize - 16);
    // Behavior label (Craig Reynolds steering behaviors)
    textStyle(NORMAL);
    textSize(9);
    let behaviorLabel;
    let behaviorColor;
    if (this.aiState === "foraging") {
      behaviorLabel = "WANDER + SEEK";
      behaviorColor = color(100, 255, 100, 180);
    } else if (this.aiState === "hunting") {
      behaviorLabel = "PURSUE";
      behaviorColor = color(255, 80, 80, 200);
    } else if (this.aiState === "fleeing") {
      behaviorLabel = "FLEE + EVADE";
      behaviorColor = color(255, 200, 50, 200);
    } else {
      behaviorLabel = "WANDER";
      behaviorColor = color(150, 150, 255, 180);
    }
    fill(behaviorColor);
    text(behaviorLabel, this.head.pos.x, this.head.pos.y - this.segSize - 4);
    pop();

    // Debug: AI state + perception
    if (Vehicle.debug) {
      push();
      noFill();
      // Perception radius
      stroke(255, 0, 0, 40);
      strokeWeight(1);
      ellipse(this.head.pos.x, this.head.pos.y, this.huntPerceptionRadius * 2);

      // AI state label + skill tier
      fill(255);
      noStroke();
      textSize(10);
      textAlign(CENTER);
      let tierLabel = this.skillLevel > 0.75 ? '★' : (this.skillLevel > 0.5 ? '◆' : '●');
      text(`${this.aiState.toUpperCase()} ${tierLabel}${nf(this.skillLevel, 1, 1)}`, this.head.pos.x, this.head.pos.y - this.segSize - 8);

      // Velocity vector
      this.head.drawVector(this.head.pos, p5.Vector.mult(this.head.vel, 10), color(255, 0, 0));

      // Line to target when hunting or fleeing
      if (this.aiTarget && this.aiTarget.alive && (this.aiState === "hunting" || this.aiState === "fleeing")) {
        stroke(255, 0, 0, 100);
        strokeWeight(1);
        line(this.head.pos.x, this.head.pos.y, this.aiTarget.head.pos.x, this.aiTarget.head.pos.y);
      }
      pop();
    }
  }
}
