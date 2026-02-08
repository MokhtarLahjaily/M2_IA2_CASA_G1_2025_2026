/**
 * Enemy — Ennemi de la horde, hérite de Vehicle.
 *
 * 7 types d'ennemis :
 *   - "normal"     : seek standard, vitesse moyenne
 *   - "fast"       : très rapide, petite taille, fragile
 *   - "flanker"    : contourne le joueur pour attaquer par les côtés
 *   - "tank"       : lent, gros, beaucoup de HP (apparaît wave 5+)
 *   - "bomber"     : explose en mourant (dégâts de zone) (wave 7+)
 *   - "shooter"    : garde ses distances et tire des projectiles chercheurs (wave 8+)
 *   - "teleporter" : se téléporte aléatoirement, désorientant (wave 9+)
 *
 * Comportements :
 *   - seek() / pursue() vers le joueur
 *   - separate() entre ennemis → effet de masse réaliste
 *   - avoid() → contourne les obstacles
 *   - boundaries() → reste dans le canvas
 *
 * Les poids seekWeight et separationWeight sont réglables via les sliders du GameManager.
 */
class Enemy extends Vehicle {
  /**
   * @param {number} x
   * @param {number} y
   * @param {string} type  "normal" | "fast" | "flanker" | "tank" | "bomber" | "shooter" | "teleporter"
   */
  constructor(x, y, type = "normal") {
    super(x, y);
    this.type = type;
    this.alive = true;

    // ── Stats par type ──
    switch (type) {
      case "fast":
        this.maxSpeed = random(5.5, 7.0);
        this.maxForce = 0.35;
        this.r_pourDessin = random(5, 8);
        this.hp = 1;
        this.damage = 1;
        this.xpValue = 8;
        this.color = color(255, 180, 30);  // orange
        break;

      case "flanker":
        this.maxSpeed = random(3.5, 4.5);
        this.maxForce = 0.30;
        this.r_pourDessin = random(10, 14);
        this.hp = 2;
        this.damage = 2;
        this.xpValue = 12;
        this.color = color(180, 40, 220);  // violet
        this.flankAngle = random([-1, 1]) * random(PI / 3, PI / 2);
        break;

      case "tank":
        this.maxSpeed = random(1.8, 2.8);
        this.maxForce = 0.12;
        this.r_pourDessin = random(18, 24);
        this.hp = 6;
        this.damage = 3;
        this.xpValue = 25;
        this.color = color(80, 140, 80);   // vert militaire
        break;

      case "bomber":
        this.maxSpeed = random(3.0, 4.0);
        this.maxForce = 0.25;
        this.r_pourDessin = random(10, 14);
        this.hp = 2;
        this.damage = 1;
        this.xpValue = 15;
        this.color = color(255, 100, 0);   // orange vif
        this.fusePhase = random(TWO_PI);   // animation fusible
        break;

      case "shooter":
        this.maxSpeed = random(2.5, 3.5);
        this.maxForce = 0.18;
        this.r_pourDessin = random(12, 16);
        this.hp = 3;
        this.damage = 1;
        this.xpValue = 18;
        this.color = color(255, 50, 150);  // magenta
        this.shootCooldown = 0;
        this.shootInterval = floor(random(90, 150)); // 1.5-2.5s
        this.wantsToShoot = false;
        this.preferredDist = 200;
        break;

      case "teleporter":
        this.maxSpeed = random(3.0, 4.0);
        this.maxForce = 0.20;
        this.r_pourDessin = random(8, 11);
        this.hp = 2;
        this.damage = 2;
        this.xpValue = 20;
        this.color = color(0, 220, 220);   // cyan
        this.teleportCooldown = 0;
        this.teleportInterval = floor(random(120, 240)); // 2-4s entre téléportations
        this.teleportFlash = 0;            // animation flash
        break;

      default: // "normal"
        this.maxSpeed = random(3.2, 4.5);
        this.maxForce = 0.22;
        this.r_pourDessin = random(8, 13);
        this.hp = 1;
        this.damage = 1;
        this.xpValue = 5;
        this.color = color(220, random(40, 80), random(40, 80));  // rouge
        break;
    }

    this.r = this.r_pourDessin * 2.5;
    this.largeurZoneEvitementDevantVaisseau = this.r_pourDessin;

    // Poids — modifiables en temps réel via GameManager.seekWeight / separationWeight
    this.seekWeight = 1.0;
    this.separationWeight = 2.5;
    this.avoidWeight = 3;
    this.boundariesWeight = 5;

    // Animation
    this.pulsePhase = random(TWO_PI);

    // Vitesse initiale
    this.vel = p5.Vector.random2D().mult(random(1.0, 2.5));
  }

  /**
   * @param {Vehicle}   player     Le joueur
   * @param {Enemy[]}   enemies    Tous les ennemis (pour la séparation)
   * @param {Obstacle[]} obstacles
   */
  applyBehaviors(player, enemies, obstacles) {
    if (!this.alive) return;

    let distToPlayer = p5.Vector.dist(this.pos, player.pos);

    // ── Téléporter : logique de blink ──
    if (this.type === "teleporter") {
      this.teleportCooldown++;
      if (this.teleportCooldown >= this.teleportInterval) {
        this.teleportCooldown = 0;
        this.teleportInterval = floor(random(100, 200));
        // Téléportation vers une position aléatoire proche du joueur
        let angle = random(TWO_PI);
        let dist = random(100, 250);
        let newX = player.pos.x + cos(angle) * dist;
        let newY = player.pos.y + sin(angle) * dist;
        // Clamper dans le canvas
        newX = constrain(newX, 40, width - 40);
        newY = constrain(newY, 40, height - 40);
        this.pos.set(newX, newY);
        this.teleportFlash = 20; // 20 frames de flash
        this.vel.mult(0.2); // reset vélocité après téléport
      }
      if (this.teleportFlash > 0) this.teleportFlash--;
    }

    // 1) Comportement offensif selon le type
    let attackForce;
    switch (this.type) {
      case "fast":
        // Pursue = anticipe la position du joueur
        attackForce = this.pursue(player);
        if (distToPlayer < 150) {
          attackForce.mult(2.0);
        }
        break;

      case "flanker":
        // Calcule un point décalé sur le côté du joueur
        let toPlayer = p5.Vector.sub(player.pos, this.pos);
        let flankTarget = player.pos.copy();
        if (distToPlayer > 120) {
          let perp = toPlayer.copy().rotate(this.flankAngle);
          perp.setMag(80);
          flankTarget = p5.Vector.add(player.pos, perp);
        }
        attackForce = this.seek(flankTarget);
        if (distToPlayer < 80) {
          attackForce = this.seek(player.pos);
          attackForce.mult(1.8);
        }
        break;

      case "tank":
        // Seek lent mais implacable — arrive() pour ne pas dépasser
        attackForce = this.arrive(player.pos);
        attackForce.mult(1.5); // force constante
        break;

      case "bomber":
        // Pursue rapide — fonce vers le joueur pour exploser au contact
        attackForce = this.pursue(player);
        if (distToPlayer < 100) {
          attackForce.mult(2.5); // sprint suicidaire
        }
        break;

      case "shooter":
        // Garde ses distances : fuit si trop près, seek si trop loin, strafe sinon
        if (distToPlayer < 130) {
          attackForce = this.flee(player.pos);
          attackForce.mult(2.0);
        } else if (distToPlayer > 300) {
          attackForce = this.seek(player.pos);
        } else {
          // Strafe/orbite autour du joueur
          let toP = p5.Vector.sub(player.pos, this.pos);
          let perpAngle = toP.heading() + HALF_PI;
          attackForce = createVector(cos(perpAngle), sin(perpAngle));
          attackForce.setMag(this.maxForce);
        }
        // Tir périodique : set wantsToShoot flag (handled by GameManager)
        this.shootCooldown++;
        if (this.shootCooldown >= this.shootInterval && distToPlayer < 400) {
          this.shootCooldown = 0;
          this.wantsToShoot = true;
        }
        break;

      case "teleporter":
        // Seek normal après téléportation
        attackForce = this.seek(player.pos);
        if (distToPlayer < 120) {
          attackForce.mult(1.6);
        }
        break;

      default: // "normal"
        attackForce = this.seek(player.pos);
        if (distToPlayer < 200) {
          attackForce.mult(1.4);
        }
        break;
    }
    attackForce.mult(this.seekWeight);
    this.applyForce(attackForce);

    // 2) Separation entre ennemis (CRUCIAL pour l'effet de masse)
    let sepForce = this.separate(enemies);
    sepForce.mult(this.separationWeight);
    this.applyForce(sepForce);

    // 3) Avoid obstacles
    let avoidForce = this.avoid(obstacles);
    avoidForce.mult(this.avoidWeight);
    this.applyForce(avoidForce);

    // 4) Boundaries
    let boundForce = this.boundaries(0, 0, width, height, 20);
    boundForce.mult(this.boundariesWeight);
    this.applyForce(boundForce);
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  // ─── DESSIN ──────────────────────────────────────────────
  show() {
    if (!this.alive) return;

    this.pulsePhase += 0.06;
    let pulse = 1 + sin(this.pulsePhase) * 0.08;
    let sz = this.r_pourDessin * pulse;

    // ── Teleporter flash effect ──
    if (this.type === "teleporter" && this.teleportFlash > 0) {
      push();
      noStroke();
      let flashAlpha = map(this.teleportFlash, 0, 20, 0, 200);
      fill(0, 255, 255, flashAlpha);
      ellipse(this.pos.x, this.pos.y, sz * 6);
      fill(255, 255, 255, flashAlpha * 0.5);
      ellipse(this.pos.x, this.pos.y, sz * 3);
      pop();
    }

    push();
    translate(this.pos.x, this.pos.y);
    let angle = this.vel.heading();
    rotate(angle);

    // Glow menace (couleur selon type)
    noStroke();
    switch (this.type) {
      case "fast":       fill(255, 180, 30, 25); break;
      case "flanker":    fill(180, 40, 220, 25); break;
      case "tank":       fill(80, 180, 80, 30); break;
      case "bomber":     fill(255, 120, 0, 35); break;
      case "shooter":    fill(255, 50, 150, 25); break;
      case "teleporter": fill(0, 255, 255, 25); break;
      default:           fill(255, 40, 40, 20); break;
    }
    ellipse(0, 0, sz * 4);

    // Corps selon le type
    strokeWeight(1.5);
    fill(this.color);

    switch (this.type) {
      case "fast":
        // Flèche fine = rapide
        stroke(200, 140, 0);
        triangle(-sz * 0.7, -sz * 0.4, -sz * 0.7, sz * 0.4, sz * 1.3, 0);
        break;

      case "flanker":
        // Losange = sournois
        stroke(130, 20, 180);
        quad(-sz, 0, 0, -sz * 0.7, sz * 1.1, 0, 0, sz * 0.7);
        break;

      case "tank":
        // Hexagone épais = blindé
        stroke(40, 100, 40);
        strokeWeight(3);
        beginShape();
        for (let a = 0; a < TWO_PI; a += TWO_PI / 6) {
          vertex(cos(a) * sz, sin(a) * sz);
        }
        endShape(CLOSE);
        // Bouclier intérieur
        noStroke();
        fill(100, 180, 100, 80);
        ellipse(0, 0, sz * 1.2);
        // Canon court
        fill(60, 100, 60);
        rect(sz * 0.3, -sz * 0.15, sz * 0.6, sz * 0.3, 2);
        break;

      case "shooter":
        // Pentagone avec canon = tireur
        stroke(200, 30, 120);
        beginShape();
        for (let a = 0; a < TWO_PI; a += TWO_PI / 5) {
          vertex(cos(a) * sz, sin(a) * sz);
        }
        endShape(CLOSE);
        // Canon long
        fill(255, 80, 180);
        noStroke();
        rect(sz * 0.3, -sz * 0.12, sz * 1.0, sz * 0.24, 2);
        // Indicator quand prêt à tirer
        if (this.shootCooldown > this.shootInterval * 0.7) {
          noFill();
          stroke(255, 100, 200, 150);
          strokeWeight(1.5);
          ellipse(0, 0, sz * 3);
        }
        break;

      case "bomber":
        // Cercle avec mèche = bombe
        stroke(200, 60, 0);
        strokeWeight(2);
        ellipse(0, 0, sz * 2);
        // Mèche animée
        noFill();
        stroke(255, 200, 50);
        strokeWeight(2);
        if (this.fusePhase !== undefined) this.fusePhase += 0.12;
        let fuseGlow = abs(sin(this.fusePhase || 0));
        stroke(255, 200 * fuseGlow, 50 * fuseGlow);
        line(sz * 0.6, -sz * 0.3, sz * 1.0, -sz * 0.8);
        // Étincelle au bout de la mèche
        noStroke();
        fill(255, 255, 100, 150 + fuseGlow * 100);
        ellipse(sz * 1.0, -sz * 0.8, sz * 0.4 + fuseGlow * sz * 0.3);
        // Symbole danger
        fill(255, 220, 50);
        textAlign(CENTER, CENTER);
        textSize(sz * 0.8);
        text("💣", 0, 0);
        break;

      case "teleporter":
        // Forme en X / étoile = instable
        stroke(0, 180, 180);
        strokeWeight(2);
        // Corps triangulaire translucide
        let tAlpha = this.teleportFlash > 0 ? 100 : 200;
        fill(0, 220, 220, tAlpha);
        beginShape();
        for (let a = 0; a < TWO_PI; a += TWO_PI / 5) {
          let outerR = sz * (a % (TWO_PI / 2.5) < TWO_PI / 5 ? 1.1 : 0.5);
          vertex(cos(a) * outerR, sin(a) * outerR);
        }
        endShape(CLOSE);
        // Anneau de téléportation
        noFill();
        stroke(0, 255, 255, 100 + sin(this.pulsePhase * 2) * 80);
        strokeWeight(1);
        ellipse(0, 0, sz * 2.5);
        ellipse(0, 0, sz * 1.5);
        break;

      default:
        // Triangle standard
        stroke(180, 30, 30);
        triangle(-sz, -sz * 0.65, -sz, sz * 0.65, sz * 1.1, 0);
        break;
    }

    // Oeil (sauf bomber qui a l'emoji)
    if (this.type !== "bomber") {
      fill(255, 220, 50);
      noStroke();
      ellipse(sz * 0.15, 0, sz * 0.45);
      fill(0);
      ellipse(sz * 0.25, 0, sz * 0.2);
    }

    // HP bar si hp > 1
    if (this.hp > 1) {
      pop();
      push();
      let barW = this.r_pourDessin * 2.5;
      let barH = 4;
      let bx = this.pos.x - barW / 2;
      let by = this.pos.y - this.r_pourDessin - 10;
      noStroke();
      fill(40, 40, 40, 200);
      rect(bx - 1, by - 1, barW + 2, barH + 2, 2);
      // Couleur de la barre selon le type
      let barColor;
      switch (this.type) {
        case "tank":       barColor = color(80, 200, 80); break;
        case "bomber":     barColor = color(255, 140, 30); break;
        case "shooter":    barColor = color(255, 80, 180); break;
        case "teleporter": barColor = color(0, 220, 220); break;
        case "flanker":    barColor = color(180, 80, 255); break;
        default:           barColor = color(255, 80, 80); break;
      }
      fill(barColor);
      // Base HP for ratio calculation
      let baseHp;
      switch (this.type) {
        case "tank": baseHp = 6; break;
        case "flanker": baseHp = 2; break;
        case "bomber": baseHp = 2; break;
        case "shooter": baseHp = 3; break;
        case "teleporter": baseHp = 2; break;
        default: baseHp = 1; break;
      }
      let maxHp = max(baseHp, this.hp);
      rect(bx, by, barW * (this.hp / maxHp), barH, 2);
      pop();
      return;
    }

    pop();

    // Debug
    if (Vehicle.debug) {
      push();
      noFill();
      stroke(255, 60, 60, 60);
      ellipse(this.pos.x, this.pos.y, this.r * 2);
      this.drawVector(this.pos, p5.Vector.mult(this.vel, 10), color(255, 80, 80));
      // Show type label
      fill(255);
      noStroke();
      textSize(9);
      textAlign(CENTER);
      text(this.type.toUpperCase(), this.pos.x, this.pos.y - this.r_pourDessin - 14);
      pop();
    }
  }
}
