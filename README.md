# Mini GTA for Kindle

A top-down GTA-style game with pseudo-3D buildings for jailbroken e-ink Kindles (KOReader). Rendered into a 1-bit 318×424 buffer and scaled ×4 to the 1272×1696 screen via FBInk (A2 waveform, ~8 fps). A desktop build (X11) is included as a demo fallback.

**Mission:** rob the bank (+$50,000, ★★★, cops spawn) → drive to PAY'N'SPRAY (wanted level cleared, MISSION PASSED, next bank with more cops). HP = 0 → WASTED; pinned by cops for 2 s → BUSTED. Pedestrians can be run over or punched: +$ and a wanted star.

**City:** blocks of buildings, parks, plazas with fountains, a river with bridges, traffic lights, stop signs, trees, minimap, distance to target, fading skid marks.

**Cheat:** on the d-pad press **↑ ↑ ↓ ↓ ← → ← →** — a tank spawns in front of you. Get in and press FIRE: the turret auto-aims at the nearest pedestrian or police car.

## Controls

| Kindle (touch) | Desktop | Action |
|---|---|---|
| D-pad bottom-left ↑ / ↓ | ↑ / ↓ (W/S) | gas / brake & reverse; walk when on foot |
| D-pad ← / → | ← / → (A/D) | steer; walk when on foot (two fingers for diagonals) |
| GET OUT / GET IN button | E | leave the vehicle / enter (stand next to it) |
| PUNCH (on foot) / FIRE (tank) | F | punch / shoot |
| **II** button top-right | Esc / P | pause: RESUME / NEW GAME / EXIT GAME |
| Tap | Enter / click | restart after WASTED |

## Build

Requirements: `make`, `cc`, `libx11-dev` (desktop), [zig 0.13](https://ziglang.org/download/) (Kindle). The zig path is set by `ZIG` (default `~/.local/opt/zig-linux-x86_64-0.13.0/zig`).

```sh
make desktop && ./gta      # desktop
make kindle                # static ARM binary gta_kindle (zig cc, arm-linux-musleabihf)
```

`make kindle` clones FBInk (pinned commit `c4cc9b6`, plus stb) into `./FBInk`, applies `fbink-gn433x.patch` and builds FBInk statically. The patch teaches FBInk the Kindle with device ID 0xC7F (MTK); without it the screen never refreshes on that model. Other models FBInk already knows work as is.

## Run on the Kindle

**Over SSH (KOReader):** in KOReader → Tools → More tools → SSH server, enable "Login without password" and start it. The Kindle and the laptop must be on the same network (OpenSSH ≥ 8.4 on the laptop).

```sh
./deploy.sh <kindle-ip> 2222    # build, copy to /mnt/us/extensions/gta and launch
```

**Via KUAL:** `make kindle && cp gta_kindle kual/gta/`, copy the `kual/gta` folder to `extensions/` on the Kindle, then KUAL → Mini GTA → Play. "Play (stop Kindle UI)" also stops the stock UI while playing; "Kill game" is the emergency exit. KOReader holds an exclusive grab on the touchscreen, so it is closed while the game runs (its SSH server keeps running); after exiting you return to the stock Kindle UI. Log: `/mnt/us/gta.log`.

The game keeps running after you unplug the cable or the laptop leaves the network. Don't press the power button — locking the screen ends the game.

## Files

- `game.c`, `game.h` — all game logic and rendering, platform-independent
- `main_desktop.c` — X11 window + keyboard/mouse
- `main_kindle.c` — FBInk output + evdev multitouch
- `Makefile`, `deploy.sh`, `kual/gta/` — build, deploy, KUAL extension
- `fbink-gn433x.patch` — FBInk device-ID patch
