# GAME DESIGN DOCUMENT (GDD)
## Project Title: **Grand Theft Vibe: 5 Chapters of Chaos** *(Working Title)*
**Tagline:** *"Мы просто вайбим пацаны. Веб-игра под GTA."*
**Genre:** 3D / 2.5D Open-World Action-Driving Parody
**Platform:** Desktop Web Browser (WebGL2 / Three.js)
**Target Scope:** Hackathon MVP (5 Playable Story Chapters + Free-Roam City Hub)

---

## 1. Vision, Tone & Core Pillars

### 1.1 High Concept
A fast-paced, satirical browser GTA game that distills the most legendary missions and internet memes from *GTA V*, *GTA: San Andreas*, and *GTA: Vice City* into **5 punchy, comedic story chapters**. Built on a unified 3D WebGL world with an instant **GTA V Sky-Cam toggle** into an **Isometric 2.5D mode (Plan-B / Chinatown Wars style)**.

### 1.2 Goals & Non-Goals
* **Goals:**
  * Deliver 5 recognizable, hilarious, and mechanically varied GTA chapters playable directly in a desktop browser at 60 FPS.
  * Nail the unmistakable audiovisual "Rockstar HUD & UI grammar" (`WASTED`, `MISSION PASSED`, tilted radar with GPS lines, Wanted stars, Weapon/Radio wheels, driving banter subtitles).
  * Guarantee zero architectural dead-ends via a unified 3D + Isometric 2.5D camera rig.
* **Non-Goals / Anti-Goals:**
  * Not a photorealistic 100GB open-world simulator—assets are stylized low-poly/arcade to maximize physics chaos and browser performance.
  * No unskippable 5-minute passive cutscenes—all memes and narrative beats happen interactively or while driving.

### 1.3 Core Design Pillars
1. **Unmistakable GTA DNA:** Even with stylized low-poly visuals, the game instantly *feels* like GTA through its signature UI grammar, weighted arcade drifting physics, carjacking loop (`F`), and satirical radio stations.
2. **Playable Memes, Not Just Cutscenes:** Iconic GTA memes (*"You forget a thousand things every day"*, *"Yee-yee ass haircut"*, *"Two number 9s / Follow the damn train"*, *Vice City RC Helicopter trauma*, *"Ah shit, here we go again"*, `HESOYAM`) are turned into active gameplay mechanics.
3. **Bulletproof 3D + Isometric Plan-B Architecture:** A single 3D scene and physics world powers both the 3D Third-Person Chase Camera and the 2.5D Orthographic Isometric Camera. Flipping between them takes one keypress (`V`), ensuring the project cannot fail on 3D camera or performance issues.

---

## 2. Unique GTA Style & Signature Systems

### 2.1 The "Rockstar" HUD & UI Grammar
* **Bottom-Left Radar / Minimap:**
  * Rectangular 16:9 box (tilted into a 3D GPS perspective in 3D driving mode, flat top-down in on-foot/isometric mode).
  * Flush bottom status bars: **Green (Health 50%)**, **Blue (Armor 25%)**, **Yellow (Special Ability / Meme Meter 25%)**. When health drops below 25%, the green bar pulses red.
  * **Color-Coded Blips & GPS Route Line:**
    * **Yellow Line & Blip:** Active mission destination / objective.
    * **Purple Line:** Custom player waypoint.
    * **Blue Blip:** Friendly vehicle or ally (Lamar, Big Smoke, Trevor).
    * **Red Blip:** Hostile enemies / targets.
    * **Flashing Red/Blue Vision Cones:** Police directional search cones during a Wanted state.
* **Top-Right Status Readout:**
  * **Wanted Stars (1 to 5 Stars):** Empty stars are translucent silhouettes; active stars flash alternating red/blue during pursuit and blink white/gray when line-of-sight is broken.
  * **Cash Counter:** Green `$00000000` with animated `+$5,000` (green) or `-$100` (red) delta popups.
  * **Equipped Weapon Silhouette & Ammo (`Clip / Total`).**
* **Center Radial Overlays:**
  * **Weapon Wheel (`Hold Tab`) & Radio Wheel (`Hold Q`):** Drops game simulation speed to `0.2x`, applies a desaturated blue-gray vignette filter, and plays a muffled low-pass audio sweep over world audio.
* **Bottom-Center Dialogue Subtitles:**
  * GTA-style dialogue feeds during driving sequences, with character color-coding (Green for Franklin, Blue for Michael, Orange for Trevor, Yellow for Big Smoke) so exposition and roasting happen *while driving*, never halting pacing.

### 2.2 Iconic Screen States & Micro-Moments
* **`WASTED` / `BUSTED` Sequence (3.0s Choreography):**
  * `t = 0.0s`: Low-frequency bass thud (`BOOM-tss`), simulation slows to `0.2x`, camera detaches and rolls slowly toward the player ragdoll or arresting cop, screen desaturates with a red/blue vignette.
  * `t = 0.8s`: Crimson **`WASTED`** or police-blue **`BUSTED`** slams onto the center inside a semi-transparent black horizontal banner using *Pricedown* stencil typography.
  * `t = 3.0s`: Respawn at chapter checkpoint (or hospital with popup: *"American Healthcare System: Treated 47 gunshot wounds and a tank explosion for $100. You keep your rocket launcher."*).
* **`MISSION PASSED` Sequence:**
  * Golden *Pricedown* header: **`MISSION PASSED!`** followed by **`RESPECT +`** and a ticking cash reward counter, backed by the classic West Coast G-funk synth whistle or GTA V electronic swell, plus a 3-item comedic Gold Medal checklist.
* **GTA V "Sky-Cam" Camera/Character Switch (`Press V` or `Alt`):**
  * 3 stepped zoom-outs (`50m -> 150m -> 400m`) with capacitor-discharge flashes, scanline tint, and bass hits, panning across the map and slamming back down into the target character—or toggling live between **3D Third-Person** and **2.5D Isometric View**.

### 2.3 Satirical World & Parody Radio
* **In-World Parody Brands:** *Cluckin' Bell*, *Premium Deluxe Motorsport* (Simeon's 400% APR dealership), *Pay 'n' Spray*, *Bobcat Security*, *Richards Majestic Studio*, *Lifeinvader*, *iFruit Phone*.
* **3 Parody Radio Stations (Auto-play with Top-Center Station Popup on Vehicle Entry):**
  1. **West Coast Vibe FM:** G-funk synth loops + DJ roasting the player's driving skill.
  2. **Los Santos Meme Radio:** High-tempo Phonk / Eurobeat drift tracks for high-speed police chases.
  3. **Hustle & Subprime Talk Radio:** 20-second absurd satirical commercials (e.g., Simeon advertising subprime auto loans and accusing anyone who reads the contract of being a racist).

---

## 3. The 5 Story Chapters (Detailed Design)

| Chapter | Inspiration | Primary Gameplay Loop | Signature Mechanic | Ultimate Meme Payoff |
| :--- | :--- | :--- | :--- | :--- |
| **Ch. 1** | *GTA V: Prologue* | Hostage control -> Vault blast -> Blizzard shootout -> Icy getaway drive | **iFruit Phone Detonator**, **Sky-Cam Switch to Trevor**, **Ice Drift Physics** | *"You forget a thousand things every day..."* interrupted by Trevor + **Frozen PNG Alien** under bridge |
| **Ch. 2** | *GTA V: Franklin & Lamar* | Boost Red/White sports cars -> High-speed race -> Movie lot shortcut -> 2-Star escape | **Franklin's Slow-Mo Driving Focus**, **Vision-Cone Police Evasion**, **Roast Boss Bar** | Indestructible Lamar, Movie Lot Aliens, & **"Yee-Yee Ass Haircut" Self-Esteem Bar** |
| **Ch. 3** | *GTA SA: Drive-Thru* + *Wrong Side of the Tracks* | Fast-food mega-order minigame -> Sanchez dirtbike chase alongside freight train | **Firing Angle "Sweet Spot" Zone** (avoid train side-wall hitbox so Smoke hits the roof) | *"Two number 9s..."* (`14,500 kcal` suspension squash) & *"All we had to do was follow the damn train, CJ!"* |
| **Ch. 4** | *GTA VC: Demolition Man* + *GTA V: Complications* | RC Helicopter bomb drops on construction site -> Stealth SUV repo -> Dealership crash | **RC Rotor/Bomb Physics** + **No-Brakes Backseat Hijack** into destructible glass showroom | Hammer-wielding workers vs. toy chopper & crashing through Simeon's **"Employee of the Month"** wall |
| **Ch. 5** | *GTA SA Opening* + *5-Star Military Chase* + *Pay 'n' Spray* | Alleyway BMX cold open -> 5-Star Tank/SWAT gauntlet -> Pay 'n' Spray respray | **5-Star Escalation Spawner**, **Turret-Recoil Tank Boost**, **Live Keyboard Cheat Codes** | *"Ah shit, here we go again"*, `HESOYAM`, Army fooled by hot-pink paint, **`MISSION PASSED! RESPECT +`** |

---

### Chapter 1: "Cold Open & Frozen Aliens"
*(Based on GTA V — "Prologue", North Yankton)*
* **Setting:** Snowy small-town bank depot & icy rural highway leading to a railroad crossing.
* **Visual Palette:** Desaturated blizzard whites, cold slate blues, and stark crimson contrast on snow.
* **Step-by-Step Gameplay Flow:**
  1. **Hostage Intimidation:** Aim weapon (`RMB`) at terrified bank employees to herd them into the supply closet without shooting them (crowd control via aiming cone).
  2. **iFruit Phone Detonation & Cash Grab:** Open the on-screen cell phone HUD to trigger the thermite charge on the vault door, then run inside to bag `$179,000` (with a HUD note: *"Money you will definitely keep and not lose in 3 minutes"*).
  3. **The Guard Ambush & Character Switch Tutorial:** Exiting the vault, a security guard grabs Michael and pulls off his ski mask.
     * *Meme Hook:* Guard shouts *"I saw your face! I'll remember you!"* Michael starts an overly dramatic 3-paragraph action-movie monologue: *"You forget a thousand things every day, pal. Make sure this is one of 'em..."* while a giant flashing prompt appears: **`[PRESS ALT TO SWITCH TO TREVOR & SKIP MONOLOGUE WITH GUN]`**.
  4. **Blizzard Shootout:** Snap to cover behind pillars (`Q`), blast through waves of Ludendorff PD cruisers in the snowstorm, and push to the parked red getaway sedan.
  5. **Icy Getaway & The Frozen Alien Easter Egg:** Yeet out the local getaway driver (who immediately catches a stray bullet) and take the wheel on low-traction icy roads.
     * *Meme Hook:* Under the first small ice bridge is a glowing **Frozen PNG Alien** encased in ice. Looking or swerving toward it triggers an achievement popup: **`+50 Lore Discovered (Eyes on the Road!)`**.
  6. **Climax:** Try to beat a speeding freight train across the railroad crossing, get clipped in the rear fender, crash outside the barn, and cut to black -> *"9 Years Later: Los Santos"*.

---

### Chapter 2: "Red vs. White & The Yee-Yee Ass Haircut"
*(Based on GTA V — "Franklin and Lamar")*
* **Setting:** Sun-drenched beachfront mansion -> Downtown Los Santos -> Richards Majestic Movie Studio -> Multi-story parking garage -> Simeon's Dealership -> Franklin's driveway.
* **Step-by-Step Gameplay Flow:**
  1. **Choose Your Ride:** Walk up to two convertible sports cars in a beachfront driveway: the **White Obey 9F Cabrio** and the **Red Dewbauchee Rapid GT**. Press `F` to enter either one (and hold `H` to drop the convertible roof); Lamar immediately claims the other one is faster and peels out.
  2. **High-Speed Street Race Through Traffic:** Follow Lamar through busy urban intersections and construction jumps.
     * *Mechanic Introduced:* **Franklin's Special Ability ("Driving Focus" — `Shift` / `Caps Lock`)** slows simulation time to `0.4x` while boosting steering grip so the player can thread needle gaps through traffic at top speed.
     * *Meme Hook:* Lamar's AI car is programmed with `99,999 kg` mass ("Rubber-Band Bulldozer Mode"), launching civilian sedans into orbit on contact while Lamar casually complains over the radio that *you* are driving too slow.
  3. **Richards Majestic Movie Studio Shortcut:** Smash through the studio barrier right into a live sci-fi film shoot. Actors in low-budget cardboard space-alien and astronaut suits dive out of the way (incrementing a **`"CGI Budget Saved"`** bonus counter if clipped).
  4. **Parking Garage Jump & 2-Star Police Evasion:** Spiral up a multi-story concrete parking garage and launch off the roof ramp. A witness reports the crime, triggering a **2-Star Wanted Level**. Lamar ditches you, teaching the player to break line-of-sight and dodge the red/blue **LSPD Vision Cones** on the minimap.
  5. **The Finale — Lamar's Roast Boss Encounter:** Deliver the car to Simeon's dealership (where Simeon accuses you of racism if you question his 28% APR financing), then arrive at Franklin's driveway.
     * *Meme Hook:* As Lamar delivers the legendary roast (*"Maybe if you got rid of that old yee-yee ass haircut you got..."* -> *"♪ Niggaaaa... ♪"*), the HUD spawns a **`FRANKLIN'S SELF-ESTEEM BAR`** that drains with every syllable until it shatters at `0%`, unlocking a giant golden tutorial banner: **`[NEW OBJECTIVE UNLOCKED: VISIT BARBERSHOP TO FIX YEE-YEE ASS HAIRCUT]`**.

---

### Chapter 3: "Two Number 9s & The Damn Train"
*(Based on GTA: San Andreas — "Drive-Thru" + "Wrong Side of the Tracks")*
* **Setting:** Cluckin' Bell Drive-Thru lane -> Railway tracks, oncoming train crossings, and dirt ramps.
* **Step-by-Step Gameplay Flow:**
  1. **Phase 1 — The Cluckin' Bell Mega-Order Minigame:** Drive the bouncy lowrider (press `Space` to bounce hydraulics) into the glowing red Cluckin' Bell drive-thru corona marker.
     * *Meme Hook:* An interactive rapid-order rhythm/clicker minigame where Big Smoke orders his legendary meal:
       > *"I'll have two number 9s, a number 9 large, a number 6 with extra dip, a number 7, two number 45s, one with cheese, and a large soda."*
     * With each item added, a HUD **`CALORIE COUNTER`** ticks up to `14,500 kcal`, piles of Cluckin' Bell bags stack up on the roof of the car, and the rear left suspension visibly sags into the asphalt.
  2. **Phase 2 — Follow the Damn Train (Sanchez Dirtbike):** Rival Vagos gangsters steal the secret "Extra Dip" shipment and escape atop a moving freight train right behind the restaurant. The player hops onto a **Sanchez Dirtbike** with Big Smoke riding passenger.
  3. **The "Sweet Spot Firing Angle" Mechanic (Authentic GTA SA Quirk Parody):**
     * In the original *San Andreas*, riding too close to the train caused Big Smoke's bullets to hit the metal side hitbox of the carriage instead of the Vagos on the roof.
     * Our browser game turns this exact trauma into a visible, hilarious mechanic:
       * **Too Close (Red Inner Lane):** Smoke's bullets spark harmlessly off the train carriage wall (`"Train Side Armor: 999,999 HP — 0 DMG"`). Smoke yells: *"You're too close, CJ! My bullets are allergic to train geometry!"*
       * **Sweet Spot (Green Outer Track / Elevated Dirt Ramps):** Clear line-of-sight to the roof; Smoke's micro-SMG shreds the 4 roof enemies while you dodge oncoming trains and crossing traffic.
     * **Greasy Hands Debuff:** Every 10 seconds, Smoke pauses shooting for 2 seconds to take a bite of a Number 9 burger unless the player honks the horn (`E`) to yell at him to focus.
  4. **Failure / Victory States:**
     * If the train reaches the bridge before the 4 enemies drop: Instant black-and-white freeze-frame with booming voice/text banner: **`"ALL WE HAD TO DO, WAS FOLLOW THE DAMN TRAIN, CJ!"`**
     * Victory: Smoke tosses an explosive "Number 9 Large" grease bag onto the final roof enemy -> **`MISSION PASSED! RESPECT +`**.

---

### Chapter 4: "RC Trauma & Employee of the Month"
*(Based on GTA: Vice City — "Demolition Man" + GTA V — "Complications")*
* **Setting:** Multi-story construction site adjacent to a luxury Beverly Hills/Vinewood mansion -> Boulevard -> Simeon's Glass Dealership Showroom.
* **Step-by-Step Gameplay Flow:**
  1. **Phase 1 — The Cursed RC Goblin Helicopter ("Demolition Man"):** Step into the `"TOP FUN"` toy van parked outside the construction site to create a diversion.
     * *HUD Warning:* **`WARNING: Childhood Trauma Detected. Vice City RC Helicopter Controls Engaged.`** (Includes an instant UI toggle between `"Modern Merciful Controls"` and `"1986 Numpad Torture Mode"`).
     * **Objective:** Pick up 4 mini-bombs one at a time and drop them onto 4 target barrels across the scaffolding floors before the `2:00` timer expires.
     * **Hardhat Hammer Aggro & The Pro-Gamer Exploit:** Construction workers in yellow hardhats sprint at the toy helicopter swinging $5 claw hammers. Just like in real *Vice City*, the countdown timer **does not start until you pick up Bomb #1**—allowing veteran players to fly into the building *before* grabbing the first bomb and use the spinning rotor blades to mow down every hammer worker stress-free!
  2. **Phase 2 — Stealth Repo & Michael's Backseat Surprise ("Complications"):**
     * As the construction site explodes in 80s neon synthwave glory in the background, hop into the adjacent mansion driveway, sneak past the gardener wearing noise-canceling AirPods, and steal Jimmy's bright **Yellow Karin BeeJay XL SUV**.
     * **The Reveal:** Halfway down the boulevard toward Simeon's dealership, the radio cuts out, the camera shakes, and **Michael rises from the backseat** pressing a pistol to the back of Franklin's head:
       > *"What's up, kid? Keep driving. You wanted a repo? Let's make a deposit—right through the front window."*
     * **Forced-Throttle Mechanic:** Braking (`S`) is disabled (*"MICHAEL HAS A GUN TO YOUR HEAD — BRAKES DISABLED!"*) and top speed surges by +30%.
  3. **Climax — Smashing Simeon's Dealership Window:** Aim the runaway yellow SUV straight at the plate-glass storefront of *Premium Deluxe Motorsport*. Smash through the window in `0.25x` slow-motion with 50+ shattering glass shards, sending Simeon's desk flying directly beneath a giant framed wall portrait of Franklin titled **`EMPLOYEE OF THE MONTH`**. Michael hands you cash: *"Go get yourself a cup of coffee."*

---

### Chapter 5: "Ah Shit, Here We Go Again (5-Star Finale)"
*(Based on GTA San Andreas Opening + Classic 5-Star Military Chase + Pay 'n' Spray)*
* **Setting:** Classic brick alleyway -> Full city grid under 5-Star military lockdown -> Pay 'n' Spray garage.
* **Step-by-Step Gameplay Flow:**
  1. **The Iconic Alleyway Cold Open:** Camera pans behind the protagonist walking down a narrow brick alley toward a parked **BMX Bicycle**.
     * Subtitle & Voice Stinger: **`"Ah shit, here we go again. Worst place in the world..."`**
  2. **Instant 5-Star Escalation:** Mounting the BMX bike immediately triggers **5 Flashing Gold Wanted Stars** across the top-right HUD (`Police Dispatch: "Suspect is riding a bicycle without a bell. Deploy the US Armed Forces."`).
  3. **Stage 1 — BMX Bunny-Hop Gauntlet:** Pedal furiously (`W`) and hold `Space` to **Bunny-Hop** over sliding LSPD cruisers and spike-strip barricades to reach the heavy vehicle drop-off.
  4. **Stage 2 — The Rhino Tank Turret-Boost & Cheat Code Chaos:** Hijack a **Rhino Tank** (or switch into a getaway supercar).
     * **Classic GTA Speedrun Physics Mechanic:** Rotating the Rhino Tank turret backward `180°` and firing the main cannon (`LMB`) uses explosive recoil to boost the tank down the highway at supercar speeds!
     * **Live Keyboard Cheat Codes (Active Easter Eggs):**
       * Typing **`HESOYAM`** during gameplay plays the authentic GTA UI beep, displays the top-left black notification box **`Cheat Activated`**, pops dented car doors back into place at 100% HP, and adds `+$250,000`.
       * Typing **`RIPAZHA`** activates 10 seconds of low-gravity flying car physics.
       * Typing **`BAGUVIX`** triggers brief invincibility sparkles.
  5. **The Climax — The 4-Second Hood Fire & Pay 'n' Spray Logic:**
     * Police helicopters shine searchlights from above, SWAT vans form roadblocks, and rival Rhino Tanks fire shells. When your vehicle takes heavy damage, black smoke turns into **flames on the hood**—triggering the iconic 4-second GTA explosion panic timer (dive out with `F` or make a desperate dash into the garage!).
     * Smash into the **Pay 'n' Spray** garage at full speed.
     * The door slams shut -> `PSSSHHH-PSSSHHH` spray-paint sound effect -> 2 seconds later the door opens and your vehicle rolls out painted **Hot Neon Pink**.
     * All 5 Wanted Stars immediately blink and vanish. Comic speech bubbles appear over the surrounding Army Generals and SWAT teams parked 5 meters away:
       * *"Wait, where did the gray tank go?"*
       * *"Must have been the wind."*
       * *"This one is neon pink, clearly an innocent civilian. Move along!"*
     * Final Screen Slam: **`MISSION PASSED! RESPECT +9999`** -> Endless Free-Roam Sandbox Mode unlocked.

---

## 4. Technical Architecture (Approach 1: Unified 3D + 2.5D Fallback)

### 4.1 Recommended Stack
* **3D Engine & Declarative Scene Graph:** `Three.js` + `@react-three/fiber` (R3F) + `@react-three/drei`
* **Physics Engine:** `@react-three/rapier` (`@dimforge/rapier3d-compat` WASM SIMD physics for rigid bodies, raycast vehicle suspension, character capsules, and destructible street props)
* **State Management Split (60 FPS Rule):**
  * **60Hz Mutable Ref Store (`useFrame`):** Vehicle position/velocity, steering angles, wheel slip, AI traffic spatial ring coordinates, active projectiles (zero React re-renders during physics ticks).
  * **Event-Driven Zustand Store:** HUD & mission state (`health`, `armor`, `cash`, `wantedStars`, `cameraMode`, `activeChapter`, `missionStep`, `subtitles`, `radioStation`, `activeCheats`).
* **UI / HUD Overlay:** React + Tailwind CSS (Minimap 2D canvas overlay, *Pricedown* typography banners, radial Weapon/Radio wheels, iFruit phone modal).
* **Audio Engine:** WebAudio API / Howler.js (procedural engine RPM pitch synthesis, dual-tone police sirens, radio loops, meme voice stingers).

### 4.2 Unified Dual-Camera Rig (3D Primary + Isometric Plan-B)
Instead of maintaining a separate 2D canvas engine for Plan-B, both modes render the **exact same Three.js scene and Rapier3D physics world**:

```
                [ Single 3D City Scene + Rapier3D Physics ]
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
   Mode A: 3D Third-Person (Default)          Mode B: Isometric 2.5D (Plan-B)
┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐
│ PerspectiveCamera (FOV 60°)         │    │ OrthographicCamera (or FOV 20°      │
│ Offset: [0, 3.5, -8] behind target  │    │ Telephoto at offset [40, 45, 40])   │
│ Spring-damped chase + look-ahead    │    │ Fixed 45° Azimuth, 35.26° Pitch     │
│ Speed-based FOV kick (+12° at max)  │    │ Speed-based dynamic zoom-out        │
└─────────────────────────────────────┘    └─────────────────────────────────────┘
```

* **Why This Architecture Wins in a Hackathon:**
  1. **Zero Throwaway Code:** Every vehicle controller, mission trigger, physics collider, and HUD element works identically in both 3D and 2.5D.
  2. **Instant Plan-B Safety Net:** If 3D third-person camera wall-clipping or distant horizon rendering causes any trouble, flipping `defaultCameraMode = '2.5D_ISO'` turns the game into a crisp *GTA: Chinatown Wars* isometric experience in 1 second.
  3. **Headline Gameplay Feature:** Pressing **`V`** at any time triggers the 3-step **GTA V Sky-Cam Flash Transition** between 3D Third-Person and 2.5D Isometric mode.

### 4.3 Control Mapping Across Modes
| Action | Keyboard / Mouse Input | Notes |
| :--- | :--- | :--- |
| **Move / Drive / Pedal** | `W, A, S, D` or `Arrow Keys` | Relative to vehicle heading when driving; camera-relative on foot |
| **Handbrake / Bunny-Hop / Hydraulics** | `Spacebar` | Breaks rear traction for 90° drifts in cars; hops on BMX |
| **Enter / Exit / Hijack Vehicle** | `F` or `Enter` | Ejects AI driver if occupied; dives out if moving fast |
| **Special Ability (Slow-Mo Focus)** | `Shift` or `Caps Lock` | Franklin's driving slow-mo / Trevor's rage mode |
| **Aim & Shoot / Turret Fire** | `RMB` (Aim) + `LMB` (Fire) | Cursor ground-plane raycast in 2.5D mode; crosshair in 3D mode |
| **Take Cover / Horn** | `Q` (Cover on foot) / `E` (Horn in car) | Honking wakes up Big Smoke during Chapter 3 |
| **Weapon Wheel / Radio Wheel** | `Hold Tab` (Weapons) / `Hold R` (Radio) | Slows time to `0.2x` while open |
| **Toggle 3D ↔ 2.5D Sky-Cam** | `V` | Triggers 3-step GTA V Sky-Cam zoom flash |
| **Character Switch (Ch. 1)** | `Alt` | Switches Michael -> Trevor |
| **Cheat Codes** | Type `HESOYAM`, `RIPAZHA`, `BAGUVIX` | Global keydown buffer listener |

### 4.4 City Performance & Hackathon Shortcuts
1. **Grid-Based Procedural City + `<InstancedMesh>`:**
   * A `16x16` city grid (`24m x 24m` per tile) with road straightaways, intersections, building blocks, a train track perimeter (for Chapters 1 & 3), a beachfront strip (Chapter 2), and a central dealership & construction lot (Chapter 4).
   * All static buildings, streetlights, trees, and fire hydrants are rendered via `<InstancedMesh>` (under 15 draw calls for the entire city).
   * Clipping a fire hydrant or streetlight hides its instance index and spawns a temporary flying physics prop + a water geyser particle fountain.
2. **Spatial Ring Traffic & Pedestrian Pool:**
   * Only **15 active AI vehicles** and **25 pedestrians** exist in memory.
   * When any AI entity falls more than `90m` behind the player, it is recycled to a road node `70m` ahead of the player's velocity vector—making a lightweight pool feel like a packed metropolis.

---

## 5. Hackathon Execution Roadmap

* **Phase 1 — Core Foundation (Hours 0–6):**
  * R3F + Rapier3D setup, `16x16` instanced city grid, unified 3D + 2.5D Isometric Sky-Cam rig (`V`), arcade raycast vehicle controller with `Spacebar` drift, and on-foot `F` carjacking loop.
* **Phase 2 — The Rockstar HUD & World Loop (Hours 6–12):**
  * Bottom-left rotating radar with GPS line, top-right Wanted stars & cash counter, `WASTED` / `MISSION PASSED` slow-mo screen states, spatial traffic/police spawner, and keyboard cheat code listener (`HESOYAM`).
* **Phase 3 — The 5 Story Chapters (Hours 12–20):**
  * Implement the chapter state machine and unique mechanics:
    * *Ch. 1:* Snow shader/tint, hostage aim cone, phone vault trigger, Trevor switch, train crash.
    * *Ch. 2:* Red/White car choice, slow-mo driving focus, movie lot aliens, 2-star vision-cone escape, Lamar roast Self-Esteem bar.
    * *Ch. 3:* Cluckin' Bell order clicker + calorie suspension squash, spline train + Sweet-Spot green/red firing zone on Sanchez dirtbike.
    * *Ch. 4:* RC Goblin helicopter bomb drop + hammer workers, yellow SUV backseat gun-to-head no-brakes crash through Simeon's glass window.
    * *Ch. 5:* Alleyway BMX cold open, 5-star Rhino Tank turret-recoil boost, flaming hood timer, Pay 'n' Spray neon-pink respray finale.
* **Phase 4 — Audio, Radio & Meme Polish (Hours 20–24):**
  * 3 parody radio stations, subtitle banter feeds, destructible fire hydrants, and final playtesting across both 3D and 2.5D camera modes.
