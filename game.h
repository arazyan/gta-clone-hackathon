#pragma once
#include <stdint.h>

#define W 318
#define H 424

#define MAXT 8
/* keyboard flags + raw touch points (game coords); game maps touches to on-screen buttons */
typedef struct { int up, down, left, right, act, act2, tap, tapx, tapy, pause, nt; int tx[MAXT], ty[MAXT]; } Input;
#define TOPBAR 32   /* HUD height: taps here don't steer */
#define BTNH 24     /* bottom margin for target arrow */
#define G_FULL 1    /* game_update flags */
#define G_QUIT 2

extern uint8_t fb[W * H]; /* 0 = black, 255 = white */
extern int game_fps;      /* set by platform for display */

void game_init(void);
/* returns G_FULL / G_QUIT flags */
int game_update(Input in, float dt);
void game_render(void);
