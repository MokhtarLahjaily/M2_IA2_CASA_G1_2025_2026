/**
 * Obstacle — Cercle statique que les agents doivent éviter.
 * Basé sur l'implémentation du cours (obstacle.js de 6-ObstacleAvoidance).
 */
class Obstacle {
  constructor(x, y, r, couleur = "rgba(255,100,100,0.4)") {
    this.pos = createVector(x, y);
    this.r = r;
    this.color = couleur;
  }

  show() {
    push();
    fill(this.color);
    stroke(0);
    strokeWeight(3);
    ellipse(this.pos.x, this.pos.y, this.r * 2);
    // point central
    fill(0);
    noStroke();
    ellipse(this.pos.x, this.pos.y, 6);
    pop();
  }

  /**
   * Vérifie si un point (p5.Vector) est à l'intérieur de l'obstacle.
   */
  contains(point) {
    return p5.Vector.dist(point, this.pos) < this.r;
  }
}
