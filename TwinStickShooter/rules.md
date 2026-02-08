# 🎯 TwinStickShooter — Règles & Documentation Technique

## Concept

**TwinStickShooter** est un jeu de survie de type **Vampire Survivors** où le joueur affronte des **hordes d'ennemis** utilisant des **comportements de foule (Flocking & Steering Behaviors)** de Craig Reynolds.

Le joueur contrôle un vaisseau hexagonal au clavier et tire des **projectiles intelligents** qui sont eux-mêmes des **véhicules autonomes** utilisant `seek()` et `pursue()` pour traquer les ennemis. Les ennemis arrivent par vagues progressives avec **7 types différents**, chacun avec un comportement IA distinct.

Le jeu propose des **sliders HTML en temps réel** pour ajuster les poids des comportements (Seek, Separation, Avoid) et observer leur effet sur le comportement de la horde.

---

## Contrôles

### Déplacement

| Touche | Effet |
|---|---|
| **Z** / **W** / **↑** | Se déplacer vers le haut |
| **S** / **↓** | Se déplacer vers le bas |
| **Q** / **A** / **←** | Se déplacer vers la gauche |
| **D** / **→** | Se déplacer vers la droite |

> Les directions sont combinables (diagonales).

### Actions

| Touche | Effet |
|---|---|
| **Espace** (maintenir) | **Tirer** — Projectiles intelligents dans la direction du mouvement |
| **Shift + D** (Maj.) | Active/désactive le **mode Debug** (vecteurs de force, rayons de perception, FPS) |
| **P** | **Pause** / Reprendre |
| **R** | **Redémarrer** la partie |
| **ENTER** | Démarrer depuis le menu |
| **M** | Retour au **menu** (depuis Game Over) |

> **Note** : Le tir est **directionnel** — les projectiles partent dans la direction du dernier mouvement du joueur. Pour viser à droite, il faut se déplacer vers la droite.

### Sliders de Réglage (en bas à gauche)

Trois sliders HTML permettent de modifier les poids en **temps réel** pendant la partie :

| Slider | Plage | Effet |
|---|---|---|
| ⚔️ **Seek Weight** | 0 → 5 | Intensité de l'attraction des ennemis vers le joueur |
| ↔️ **Separation Weight** | 0 → 8 | Espacement entre ennemis (évite le chevauchement) |
| 🚧 **Avoid Weight** | 0 → 8 | Force de contournement des obstacles |

---

## Types d'Ennemis

### 7 types avec comportements IA distincts

| Type | Apparition | Comportement | Vitesse | HP | Points |
|---|---|---|---|---|---|
| 🔴 **Normal** | Vague 1+ | `seek()` vers le joueur | Moyenne | 1 | 5 |
| 🟠 **Fast** | Vague 3+ | `pursue()` — anticipe la position du joueur | Très rapide | 1 | 8 |
| 🟣 **Flanker** | Vague 3+ | Contourne par les côtés (calcul d'angle perpendiculaire) puis `seek()` au corps-à-corps | Moyenne | 2 | 12 |
| 🟢 **Tank** | Vague 5+ | `arrive()` — lent mais implacable, forte HP | Lente | 6 | 25 |
| 🟧 **Bomber** | Vague 7+ | `pursue()` sprint suicidaire — **explose en mourant** (dégâts de zone) | Moyenne | 2 | 15 |
| 🩷 **Shooter** | Vague 8+ | Garde ses distances (`flee` si trop près, strafe sinon) — tire des **projectiles chercheurs** | Moyenne | 3 | 18 |
| 🩵 **Teleporter** | Vague 9+ | Se **téléporte** aléatoirement près du joueur, puis `seek()` | Moyenne | 2 | 20 |

> **Vague 12+** : Plus aucun ennemi "normal" — uniquement des types avancés.

### Comportements Communs à Tous les Ennemis

| Comportement | Poids par défaut | Détail |
|---|---|---|
| **Seek / Pursue** | 1.0 (slider) | Attaque vers le joueur |
| **Separation** | 2.5 (slider) | Espacement entre ennemis — crée un effet de masse naturel sans chevauchement |
| **Avoid** | 3.0 (slider) | Contournement fluide des obstacles (statiques + mobiles) |
| **Boundaries** | 5.0 | Rester dans le canvas |

---

## Projectiles du Joueur (Véhicules Autonomes)

Les projectiles ne sont **pas de simples points balistiques** — ce sont de **vrais `Vehicle`** avec des steering behaviors :

| Comportement | Détail |
|---|---|
| **Seek** | Cherche l'ennemi vivant le plus proche |
| **Pursue** | Anticipe la trajectoire de l'ennemi si < 300px |
| **Avoid** | Contourne les obstacles sur le chemin |

Les projectiles s'améliorent avec le **niveau du joueur** (vitesse, dégâts, force de guidage).

Le joueur peut débloquer le **multi-tir** (jusqu'à 7 lignes en spread) via les tokens `MultiShot`.

---

## Projectiles Ennemis (`EnemyProjectile`)

Tirés par les ennemis de type **Shooter** (vague 8+) :

| Comportement | Détail |
|---|---|
| **Seek** | Guidage intelligent vers le joueur (**homing missile**) |
| **Avoid** | Contourne les obstacles |

Les projectiles ennemis sont plus lents mais persistants grâce au seeking continu.

---

## Obstacles

### Obstacles Statiques (`Obstacle`)
- Cercles placés aléatoirement, que tous les agents doivent contourner via `avoid()`.
- Apparaissent et disparaissent dynamiquement pour varier le terrain.

### Obstacles Mobiles (`MovingObstacle` — vague 4+)

Véhicules autonomes utilisant :

| Comportement | Détail |
|---|---|
| **Wander** | Mouvement organique et lent |
| **Boundaries** | Reste dans le canvas |
| **Separation** | Évite les autres obstacles |

---

## Power-Ups & Collectibles

| Item | Effet | Spawn |
|---|---|---|
| ❤️ **Health Pickup** | Restaure des points de vie | ~6.7s |
| ⚡ **Fire Rate Token** | Augmente la cadence de tir | ~10s |
| 🔫 **Multi-Shot Token** | Ajoute une ligne de tir (max 7) | ~13s |
| 🛡️ **Shield Power-Up** | Bouclier temporaire (absorbe les dégâts) | ~20s |
| 💨 **Speed Boost Token** | Augmente la vitesse de déplacement | ~17s |

---

## Système de Progression

### XP & Niveaux

Le joueur gagne de l'**XP** en tuant des ennemis. À chaque niveau :
- **+2 HP max** et soins de 2 HP
- **Cadence de tir** améliorée (tous les 2 niveaux)
- **Projectiles** plus rapides, plus forts, plus agiles

### Vagues de Difficulté

Toutes les **~10 secondes**, une nouvelle vague commence :
- Plus d'ennemis par vague
- Intervalles de spawn réduits
- Types d'ennemis plus variés et dangereux
- Obstacles mobiles à partir de la vague 4
- Les ennemis "normaux" disparaissent à la vague 12

---

## Architecture Technique

```
Vehicle (classe de base — steering behaviors)
├── Player          → Contrôle clavier + avoid + boundaries
├── Enemy           → 7 types (seek/pursue/flee/arrive/avoid/separate)
├── Projectile      → seek + pursue + avoid (véhicule-missile joueur)
├── EnemyProjectile → seek + avoid (véhicule-missile ennemi)
├── MovingObstacle  → wander + boundaries + separate
└── Obstacle        → Statique (pas de Vehicle)

GameManager         → Spawning, collisions, vagues, sliders, score
```
