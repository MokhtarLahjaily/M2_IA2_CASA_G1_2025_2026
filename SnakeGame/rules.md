# 🐍 SnakeEvolved — Règles & Documentation Technique

## Concept

**SnakeEvolved** est un jeu de serpent compétitif inspiré de **Snake.io**, construit intégralement avec les **Steering Behaviors de Craig Reynolds**.

Le serpent du joueur est composé de **véhicules autonomes chaînés** suivant le principe du **Leader Following** (page 50 du PDF de cours) :
- La **tête** est un `Vehicle` qui utilise `arrive()` vers la position de la souris (mode joueur) ou une IA autonome (mode Watch).
- Chaque **segment du corps** est un `Vehicle` indépendant qui utilise `arrive()` sur le segment précédent, créant un mouvement fluide et organique de suivi en chaîne.

Le joueur affronte **6 serpents rivaux autonomes** (`SnakeRival`) dotés d'une IA complète, des **proies** qui fuient, des **boids ennemis** en flocking, et des **obstacles statiques et mobiles**.

---

## Contrôles

### Mode Jeu (PLAY)

| Touche / Action | Effet |
|---|---|
| **Souris** | Dirige la tête du serpent (la tête utilise `arrive()` vers le curseur) |
| **Clic gauche** (maintenir) | **Dash** — Accélération temporaire (consomme des segments du corps) |
| **Relâcher le clic** | Arrête le dash |
| **P** / **Echap** | **Pause** — Met le jeu en pause (affiche un overlay avec Resume, Restart, Menu) |
| **D** | Active/désactive le **mode Debug** (affiche les vecteurs de force, rayons de perception, FPS) |
| **R** | Redémarrer la partie |
| **M** | Retour au menu principal |
| **W** | Basculer en mode **Watch AI** (l'IA prend le contrôle) |
| **O** (mode Debug) | Place un obstacle à la position de la souris |

### Mode Watch AI (SPECTATEUR)

| Touche | Effet |
|---|---|
| **ENTER** | Reprendre le contrôle du serpent (quitter le mode Watch) |
| **P** / **Echap** | Pause |
| **D** | Mode Debug |
| **M** | Menu |

### Menu Principal

| Touche / Action | Effet |
|---|---|
| **Clavier** | Saisir le nom du joueur |
| **Backspace** | Effacer un caractère du nom |
| **ENTER** | Lancer le mode PLAY |
| **W** | Lancer le mode WATCH AI (si le champ nom est vide) |
| **Clic** sur les cercles colorés | Choisir le skin du serpent (8 couleurs disponibles) |
| **Clic** sur ▶ PLAY | Lancer la partie |
| **Clic** sur 👁 WATCH AI | Observer l'IA jouer |

### Contrôles Tactiles (Mobile)

| Geste | Effet |
|---|---|
| **Toucher / Glisser** | Dirige le serpent vers le point touché |
| **Swipe rapide** (> 80px) | Déclenche le Dash |

---

## Comportements IA Utilisés

### 🧠 Serpent du Joueur (`Snake` — snake.js)

| Comportement | Utilisation |
|---|---|
| **Arrive** | La tête arrive vers la souris ; chaque segment arrive vers le précédent (**Leader Following**) |
| **Avoid** | La tête évite les obstacles (statiques et mobiles) |
| **Boundaries** | Force de répulsion aux bords du canvas |
| **Dash** | Boost de vitesse temporaire qui consomme des segments (les segments perdus deviennent de la nourriture) |

### 🤖 IA Auto-Play (`Snake.updateAutoPlay`)

En mode Watch, le serpent du joueur utilise l'intégralité des comportements de Craig Reynolds :

| Comportement | Utilisation |
|---|---|
| **Seek** | Cherche la proie/nourriture la plus proche |
| **Wander** | Exploration quand aucune cible en vue |
| **Flee** | Fuit les serpents rivaux plus gros |
| **Evade** | Anticipe la trajectoire des menaces pour les éviter |
| **Pursue** | Chasse les rivaux plus petits |
| **Avoid** | Contourne les obstacles |
| **Boundaries** | Reste dans le canvas |

### 🐉 Serpents Rivaux (`SnakeRival` — snakeRival.js)

Chaque rival possède un **niveau de compétence** (`skillLevel` 0.0→1.0) qui influence tous ses paramètres :

| Comportement | Détail |
|---|---|
| **Wander** | Exploration avec des paramètres variables selon le skill |
| **Seek** | Cherche les proies dans un rayon de perception (200→400px selon skill) |
| **Pursue** | Chasse les serpents plus petits (agressivité variable) |
| **Flee** | Fuit les serpents plus gros (détection à 120→200px selon skill) |
| **Avoid** | Contourne les obstacles (zone d'évitement 1.5x→3x selon skill) |
| **Boundaries** | Reste dans les limites |
| **Arrive** | Chaque segment du corps suit le précédent |
| **Separation** | Évite les corps des autres serpents |

Les rivaux possèdent aussi un **Dash IA** : ils sprintent pour couper la route des cibles ou fuir.

### 👾 Boids Ennemis (`EnemyBoid` — enemyBoid.js)

Implémentation complète de l'**algorithme de Flocking** de Reynolds :

| Comportement | Poids |
|---|---|
| **Alignment** | 1.5 — S'aligner avec les voisins |
| **Cohesion** | 1.0 — Se rapprocher du centre du groupe |
| **Separation** | 2.0 — Éviter le chevauchement |
| **Flee** | 4.0 — Fuir la tête du joueur et des rivaux |
| **Wander** | 0.3 — Mouvement organique en l'absence de menace |
| **Avoid** | 3.0 — Contourner les obstacles |
| **Boundaries** | 10.0 — Rester dans le canvas |

### 🦋 Proies (`Prey`, `BonusPrey`, `PoisonPrey`, `FleeingPrey` — prey.js)

| Comportement | Détail |
|---|---|
| **Wander** | Mouvement d'exploration naturel |
| **Evade** | Anticipe et fuit la tête de serpent la plus proche |
| **Avoid** | Contourne les obstacles |
| **Boundaries** | Reste dans le canvas |
| **Separation** | Répulsion physique des corps de serpents |

### 🪨 Obstacles Mobiles (`MovingObstacle` — movingObstacle.js)

| Comportement | Détail |
|---|---|
| **Wander** | Mouvement lent et organique |
| **Boundaries** | Reste dans le canvas |
| **Separation** | Évite les autres obstacles (statiques et mobiles) |

---

## Entités & Mécaniques de Jeu

| Entité | Description |
|---|---|
| 🟢 **Proie normale** | 10 points, fuit les serpents |
| 🟡 **Proie dorée (Bonus)** | 30 points, plus grosse, miroitante |
| ☠️ **Proie poison** | 0 points, réduit la taille de 3 segments |
| 🔵 **Proie fuyante** | 20 points, très rapide, difficile à attraper |
| 💀 **Nourriture (segments morts)** | 5 points, reste des serpents tués |
| 🛡️ **Power-up Bouclier** | Invincibilité temporaire (5 secondes) |
| ⚡ **Power-up Vitesse** | Boost de vitesse (5 secondes) |
| ✨ **Power-up Multiplicateur** | Score x2 (8 secondes) |

### Système de Collision Snake.io

- **Tête du joueur → Corps d'un rival** : le joueur meurt (Game Over). Dans Snake.io, foncer dans le corps d'un autre serpent est fatal.
- **Tête d'un rival → Corps du joueur** : le rival meurt, ses segments deviennent de la nourriture (+50 pts). C'est la stratégie clé : forcer les rivaux à percuter votre corps.
- **Tête contre tête** : le plus long survit. Si tailles égales, les deux meurent.
- **Auto-collision** : le joueur meurt s'il touche son propre corps.

---

## Difficulté Progressive

| Score | Événement |
|---|---|
| 0 → 100 | Difficulté faible, peu d'ennemis |
| 100+ | Plus de boids ennemis |
| 250+ | Rivaux plus agressifs |
| 500+ | Obstacles mobiles apparaissent |
| 1000+ | Difficulté maximale approche |
| 2000+ | Plafond de difficulté |
