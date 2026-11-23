# 🚀 NEON STRIKE — 10-Stage Space Shooter // Rakesh Biswal

A high-energy, responsive neon space-shooter arcade game crafted for the **Rakesh Biswal (`RakeshBiswal-6`)** portfolio.

Live Demo: [https://rakeshbiswal-6.github.io/neon-space-shooter/](https://rakeshbiswal-6.github.io/neon-space-shooter/)

---

## 🎮 Key Features & Gameplay Upgrades

- **🛡️ 3-Life Hull System**:
  - The hero spaceship starts with **3 Hull Lives** (`♥ ♥ ♥`).
  - **Life Loss Trigger**: Getting hit by alien bullets or colliding directly with an alien ship deducts 1 life.
  - **Invulnerability Shield**: 1.5-second energy forcefield upon taking damage to prevent instant combo-wipes.
  - **Hero Destruction**: When all 3 lives are lost, the hero starfighter explodes with a dramatic multi-stage detonation, screen shake, and Game Over mission debrief.
  - Note: Aliens reaching the bottom of the screen despawn and do *not* deduct lives.

- **🌌 10 Distinct Stages**:
  - **Stages 1 – 9**: Battle through escalating alien fleets (Scouts, High-Speed Interceptors, Zigzag Strikers, Heavy Cruisers, Bombers, and Cloaked Stealth Phantoms).
  - Clear quota of enemies in each stage to advance, accompanied by neon sector banners and bonus points.
  - **Stage 10: THE MEGA BOSS ("CYBER-COLOSSUS // DREAD MOTHERSHIP")**:
    - Epic red alert siren warning!
    - Massive 240px wide alien battleship with animated core reactor, pulsing wings, and turrets.
    - Real-time **Boss HP Bar** with live percentage.
    - **Multi-phase boss attack patterns**: Dual wing plasma cannons, 5-way spread ion lasers, escort drone reinforcements, and <35% HP Enraged Overdrive.
    - Defeating the Mega Boss triggers the **GALAXY SAVED // VICTORY** celebration screen!

- **⚡ Power-Up Capsules**:
  - 💚 **Hull Repair**: Restores +1 lost life (up to max 3).
  - ⚡ **Triple Laser**: Equips a 3-way spreading laser blast for 12 seconds.
  - 🔥 **Rapid Overdrive**: Supercharges firing rate for 9 seconds.

- **🔊 Procedural Web Audio Synth**:
  - Zero external MP3/WAV assets needed! Built-in audio synthesizer for lasers, explosions, boss klaxons, powerups, and victory fanfares.
  - Mute/Unmute toggle button (and `S` key).

---

## 🕹️ Controls

- **Move**: `←` / `→` or `A` / `D`
- **Fire Laser**: `Spacebar` (Hold for continuous fire)
- **Pause / Resume**: `P`
- **Toggle Sound**: `S` (or Sound button)
- **Start / Restart**: `Enter` or on-screen button
- **Mobile Devices**: On-screen touch buttons for Left, Right, and FIRE.

---

## 📂 Project Structure

- `index.html` — Semantic HUD, canvas container, modal overlays & retro styling
- `styles.css` — Cyberpunk neon aesthetic, glowing animations, and mobile responsive layout
- `game.js` — Complete game engine (10 stages, collision physics, Mega Boss AI, particle FX, Web Audio synth)
- `README.md` — Project documentation and setup guide
