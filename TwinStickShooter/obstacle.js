/**
 * Obstacle — Cercle statique héritant de Vehicle (maxSpeed=0).
 * Partage l'interface Vehicle pour une hiérarchie unifiée.
 * Basé sur le cours (6-ObstacleAvoidance/obstacle.js).
 */
class Obstacle extends Vehicle {
  constructor(x, y, r, couleur) {
    super(x, y);
    this.r = r;
    this.r_pourDessin = r;
    this.maxSpeed = 0;
    this.maxForce = 0;
    this.color = couleur || color(60, 70, 90, 200);
    this.alive = true;
  }

  show() {
    push();
    // Ombre
    noStroke();
    fill(0, 40);
    ellipse(this.pos.x + 3, this.pos.y + 3, this.r * 2);
    // Corps
    fill(this.color);
    stroke(80, 100, 130);
    strokeWeight(2);
    ellipse(this.pos.x, this.pos.y, this.r * 2);
    // Reflet
    noStroke();
    fill(255, 25);
    ellipse(this.pos.x - this.r * 0.2, this.pos.y - this.r * 0.2, this.r * 0.8);
    pop();
  }

  contains(point) {
    return p5.Vector.dist(point, this.pos) < this.r;
  }
}
