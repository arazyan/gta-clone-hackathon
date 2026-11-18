#include "game.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

uint8_t fb[W * H];
int game_fps = 0;

#define NB 10
#define PER 144
#define ROAD 48
#define WORLD (NB * PER + ROAD)
#define HCAM 300.0f
#define MAXB 256
#define MAXCOPS 12
#define PI 3.14159265f
#define RIV 6 /* block row turned into a river; crossing roads become bridges */

typedef struct { float x0, y0, x1, y1, h; int deco; } Bld;
typedef struct {
    float x, y, a, vx, vy;
    float stuck, rev, cool;
    int wi, wj, direct, skid;
} Car;

static Bld blds[MAXB];
static int nb;
static uint8_t park[NB][NB];
static Car pl;
static Car cops[MAXCOPS];
static int ncops;
static float hp;
static long money;
static int stars, level;
static int state; /* 0 = rob bank, 1 = go to spray, 2 = passed overlay, 3 = wasted */
static float tx, ty;  /* current target */
static float otimer, pinned, tim;
static float camx, camy;
static unsigned rng = 12345;
static Input last_in;
static Car man;
static int onfoot, prev_act, prev_act2, busted, want_exit;
static float punch_t;
static Car tank, *drv;
static int has_tank, cheat_buf[8], cheat_n, prev_dir[4];
static float cheat_msg, fire_t, turret, fx_t, fx_x, fx_y;
#define ME (onfoot ? &man : drv)
/* skid marks: world-space ring buffer that fades out */
#define NSKID 600
static struct { float x, y, life; } skids[NSKID];
static int skid_i;
static void add_skid(float x, float y) { skids[skid_i].x = x; skids[skid_i].y = y; skids[skid_i].life = 7; skid_i = (skid_i + 1) % NSKID; }
#define BA_X0 (W - 104)
#define BA_Y0 (H - 112)
#define BA_X1 (W - 6)
#define BA_Y1 (H - 64)
#define BB_Y0 (H - 56)
#define BB_Y1 (H - 6)
#define PADC 38
#define PADX (PADC * 3 / 2 + 6)
#define PADY (H - PADC * 3 / 2 - 6)
/* map touches to pad directions (generous zone, diagonals allowed) */
static void resolve(Input *in) {
    for (int i = 0; i < in->nt; i++) {
        int x = in->tx[i], y = in->ty[i];
        if (y < TOPBAR + 4) continue;
        int dx = x - PADX, dy = y - PADY;
        if (dx * dx + dy * dy > (PADC * 2 + 20) * (PADC * 2 + 20)) continue;
        int dz = PADC / 3;
        if (dx < -dz) in->left = 1;
        if (dx > dz) in->right = 1;
        if (dy < -dz) in->up = 1;
        if (dy > dz) in->down = 1;
    }
}
static int prevstate;
typedef struct { int x0, y0, x1, y1; const char *t; } Btn;
#define PB_X0 (W - 40)
static Btn pbtn[3];
static void layout_pause(void) {
    for (int i = 0; i < 3; i++) {
        static const char *L[3] = {"RESUME", "NEW GAME", "EXIT GAME"};
        pbtn[i] = (Btn){W / 2 - 100, H / 2 - 50 + i * 52, W / 2 + 100, H / 2 - 50 + i * 52 + 42, L[i]};
    }
}
static int hit(Input *in, int x0, int y0, int x1, int y1) { return in->tap && in->tapx >= x0 && in->tapx < x1 && in->tapy >= y0 && in->tapy < y1; }

static int rnd(int n) { rng = rng * 1103515245u + 12345u; return (int)((rng >> 16) % (unsigned)n); }

/* ---------------- drawing ---------------- */
static inline void px(int x, int y, int c) {
    if ((unsigned)x < W && (unsigned)y < H) fb[y * W + x] = c ? 255 : 0;
}
static void rectf(int x0, int y0, int x1, int y1, int c) {
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W) x1 = W; if (y1 > H) y1 = H;
    for (int y = y0; y < y1; y++) memset(fb + y * W + x0, c ? 255 : 0, x1 > x0 ? x1 - x0 : 0);
}
static void recto(int x0, int y0, int x1, int y1, int c) {
    for (int x = x0; x < x1; x++) { px(x, y0, c); px(x, y1 - 1, c); }
    for (int y = y0; y < y1; y++) { px(x0, y, c); px(x1 - 1, y, c); }
}
static void line(int x0, int y0, int x1, int y1, int c) {
    int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (int i = 0; i < 2000; i++) {
        px(x0, y0, c);
        if (x0 == x1 && y0 == y1) break;
        int e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
    }
}
/* convex polygon fill; pat 0 solid, 1 floor lines, 2 white */
static void poly(const float *xs, const float *ys, int n, int pat) {
    float ymin = 1e9, ymax = -1e9;
    for (int i = 0; i < n; i++) { if (ys[i] < ymin) ymin = ys[i]; if (ys[i] > ymax) ymax = ys[i]; }
    int y0 = (int)ceilf(ymin), y1 = (int)floorf(ymax);
    if (y0 < 0) y0 = 0; if (y1 > H - 1) y1 = H - 1;
    for (int y = y0; y <= y1; y++) {
        float fy = y + 0.0f, lo = 1e9, hi = -1e9;
        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            float ay = ys[i], by = ys[j];
            if ((fy >= ay && fy <= by) || (fy >= by && fy <= ay)) {
                float x = (by == ay) ? xs[i] : xs[i] + (fy - ay) * (xs[j] - xs[i]) / (by - ay);
                if (by == ay) { if (xs[j] < lo) lo = xs[j]; if (xs[j] > hi) hi = xs[j]; }
                if (x < lo) lo = x; if (x > hi) hi = x;
            }
        }
        int a = (int)lo, b = (int)hi;
        if (a < 0) a = 0; if (b > W - 1) b = W - 1;
        for (int x = a; x <= b; x++) {
            int c = 0;
            if (pat == 1) c = (y % 4 == 0) && (x % 3 != 0);
            if (pat == 2) c = 1;
            fb[y * W + x] = c ? 255 : 0;
        }
    }
}

/* 5x7 font */
static const char *FCH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$'!:-.,*/<>";
static const uint8_t FONT[][7] = {
    {0x0E,0x11,0x11,0x1F,0x11,0x11,0x11},{0x1E,0x11,0x11,0x1E,0x11,0x11,0x1E},{0x0E,0x11,0x10,0x10,0x10,0x11,0x0E},
    {0x1E,0x11,0x11,0x11,0x11,0x11,0x1E},{0x1F,0x10,0x10,0x1E,0x10,0x10,0x1F},{0x1F,0x10,0x10,0x1E,0x10,0x10,0x10},
    {0x0E,0x11,0x10,0x17,0x11,0x11,0x0F},{0x11,0x11,0x11,0x1F,0x11,0x11,0x11},{0x0E,0x04,0x04,0x04,0x04,0x04,0x0E},
    {0x07,0x02,0x02,0x02,0x02,0x12,0x0C},{0x11,0x12,0x14,0x18,0x14,0x12,0x11},{0x10,0x10,0x10,0x10,0x10,0x10,0x1F},
    {0x11,0x1B,0x15,0x15,0x11,0x11,0x11},{0x11,0x11,0x19,0x15,0x13,0x11,0x11},{0x0E,0x11,0x11,0x11,0x11,0x11,0x0E},
    {0x1E,0x11,0x11,0x1E,0x10,0x10,0x10},{0x0E,0x11,0x11,0x11,0x15,0x12,0x0D},{0x1E,0x11,0x11,0x1E,0x14,0x12,0x11},
    {0x0F,0x10,0x10,0x0E,0x01,0x01,0x1E},{0x1F,0x04,0x04,0x04,0x04,0x04,0x04},{0x11,0x11,0x11,0x11,0x11,0x11,0x0E},
    {0x11,0x11,0x11,0x11,0x11,0x0A,0x04},{0x11,0x11,0x11,0x15,0x15,0x15,0x0A},{0x11,0x11,0x0A,0x04,0x0A,0x11,0x11},
    {0x11,0x11,0x11,0x0A,0x04,0x04,0x04},{0x1F,0x01,0x02,0x04,0x08,0x10,0x1F},
    {0x0E,0x11,0x13,0x15,0x19,0x11,0x0E},{0x04,0x0C,0x04,0x04,0x04,0x04,0x0E},{0x0E,0x11,0x01,0x02,0x04,0x08,0x1F},
    {0x1F,0x02,0x04,0x02,0x01,0x11,0x0E},{0x02,0x06,0x0A,0x12,0x1F,0x02,0x02},{0x1F,0x10,0x1E,0x01,0x01,0x11,0x0E},
    {0x06,0x08,0x10,0x1E,0x11,0x11,0x0E},{0x1F,0x01,0x02,0x04,0x08,0x08,0x08},{0x0E,0x11,0x11,0x0E,0x11,0x11,0x0E},
    {0x0E,0x11,0x11,0x0F,0x01,0x02,0x0C},
    {0x04,0x0F,0x14,0x0E,0x05,0x1E,0x04},{0x04,0x04,0x08,0x00,0x00,0x00,0x00},{0x04,0x04,0x04,0x04,0x04,0x00,0x04},
    {0x00,0x0C,0x0C,0x00,0x0C,0x0C,0x00},{0x00,0x00,0x00,0x1F,0x00,0x00,0x00},{0x00,0x00,0x00,0x00,0x00,0x0C,0x0C},
    {0x00,0x00,0x00,0x00,0x0C,0x04,0x08},{0x04,0x04,0x1F,0x0E,0x0E,0x1B,0x11},{0x01,0x01,0x02,0x04,0x08,0x10,0x10},
    {0x02,0x04,0x08,0x10,0x08,0x04,0x02},{0x08,0x04,0x02,0x01,0x02,0x04,0x08},
};
static int text(int x, int y, const char *s, int sc, int c) {
    for (; *s; s++, x += 6 * sc) {
        const char *p = strchr(FCH, *s);
        if (!p || *s == ' ') continue;
        const uint8_t *g = FONT[p - FCH];
        for (int r = 0; r < 7; r++)
            for (int k = 0; k < 5; k++)
                if (g[r] & (0x10 >> k)) rectf(x + k * sc, y + r * sc, x + k * sc + sc, y + r * sc + sc, c);
    }
    return x;
}
static int tw(const char *s, int sc) { return (int)strlen(s) * 6 * sc - sc; }
static void textbox(int cx, int y, const char *s, int sc, int inv) {
    int w = tw(s, sc), x = cx - w / 2;
    rectf(x - 4, y - 4, x + w + 4, y + 7 * sc + 4, inv ? 0 : 1);
    recto(x - 4, y - 4, x + w + 4, y + 7 * sc + 4, inv ? 1 : 0);
    text(x, y, s, sc, inv ? 1 : 0);
}

/* ---------------- world ---------------- */
static float icx(int i) { return i * PER + ROAD / 2; }

static void gen_city(void) {
    nb = 0;
    rng = 777;
    for (int j = 0; j < NB; j++)
        for (int i = 0; i < NB; i++) {
            float x0 = i * PER + ROAD, y0 = j * PER + ROAD, s = PER - ROAD;
            int t = rnd(10);
            park[i][j] = 0;
            if (j == RIV) { park[i][j] = 3; blds[nb++] = (Bld){x0, y0, x0 + s, y0 + s, -1, 0}; continue; } /* river */
            if (t == 0) { park[i][j] = 1; continue; }
            if (t == 1 && (i + j) % 2) { park[i][j] = 2; continue; } /* plaza */
            if (t < 5) {
                blds[nb++] = (Bld){x0 + 6, y0 + 6, x0 + s - 6, y0 + s - 6, 15 + rnd(50), rnd(3)};
            } else if (t < 8) {
                float m = s / 2;
                blds[nb++] = (Bld){x0 + 6, y0 + 6, x0 + m - 3, y0 + s - 6, 15 + rnd(50), rnd(3)};
                blds[nb++] = (Bld){x0 + m + 3, y0 + 6, x0 + s - 6, y0 + s - 6, 15 + rnd(50), rnd(3)};
            } else {
                float m = s / 2;
                for (int q = 0; q < 4; q++) {
                    float ax = x0 + 6 + (q & 1) * m, ay = y0 + 6 + (q >> 1) * m;
                    blds[nb++] = (Bld){ax, ay, ax + m - 9, ay + m - 9, 10 + rnd(35), rnd(3)};
                }
            }
        }
    /* sort by height so taller ones draw on top */
    for (int a = 0; a < nb; a++)
        for (int b = a + 1; b < nb; b++)
            if (blds[b].h < blds[a].h) { Bld t = blds[a]; blds[a] = blds[b]; blds[b] = t; }
    rng = 4242;
}

static float dist(float ax, float ay, float bx, float by) { return hypotf(ax - bx, ay - by); }

static void pick_spot(float fromx, float fromy, float mind, float *ox, float *oy) {
    for (int t = 0; t < 200; t++) {
        int i = rnd(NB + 1), j = rnd(NB);
        float x, y;
        if (rnd(2)) { x = icx(i); y = icx(j) + PER / 2; } else { x = icx(j) + PER / 2; y = icx(i); }
        *ox = x; *oy = y;
        if (dist(x, y, fromx, fromy) > mind) return;
    }
}

/* add cops up to n (keeps existing ones) */
static void ensure_cops(int n) {
    if (n > MAXCOPS) n = MAXCOPS;
    for (int k = ncops; k < n; k++) {
        Car *c = &cops[k];
        memset(c, 0, sizeof *c);
        for (int t = 0; t < 100; t++) {
            c->wi = rnd(NB + 1); c->wj = rnd(NB + 1);
            float d = dist(icx(c->wi), icx(c->wj), pl.x, pl.y);
            if (d > 220 && d < 520) break;
        }
        c->x = icx(c->wi); c->y = icx(c->wj);
        c->a = atan2f(pl.y - c->y, pl.x - c->x);
    }
    if (n > ncops) ncops = n;
}
static void spawn_cops(void) { ensure_cops(2 + level); }

/* ---------------- pedestrians: walk around block perimeters ---------------- */
#define NPED 40
typedef struct { int bi, bj; float t, v, dead; float x, y, a; } Ped;
static Ped peds[NPED];
static float heat; /* seconds since last ped crime */
static void ped_pos(Ped *p) {
    float x0 = p->bi * PER + ROAD - 6, y0 = p->bj * PER + ROAD - 6, L = PER - ROAD + 12;
    float t = fmodf(p->t, 4 * L); if (t < 0) t += 4 * L;
    if (t < L) { p->x = x0 + t; p->y = y0; }
    else if (t < 2 * L) { p->x = x0 + L; p->y = y0 + t - L; }
    else if (t < 3 * L) { p->x = x0 + L - (t - 2 * L); p->y = y0 + L; }
    else { p->x = x0; p->y = y0 + L - (t - 3 * L); }
}
static void ped_spawn(Ped *p, int far) {
    for (int k = 0; k < 50; k++) {
        p->bi = rnd(NB); p->bj = rnd(NB); if (p->bj == RIV) p->bj++; p->t = rnd(360);
        p->v = (8 + rnd(10)) * (rnd(2) ? 1 : -1); p->dead = 0;
        ped_pos(p);
        if (!far || dist(p->x, p->y, pl.x, pl.y) > 250) break;
    }
}
static void peds_init(void) { for (int i = 0; i < NPED; i++) ped_spawn(&peds[i], 0); }
static void ped_crime(Ped *p, int cash) {
    p->dead = 0.01f;
    money += cash;
    heat = 0;
    if (stars < 5) stars++;
    ensure_cops(stars + (state == 1 ? level : 0));
}
static void peds_update(float dt) {
    Car *V = drv; float spd = hypotf(V->vx, V->vy), kr = V == &tank ? 13 : 8;
    for (int i = 0; i < NPED; i++) {
        Ped *p = &peds[i];
        if (p->dead > 0) { p->dead += dt; if (p->dead > 6) ped_spawn(p, 1); continue; }
        float d = dist(p->x, p->y, V->x, V->y);
        float v = p->v;
        if (d < 40 && spd > 30) v *= 3; /* panic */
        float ox = p->x, oy = p->y;
        p->t += v * dt;
        ped_pos(p);
        if (fabsf(p->x - ox) + fabsf(p->y - oy) > 0.01f) p->a = atan2f(p->y - oy, p->x - ox);
        if (d < kr && spd > (V == &tank ? 8 : 25)) ped_crime(p, 100);
    }
    /* wanted level from street crime cools down outside the bank mission */
    if (state == 0 && stars > 0) {
        heat += dt;
        if (heat > 20) { heat = 0; stars--; if (ncops > stars) ncops = stars; }
    }
}
/* top-down person: legs, swinging arms, shoulders, head. style 0 = pedestrian, 1 = player */
static void person(int cx, int cy, float a, float phase, int style) {
    float fx = cosf(a), fy = sinf(a);
    float sw = sinf(phase);
    for (int y = -7; y <= 7; y++)
        for (int x = -7; x <= 7; x++) {
            float v = x * fx + y * fy;   /* forward */
            float u = -x * fy + y * fx;  /* side */
            int c = -1;
            /* legs (step back/forth) */
            if ((u - 1.6f) * (u - 1.6f) + (v - sw * 3) * (v - sw * 3) <= 2.0f) c = 0;
            if ((u + 1.6f) * (u + 1.6f) + (v + sw * 3) * (v + sw * 3) <= 2.0f) c = 0;
            /* arms */
            if ((u - 4.6f) * (u - 4.6f) + (v + sw * 2.5f) * (v + sw * 2.5f) <= 2.2f) c = 0;
            if ((u + 4.6f) * (u + 4.6f) + (v - sw * 2.5f) * (v - sw * 2.5f) <= 2.2f) c = 0;
            /* shoulders / torso ellipse */
            float e = (u / 4.4f) * (u / 4.4f) + (v / 2.4f) * (v / 2.4f);
            if (e <= 1.0f) c = style ? (e > 0.45f ? 0 : 1) : ((x + y) & 1 ? 0 : (e > 0.5f ? 0 : 1));
            /* head */
            float h = u * u + (v - 0.6f) * (v - 0.6f);
            if (h <= 5.0f) c = 0;
            if (style && h <= 1.2f) c = 1;            /* player: bald spot -> distinct */
            if (c >= 0) px(cx + x, cy + y, c);
        }
}

static void draw_peds(void) {
    for (int i = 0; i < NPED; i++) {
        Ped *p = &peds[i];
        int x = (int)(p->x - camx + W / 2), y = (int)(p->y - camy + H / 2);
        if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
        if (p->dead > 0) { /* body lying flat + splat */
            float fx = cosf(p->a + 1.2f), fy = sinf(p->a + 1.2f);
            for (int k = -5; k <= 5; k++) { px(x + (int)(fx * k), y + (int)(fy * k), 0); px(x + (int)(fx * k) + 1, y + (int)(fy * k), 0); }
            rectf(x + (int)(fx * 6) - 2, y + (int)(fy * 6) - 2, x + (int)(fx * 6) + 3, y + (int)(fy * 6) + 3, 0);
            line(x - 2 - (int)(fy * 4), y + (int)(fx * 4), x + 2 - (int)(fy * 4), y + (int)(fx * 4), 0);
            line(x - 2 + (int)(fy * 4), y - (int)(fx * 4), x + 2 + (int)(fy * 4), y - (int)(fx * 4), 0);
            px(x - 6, y + 3, 0); px(x + 5, y - 4, 0); px(x + 2, y + 6, 0);
            continue;
        }
        person(x, y, p->a, p->t * 0.5f, 0);
    }
}

static void reset_game(void) {
    memset(&pl, 0, sizeof pl); drv = &pl; has_tank = 0; cheat_n = 0; fx_t = 0;
    for (int i = 0; i < NSKID; i++) skids[i].life = 0;
    pl.x = icx(5); pl.y = icx(5); pl.a = -PI / 2;
    hp = 100; money = 0; stars = 0; level = 1; ncops = 0; state = 0; pinned = 0; want_exit = 0; onfoot = 0; punch_t = 0; busted = 0;
    pick_spot(pl.x, pl.y, 400, &tx, &ty);
}

void game_init(void) {
    gen_city();
    reset_game();
    peds_init();
}

/* ---------------- physics ---------------- */
static int collide(Car *c, float r) {
    int hit = 0;
    for (int i = 0; i < nb; i++) {
        Bld *b = &blds[i];
        if (c->x < b->x0 - r || c->x > b->x1 + r || c->y < b->y0 - r || c->y > b->y1 + r) continue;
        float qx = c->x < b->x0 ? b->x0 : c->x > b->x1 ? b->x1 : c->x;
        float qy = c->y < b->y0 ? b->y0 : c->y > b->y1 ? b->y1 : c->y;
        float dx = c->x - qx, dy = c->y - qy, d = sqrtf(dx * dx + dy * dy);
        float nx, ny, pen;
        if (d > 0.001f) { nx = dx / d; ny = dy / d; pen = r - d; }
        else { /* inside: push out shortest axis */
            float l = c->x - b->x0, rr = b->x1 - c->x, t = c->y - b->y0, bo = b->y1 - c->y;
            float m = fminf(fminf(l, rr), fminf(t, bo));
            nx = ny = 0;
            if (m == l) nx = -1; else if (m == rr) nx = 1; else if (m == t) ny = -1; else ny = 1;
            pen = m + r;
        }
        if (pen <= 0) continue;
        c->x += nx * pen; c->y += ny * pen;
        float vn = c->vx * nx + c->vy * ny;
        if (vn < 0) { c->vx -= 1.3f * vn * nx; c->vy -= 1.3f * vn * ny; c->vx *= 0.85f; c->vy *= 0.85f; hit = 1; }
    }
    if (c->x < r) { c->x = r; c->vx = fabsf(c->vx) * 0.5f; hit = 1; }
    if (c->y < r) { c->y = r; c->vy = fabsf(c->vy) * 0.5f; hit = 1; }
    if (c->x > WORLD - r) { c->x = WORLD - r; c->vx = -fabsf(c->vx) * 0.5f; hit = 1; }
    if (c->y > WORLD - r) { c->y = WORLD - r; c->vy = -fabsf(c->vy) * 0.5f; hit = 1; }
    return hit;
}

static float fwd_speed(Car *c) { return c->vx * cosf(c->a) + c->vy * sinf(c->a); }

/* steer -1..1, thr: 1 gas, -1 brake/reverse, 0 coast */
static int drive(Car *c, float steer, int thr, float vmax, float dt) {
    float fx = cosf(c->a), fy = sinf(c->a);
    float s = c->vx * fx + c->vy * fy;
    float l = -c->vx * fy + c->vy * fx;
    if (thr < 0) { s -= (s > 0 ? 200 : 70) * dt; if (s < -50) s = -50; }
    else if (thr > 0) { s += (s < 0 ? 200 : 90) * dt; if (s > vmax) s = vmax; }
    else { float f = 60 * dt; s = s > f ? s - f : s < -f ? s + f : 0; }
    float k = s / 22; if (k > 1) k = 1; if (k < -1) k = -1;
    float sr = 3.4f - 1.2f * fabsf(s) / 105; /* sharper at low speed */
    c->a += steer * sr * dt * k;
    l *= expf(-13 * dt);
    l += steer * s * 0.25f * dt; /* light drift */
    fx = cosf(c->a); fy = sinf(c->a);
    c->vx = fx * s - fy * l;
    c->vy = fy * s + fx * l;
    c->skid = fabsf(l) > 6 || (fabsf(steer) > 0.5f && fabsf(s) > 60) || (thr < 0 && s > 30) || (thr > 0 && s < -10);
    int hit = 0;
    float spd = hypotf(c->vx, c->vy) * dt;
    int n = (int)(spd / 3) + 1;
    for (int i = 0; i < n; i++) {
        c->x += c->vx * dt / n; c->y += c->vy * dt / n;
        hit |= collide(c, c == &tank ? 8 : 5);
    }
    return hit;
}

static float angdiff(float a, float b) {
    float d = a - b;
    while (d > PI) d -= 2 * PI;
    while (d < -PI) d += 2 * PI;
    return d;
}

static void cop_ai(Car *c, float dt) {
    Car *T = ME;
    float d = dist(c->x, c->y, T->x, T->y);
    float gx, gy;
    if (d < 110) { c->direct = 1; gx = T->x + T->vx * 0.3f; gy = T->y + T->vy * 0.3f; }
    else {
        if (c->direct) {
            c->direct = 0;
            c->wi = (int)((c->x - ROAD / 2) / PER + 0.5f); c->wj = (int)((c->y - ROAD / 2) / PER + 0.5f);
        }
        if (dist(c->x, c->y, icx(c->wi), icx(c->wj)) < 26) {
            int bi = c->wi, bj = c->wj; float bd = 1e9;
            static const int D[4][2] = {{1,0},{-1,0},{0,1},{0,-1}};
            for (int k = 0; k < 4; k++) {
                int ni = c->wi + D[k][0], nj = c->wj + D[k][1];
                if (ni < 0 || nj < 0 || ni > NB || nj > NB) continue;
                float dd = dist(icx(ni), icx(nj), T->x, T->y) + rnd(30);
                if (dd < bd) { bd = dd; bi = ni; bj = nj; }
            }
            c->wi = bi; c->wj = bj;
        }
        gx = icx(c->wi); gy = icx(c->wj);
    }
    float want = atan2f(gy - c->y, gx - c->x);
    float df = angdiff(want, c->a);
    float steer = df * 2.5f; if (steer > 1) steer = 1; if (steer < -1) steer = -1;
    int brake = 0;
    if (c->rev > 0) { c->rev -= dt; brake = 1; steer = -steer; }
    else if (fabsf(df) > 1.8f && d < 110) brake = 0;
    drive(c, steer, brake ? -1 : 1, 82 + level * 4, dt);
    if (fabsf(fwd_speed(c)) < 10 && c->rev <= 0) { c->stuck += dt; if (c->stuck > 0.7f) { c->rev = 0.7f; c->stuck = 0; } }
    else c->stuck = 0;
}

int game_update(Input in, float dt) {
    if (dt > 0.25f) dt = 0.25f;
    tim += dt;
    resolve(&in);
    last_in = in;
    if (state == 4) {
        layout_pause();
        if (in.pause || hit(&in, pbtn[0].x0, pbtn[0].y0, pbtn[0].x1, pbtn[0].y1) || hit(&in, PB_X0, 0, W, TOPBAR)) { state = prevstate; return G_FULL; }
        if (hit(&in, pbtn[1].x0, pbtn[1].y0, pbtn[1].x1, pbtn[1].y1)) { reset_game(); return G_FULL; }
        if (hit(&in, pbtn[2].x0, pbtn[2].y0, pbtn[2].x1, pbtn[2].y1)) return G_QUIT;
        return 0;
    }
    if (state != 2 && (in.pause || hit(&in, PB_X0, 0, W, TOPBAR))) { prevstate = state; state = 4; return G_FULL; }
    if (state == 3) {
        otimer += dt;
        if (in.tap && otimer > 1.0f) { reset_game(); return 1; }
        return 0;
    }
    if (state == 2) {
        otimer += dt;
        if (otimer > 2.0f) { state = 0; return 1; }
        return 0;
    }
    int actp = (in.act && !prev_act) || hit(&in, BA_X0, BA_Y0, BA_X1, BA_Y1);
    int act2p = (in.act2 && !prev_act2) || hit(&in, BA_X0, BB_Y0, BA_X1, BB_Y1);
    prev_act = in.act; prev_act2 = in.act2;
    /* cheat: UP UP DOWN DOWN LEFT RIGHT LEFT RIGHT -> tank */
    {
        int d[4] = {in.up, in.down, in.left, in.right};
        for (int k = 0; k < 4; k++) {
            if (d[k] && !prev_dir[k]) {
                memmove(cheat_buf, cheat_buf + 1, sizeof(int) * 7); cheat_buf[7] = k; cheat_n++;
                static const int code[8] = {0, 0, 1, 1, 2, 3, 2, 3};
                if (cheat_n >= 8 && !memcmp(cheat_buf, code, sizeof code)) {
                    Car *M = ME;
                    memset(&tank, 0, sizeof tank);
                    tank.x = M->x + cosf(M->a) * 26; tank.y = M->y + sinf(M->a) * 26; tank.a = M->a;
                    for (int t = 0; t < 4; t++) collide(&tank, 8);
                    has_tank = 1; cheat_msg = 2.5f; cheat_n = 0;
                }
            }
            prev_dir[k] = d[k];
        }
        if (cheat_msg > 0) cheat_msg -= dt;
        if (fx_t > 0) fx_t -= dt;
        if (fire_t > 0) fire_t -= dt;
    }
    for (int i = 0; i < NSKID; i++) if (skids[i].life > 0) skids[i].life -= dt;
    float steer = (in.right ? 1 : 0) - (in.left ? 1 : 0);
    float before = hypotf(drv->vx, drv->vy);
    if (!onfoot) {
        int is_tank = drv == &tank;
        if (is_tank) { /* turret auto-aims at nearest ped or cop; FIRE shoots */
            float bd = 160, bx = 0, by = 0; int bp = -1, bc = -1;
            for (int i = 0; i < NPED; i++) if (peds[i].dead <= 0) { float d = dist(peds[i].x, peds[i].y, tank.x, tank.y); if (d < bd) { bd = d; bp = i; bc = -1; bx = peds[i].x; by = peds[i].y; } }
            for (int k = 0; k < ncops; k++) { float d = dist(cops[k].x, cops[k].y, tank.x, tank.y); if (d < bd + 30) { bd = d - 30; bc = k; bp = -1; bx = cops[k].x; by = cops[k].y; } }
            if (bp >= 0 || bc >= 0) turret = atan2f(by - tank.y, bx - tank.x); else turret = tank.a;
            if (act2p && fire_t <= 0 && (bp >= 0 || bc >= 0)) {
                fire_t = 0.7f; fx_t = 0.45f; fx_x = bx; fx_y = by;
                for (int i = 0; i < NPED; i++) if (peds[i].dead <= 0 && dist(peds[i].x, peds[i].y, bx, by) < 14) ped_crime(&peds[i], 100);
                if (bc >= 0) { cops[bc] = cops[ncops - 1]; ncops--; money += 500; if (stars < 5) stars++; heat = 0; }
            }
        }
        if (actp) want_exit = 1;
        int thr = in.up ? 1 : in.down ? -1 : 0;
        if (want_exit) { float fs = fwd_speed(drv); thr = fs > 3 ? -1 : fs < -3 ? 1 : 0; }
        if (drive(drv, steer, thr, is_tank ? 60 : 105, dt) && before > 70 && !is_tank) hp -= (before - 70) * 0.15f;
        if (drv->skid) {
            float fx = cosf(drv->a), fy = sinf(drv->a), w = is_tank ? 6 : 3, b = is_tank ? 8 : 5;
            add_skid(drv->x - fx * b - fy * w, drv->y - fy * b + fx * w);
            add_skid(drv->x - fx * b + fy * w, drv->y - fy * b - fx * w);
        }
        if (want_exit && hypotf(drv->vx, drv->vy) < 25) {
            want_exit = 0;
            onfoot = 1;
            memset(&man, 0, sizeof man);
            float off = is_tank ? 15 : 11;
            man.x = drv->x + sinf(drv->a) * off; man.y = drv->y - cosf(drv->a) * off; man.a = drv->a;
            collide(&man, 3);
            drv->vx = drv->vy = 0;
        }
    } else {
        drive(drv, 0, 0, 105, dt); /* parked vehicle coasts to a stop */
        float mx = steer, my = (in.down ? 1 : 0) - (in.up ? 1 : 0), l = hypotf(mx, my);
        if (l > 0) { mx /= l; my /= l; man.a = atan2f(my, mx); }
        man.vx = mx * 45; man.vy = my * 45;
        for (int i = 0; i < 3; i++) { man.x += man.vx * dt / 3; man.y += man.vy * dt / 3; collide(&man, 3); }
        if (punch_t > 0) punch_t -= dt;
        float dc = dist(man.x, man.y, pl.x, pl.y), dtk = has_tank ? dist(man.x, man.y, tank.x, tank.y) - 6 : 1e9;
        if (actp && dtk < 24) { onfoot = 0; drv = &tank; }
        else if (actp && dc < 24) { onfoot = 0; drv = &pl; }
        else if (act2p && punch_t <= 0) {
            punch_t = 0.3f;
            float fx = cosf(man.a), fy = sinf(man.a);
            for (int i = 0; i < NPED; i++) {
                Ped *p = &peds[i];
                if (p->dead > 0) continue;
                float dx = p->x - man.x, dy = p->y - man.y;
                if (dx * dx + dy * dy < 16 * 16 && dx * fx + dy * fy > -2) { ped_crime(p, 20); break; }
            }
        }
    }
    Car *P = ME;
    float pr = onfoot ? 8 : P == &tank ? 15 : 11;

    int touching = 0;
    for (int k = 0; k < ncops; k++) {
        Car *c = &cops[k];
        cop_ai(c, dt);
        if (c->cool > 0) c->cool -= dt;
        float dx = P->x - c->x, dy = P->y - c->y, d = sqrtf(dx * dx + dy * dy);
        if (d < pr && d > 0.01f) {
            touching = 1;
            float nx = dx / d, ny = dy / d, pen = pr - d;
            P->x += nx * pen * 0.5f; P->y += ny * pen * 0.5f;
            c->x -= nx * pen * 0.5f; c->y -= ny * pen * 0.5f;
            float rv = (c->vx - P->vx) * nx + (c->vy - P->vy) * ny;
            if (rv > 0) {
                P->vx += nx * rv * 0.6f; P->vy += ny * rv * 0.6f;
                c->vx -= nx * rv * 0.6f; c->vy -= ny * rv * 0.6f;
            }
            if (c->cool <= 0) { hp -= ((onfoot ? 12 : 6) + fabsf(rv) * 0.08f) * (P == &tank ? 0.2f : 1); c->cool = 0.5f; }
        }
        for (int m = k + 1; m < ncops; m++) {
            Car *o = &cops[m];
            float ex = o->x - c->x, ey = o->y - c->y, e = sqrtf(ex * ex + ey * ey);
            if (e < 10 && e > 0.01f) { float p = (10 - e) * 0.5f; o->x += ex / e * p; o->y += ey / e * p; c->x -= ex / e * p; c->y -= ey / e * p; }
        }
    }
    if (touching && drv != &tank && (onfoot || fabsf(fwd_speed(drv)) < 15)) pinned += dt;
    else { pinned -= dt; if (pinned < 0) pinned = 0; }

    peds_update(dt);
    if (hp <= 0 || pinned > 2.0f) { busted = hp > 0; hp = hp < 0 ? 0 : hp; state = 3; otimer = 0; return 1; }

    if (dist(P->x, P->y, tx, ty) < 20 && (state == 0 || !onfoot)) {
        if (state == 0) {
            money += 50000;
            if (stars < 2 + level) stars = 2 + level; if (stars > 5) stars = 5;
            spawn_cops();
            state = 1;
            pick_spot(tx, ty, 500, &tx, &ty);
        } else if (state == 1) {
            stars = 0; ncops = 0; hp = 100; level++;
            state = 2; otimer = 0;
            pick_spot(pl.x, pl.y, 400, &tx, &ty);
            return 1;
        }
    }
    return 0;
}

/* ---------------- render ---------------- */
static float sx(float x) { return x - camx + W / 2; }
static float sy(float y) { return y - camy + H / 2; }

static void draw_car(Car *c, int cop) {
    float x = sx(c->x), y = sy(c->y), fx = cosf(c->a), fy = sinf(c->a);
    float hl = 7, hw = 4;
    float xs[4], ys[4];
    float cx[4] = {hl, hl, -hl, -hl}, cy[4] = {hw, -hw, -hw, hw};
    for (int i = 0; i < 4; i++) { xs[i] = x + fx * cx[i] - fy * cy[i]; ys[i] = y + fy * cx[i] + fx * cy[i]; }
    if (cop) {
        poly(xs, ys, 4, 0);
        /* white body inset */
        float ix[4], iy[4];
        float ex[4] = {hl - 1.5f, hl - 1.5f, -hl + 1.5f, -hl + 1.5f}, ey[4] = {hw - 1.5f, -hw + 1.5f, -hw + 1.5f, hw - 1.5f};
        for (int i = 0; i < 4; i++) { ix[i] = x + fx * ex[i] - fy * ey[i]; iy[i] = y + fy * ex[i] + fx * ey[i]; }
        poly(ix, iy, 4, 2);
        /* flashing light bar */
        int f = ((int)(tim * 6)) & 1;
        px((int)(x - fy * 2), (int)(y + fx * 2), f); px((int)(x + fy * 2), (int)(y - fx * 2), !f);
        px((int)x, (int)y, 0);
    } else {
        poly(xs, ys, 4, 0);
        /* windshield */
        for (int k = -3; k <= 3; k++) px((int)(x + fx * 3 - fy * k), (int)(y + fy * 3 + fx * k), 1);
        for (int k = -2; k <= 2; k++) px((int)(x - fx * 4 - fy * k), (int)(y - fy * 4 + fx * k), 1);
    }
}

static void draw_building(Bld *b) {
    if (b->h < 0) return;
    float bx0 = sx(b->x0), by0 = sy(b->y0), bx1 = sx(b->x1), by1 = sy(b->y1);
    float s = HCAM / (HCAM - b->h);
    float rx0 = W / 2 + (bx0 - W / 2) * s, rx1 = W / 2 + (bx1 - W / 2) * s;
    float ry0 = H / 2 + (by0 - H / 2) * s, ry1 = H / 2 + (by1 - H / 2) * s;
    float mnx = fminf(bx0, rx0), mxx = fmaxf(bx1, rx1), mny = fminf(by0, ry0), mxy = fmaxf(by1, ry1);
    if (mxx < 0 || mnx > W || mxy < 0 || mny > H) return;
    /* walls */
    { float xs[4] = {bx0, bx1, rx1, rx0}, ys[4] = {by0, by0, ry0, ry0}; poly(xs, ys, 4, 1); }
    { float xs[4] = {bx0, bx1, rx1, rx0}, ys[4] = {by1, by1, ry1, ry1}; poly(xs, ys, 4, 1); }
    { float xs[4] = {bx0, bx0, rx0, rx0}, ys[4] = {by0, by1, ry1, ry0}; poly(xs, ys, 4, 0); }
    { float xs[4] = {bx1, bx1, rx1, rx1}, ys[4] = {by0, by1, ry1, ry0}; poly(xs, ys, 4, 0); }
    /* roof */
    int a = (int)rx0, c = (int)ry0, e = (int)rx1, g = (int)ry1;
    rectf(a, c, e, g, 1);
    recto(a, c, e + 1, g + 1, 0);
    recto(a + 3, c + 3, e - 2, g - 2, 0);
    if (b->deco == 1) { int mx = (a + e) / 2, my = (c + g) / 2; recto(mx - 4, my - 3, mx + 4, my + 3, 0); }
    if (b->deco == 2) { int mx = (a + e) / 2, my = (c + g) / 2; line(mx - 4, my, mx + 4, my, 0); line(mx, my - 4, mx, my + 4, 0); }
}

static void draw_ground(void) {
    memset(fb, 255, sizeof fb);
    int i0 = (int)((camx - W / 2) / PER) - 1, i1 = (int)((camx + W / 2) / PER) + 1;
    int j0 = (int)((camy - H / 2) / PER) - 1, j1 = (int)((camy + H / 2) / PER) + 1;
    for (int j = j0; j <= j1; j++)
        for (int i = i0; i <= i1; i++) {
            if (i < 0 || j < 0 || i > NB || j > NB) continue;
            /* dashed center lines */
            if (j < NB) { int x = (int)sx(icx(i)); for (int y = (int)sy(j * PER + ROAD); y < (int)sy((j + 1) * PER); y++) if ((y + (int)camy) % 12 < 6) px(x, y, 0); }
            if (i < NB) { int y = (int)sy(icx(j)); for (int x = (int)sx(i * PER + ROAD); x < (int)sx((i + 1) * PER); x++) if ((x + (int)camx) % 12 < 6) px(x, y, 0); }
            if (i < NB && j < NB) {
                int x0 = (int)sx(i * PER + ROAD), y0 = (int)sy(j * PER + ROAD);
                int s = PER - ROAD;
                recto(x0, y0, x0 + s, y0 + s, 0); /* curb */
                if (park[i][j] == 3) { /* river: animated waves + bridge railings on both sides */
                    rectf(x0 + 1, y0 + 1, x0 + s - 1, y0 + s - 1, 1);
                    for (int x = x0 + 1; x < x0 + s - 1; x++) {
                        int wx = x + (int)camx;
                        int off = (int)(sinf(wx * 0.18f + tim * 2.5f) * 2.5f);
                        for (int y = y0 + 4; y < y0 + s - 3; y++) if (((y + (int)camy + off) % 7) == 0) px(x, y, 0);
                    }
                    for (int y = y0; y < y0 + s; y++) { /* railings = bridge edges */
                        px(x0 - 1, y, 0); px(x0 - 2, y, 0); px(x0 + s, y, 0); px(x0 + s + 1, y, 0);
                        if ((y + (int)camy) % 8 == 0) { rectf(x0 - 4, y, x0, y + 2, 0); rectf(x0 + s, y, x0 + s + 4, y + 2, 0); }
                    }
                    for (int x = x0; x < x0 + s; x++) { px(x, y0, 0); px(x, y0 + 1, 0); px(x, y0 + s - 1, 0); px(x, y0 + s - 2, 0); }
                } else if (park[i][j] == 2) { /* plaza: paving grid, fountain, benches */
                    for (int y = y0 + 2; y < y0 + s - 2; y++)
                        for (int x = x0 + 2; x < x0 + s - 2; x++) {
                            int wx = x + (int)camx, wy = y + (int)camy;
                            if ((wx % 12 == 0 && (wy & 1)) || (wy % 12 == 0 && (wx & 1))) px(x, y, 0);
                        }
                    int cx = x0 + s / 2, cy = y0 + s / 2;
                    for (int dy = -20; dy <= 20; dy++) for (int dx = -20; dx <= 20; dx++) {
                        int r = dx * dx + dy * dy;
                        if (r > 400) continue;
                        int c = 1;
                        if (r > 324) c = 0;                                         /* stone rim */
                        else { float rr = sqrtf((float)r); if (((int)(rr - tim * 8) % 5 + 5) % 5 == 0) c = 0; } /* ripples */
                        if (r < 10) c = 0;                                          /* statue */
                        px(cx + dx, cy + dy, c);
                    }
                    rectf(x0 + 10, y0 + 12, x0 + 26, y0 + 16, 0); rectf(x0 + s - 26, y0 + 12, x0 + s - 10, y0 + 16, 0);
                    rectf(x0 + 10, y0 + s - 16, x0 + 26, y0 + s - 12, 0); rectf(x0 + s - 26, y0 + s - 16, x0 + s - 10, y0 + s - 12, 0);
                } else if (park[i][j]) {
                    for (int y = y0 + 3; y < y0 + s - 3; y++)
                        for (int x = x0 + 3; x < x0 + s - 3; x++) {
                            int wx = x + (int)camx, wy = y + (int)camy;
                            if (((wx * 7 + wy * 13) % 29) == 0) px(x, y, 0);
                        }
                    /* trees */
                    for (int t = 0; t < 4; t++) {
                        int cx = x0 + 22 + (t & 1) * 50, cy = y0 + 22 + (t >> 1) * 50;
                        for (int dy = -7; dy <= 7; dy++) for (int dx = -7; dx <= 7; dx++)
                            if (dx * dx + dy * dy <= 49) px(cx + dx, cy + dy, (dx * dx + dy * dy > 30) ? 0 : ((dx + dy) & 3) != 0);
                    }
                }
            }
        }
    /* world border */
    recto((int)sx(0) - 1, (int)sy(0) - 1, (int)sx(WORLD) + 1, (int)sy(WORLD) + 1, 0);
}

/* street furniture at block corners: traffic lights, stop signs, trees */
static void draw_decor(void) {
    int i0 = (int)((camx - W / 2) / PER) - 1, i1 = (int)((camx + W / 2) / PER) + 1;
    int j0 = (int)((camy - H / 2) / PER) - 1, j1 = (int)((camy + H / 2) / PER) + 1;
    int lit = ((int)(tim / 3)) % 3;
    for (int j = j0; j <= j1; j++)
        for (int i = i0; i <= i1; i++) {
            if (i < 0 || j < 0 || i >= NB || j >= NB) continue;
            float bx0 = i * PER + ROAD, by0 = j * PER + ROAD, bs = PER - ROAD;
            float cxs[4] = {bx0 + 1, bx0 + bs - 1, bx0 + 1, bx0 + bs - 1}, cys[4] = {by0 + 1, by0 + 1, by0 + bs - 1, by0 + bs - 1};
            for (int k = 0; k < 4; k++) {
                if (park[i][j] == 3) continue;
                int kind = (i * 7 + j * 5 + k * 3) % 11; /* 0 light, 1 stop, 2-3 tree, rest nothing */
                if (kind == 3) kind = 2;
                int x = (int)sx(cxs[k]), y = (int)sy(cys[k]);
                if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
                if (kind == 0) { /* traffic light: housing with 3 lamps */
                    rectf(x - 3, y - 7, x + 4, y + 8, 0);
                    for (int l = 0; l < 3; l++) {
                        int ly = y - 4 + l * 5;
                        if (l == lit) rectf(x - 1, ly - 1, x + 2, ly + 2, 1); else px(x, ly, 1);
                    }
                } else if (kind == 1) { /* stop sign: octagon */
                    for (int dy = -5; dy <= 5; dy++) for (int dx = -5; dx <= 5; dx++) {
                        if (abs(dx) + abs(dy) > 7) continue;
                        int edge = abs(dx) == 5 || abs(dy) == 5 || abs(dx) + abs(dy) == 7;
                        px(x + dx, y + dy, edge ? 0 : (abs(dy) <= 1 && abs(dx) <= 3) ? 1 : 0);
                    }
                    rectf(x - 3, y - 1, x + 4, y + 2, 1);
                } else if (kind == 2) { /* tree canopy */
                    for (int dy = -6; dy <= 6; dy++) for (int dx = -6; dx <= 6; dx++) {
                        int r = dx * dx + dy * dy;
                        if (r > 36) continue;
                        px(x + dx, y + dy, r > 25 ? 0 : (((dx * 3 + dy * 5) & 3) == 0));
                    }
                }
            }
        }
}

static void draw_minimap(void) {
    int S = 72, x0 = W - S - 4, y0 = TOPBAR + 4;
    float sc = (float)S / WORLD;
    rectf(x0 - 2, y0 - 2, x0 + S + 2, y0 + S + 2, 1);
    rectf(x0, y0, x0 + S, y0 + S, 0);
    for (int i = 0; i <= NB; i++) {
        int r = (int)(icx(i) * sc);
        rectf(x0 + r, y0, x0 + r + 1, y0 + S, 1);
        rectf(x0, y0 + r, x0 + S, y0 + r + 1, 1);
    }
    recto(x0 - 2, y0 - 2, x0 + S + 2, y0 + S + 2, 0);
    for (int k = 0; k < ncops; k++) {
        int cx = x0 + (int)(cops[k].x * sc), cy = y0 + (int)(cops[k].y * sc);
        rectf(cx - 1, cy - 1, cx + 2, cy + 2, ((int)(tim * 4) + k) & 1);
    }
    int tx_ = x0 + (int)(tx * sc), ty2 = y0 + (int)(ty * sc);
    if ((int)(tim * 3) & 1) { recto(tx_ - 4, ty2 - 4, tx_ + 5, ty2 + 5, 0); recto(tx_ - 3, ty2 - 3, tx_ + 4, ty2 + 4, 1); }
    rectf(tx_ - 1, ty2 - 1, tx_ + 2, ty2 + 2, 0);
    Car *P = ME;
    int pxm = x0 + (int)(P->x * sc), pym = y0 + (int)(P->y * sc);
    rectf(pxm - 3, pym - 3, pxm + 4, pym + 4, 1);
    rectf(pxm - 2, pym - 2, pxm + 3, pym + 3, 0);
}

static void draw_marker(void) {
    int x = (int)sx(tx), y = (int)sy(ty);
    int p = ((int)(tim * 4)) & 1;
    int r = 12 + p * 2;
    recto(x - r, y - r, x + r, y + r, 0);
    recto(x - r + 1, y - r + 1, x + r - 1, y + r - 1, 0);
    rectf(x - 7, y - 9, x + 7, y + 9, 0);
    text(x - 2 * 1 - 1, y - 7, state == 0 ? "$" : "P", 1, 1);
    text(x - 2 - 1, y + 1, state == 0 ? "$" : "P", 1, 1);
}

static void draw_arrow(void) {
    float x = sx(tx), y = sy(ty);
    float dx = x - W / 2, dy = y - H / 2;
    float m = 18;
    float ax, ay;
    if (x > m && x < W - m && y > TOPBAR + 50 && y < H - BTNH - 20) {
        ax = x; ay = y - 24 - 3 * sinf(tim * 6); dx = 0; dy = 1;
    } else {
        float tx_ = dx > 0 ? (W / 2 - m) / dx : dx < 0 ? (-W / 2 + m) / dx : 1e9;
        float ty_ = dy > 0 ? (H / 2 - BTNH - 16) / dy : dy < 0 ? (-H / 2 + TOPBAR + 50) / dy : 1e9;
        float t = fminf(tx_, ty_);
        ax = W / 2 + dx * t; ay = H / 2 + dy * t;
    }
    float l = hypotf(dx, dy); if (l < 0.01f) return;
    dx /= l; dy /= l;
    float xs[3] = {ax + dx * 10, ax - dx * 6 - dy * 8, ax - dx * 6 + dy * 8};
    float ys[3] = {ay + dy * 10, ay - dy * 6 + dx * 8, ay - dy * 6 - dx * 8};
    float xo[3], yo[3];
    for (int i = 0; i < 3; i++) { xo[i] = ax + (xs[i] - ax) * 1.35f; yo[i] = ay + (ys[i] - ay) * 1.35f; }
    poly(xo, yo, 3, 2);
    poly(xs, ys, 3, 0);
}

static void button(int x0, int y0, int x1, int y1, const char *t, int sc, int pressed) {
    rectf(x0, y0, x1, y1, !pressed);
    recto(x0, y0, x1, y1, 0); recto(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0);
    text((x0 + x1) / 2 - tw(t, sc) / 2, (y0 + y1) / 2 - 7 * sc / 2, t, sc, pressed);
}

static void draw_hud(void) {
    char buf[64];
    int st = state == 4 ? prevstate : state;
    rectf(0, 0, W, TOPBAR, 1);
    line(0, TOPBAR, W, TOPBAR, 0);
    for (int i = 0; i < 5; i++) {
        if (i < stars) { if (((int)(tim * 3) & 1) || st != 1) text(3 + i * 13, 3, "*", 2, 0); }
        else rectf(3 + i * 13 + 4, 3 + 9, 3 + i * 13 + 6, 3 + 11, 0);
    }
    text(3, 21, "HP", 1, 0);
    recto(17, 20, 87, 29, 0);
    rectf(19, 22, 19 + (int)(66 * (hp < 0 ? 0 : hp) / 100), 27, 0);
    snprintf(buf, sizeof buf, "$%ld", money);
    text(PB_X0 - 6 - tw(buf, 2), 9, buf, 2, 0);
    /* pause button */
    rectf(PB_X0, 0, W, TOPBAR, state == 4 ? 0 : 1);
    recto(PB_X0, 0, W, TOPBAR, 0);
    rectf(PB_X0 + 12, 7, PB_X0 + 17, TOPBAR - 7, state == 4);
    rectf(PB_X0 + 23, 7, PB_X0 + 28, TOPBAR - 7, state == 4);
    /* pager */
    const char *pg = st == 0 ? "ROB THE BANK" : st == 1 ? "GET TO PAY'N'SPRAY" : "";
    if (*pg) {
        textbox(W / 2 - 30, TOPBAR + 8, pg, st == 1 ? 1 : 2, 1);
        Car *P = ME; char db[32];
        snprintf(db, sizeof db, "%s %dM", st == 0 ? "BANK" : "SPRAY", (int)(dist(P->x, P->y, tx, ty) / 4));
        textbox(W / 2 - 30, TOPBAR + 30, db, 1, 0);
    }
    if (st == 0 || st == 1) draw_minimap();
    if (st == 1 && ((int)(tim * 2) & 1)) textbox(W / 2 - 30, TOPBAR + 46, "* SIREN *", 1, 0);
    if (pinned > 0.3f) textbox(W / 2 - 30, TOPBAR + 62, "PINNED!", 2, 0);
    if (cheat_msg > 0) textbox(W / 2, H / 2 - 60, "CHEAT: TANK!", 2, 1);
    /* control buttons */
    /* action buttons */
    {
        int ta = 0, tb = 0;
        for (int i = 0; i < last_in.nt; i++) {
            int x = last_in.tx[i], y = last_in.ty[i];
            if (x >= BA_X0 && y >= BA_Y0 && y < BA_Y1) ta = 1;
            if (x >= BA_X0 && y >= BB_Y0) tb = 1;
        }
        const char *la = !onfoot ? "GET OUT" : (dist(man.x, man.y, pl.x, pl.y) < 24 || (has_tank && dist(man.x, man.y, tank.x, tank.y) < 30)) ? "GET IN" : NULL;
        if (la) button(BA_X0, BA_Y0, BA_X1, BA_Y1, la, 2, ta || last_in.act);
        if (onfoot) button(BA_X0, BB_Y0, BA_X1, BB_Y1, "PUNCH", 2, tb || last_in.act2);
        else if (drv == &tank) button(BA_X0, BB_Y0, BA_X1, BB_Y1, fire_t > 0 ? "RELOAD" : "FIRE", 2, tb || last_in.act2 || fire_t > 0.5f);
    }
    /* d-pad */
    {
        int c = PADC, h = c / 2, X = PADX, Y = PADY;
        button(X - h, Y - h - c, X + h, Y - h, "", 1, last_in.up);
        button(X - h, Y + h, X + h, Y + h + c, "", 1, last_in.down);
        button(X - h - c, Y - h, X - h, Y + h, "", 1, last_in.left);
        button(X + h, Y - h, X + h + c, Y + h, "", 1, last_in.right);
        rectf(X - h, Y - h, X + h, Y + h, 1); recto(X - h, Y - h, X + h, Y + h, 0);
        /* arrows */
        float a[4][2] = {{0, -1}, {0, 1}, {-1, 0}, {1, 0}};
        int on[4] = {last_in.up, last_in.down, last_in.left, last_in.right};
        for (int k = 0; k < 4; k++) {
            float cx = X + a[k][0] * c, cy = Y + a[k][1] * c, ux = a[k][0], uy = a[k][1];
            float xs[3] = {cx + ux * 9, cx - ux * 6 - uy * 9, cx - ux * 6 + uy * 9};
            float ys[3] = {cy + uy * 9, cy - uy * 6 + ux * 9, cy - uy * 6 - ux * 9};
            poly(xs, ys, 3, on[k] ? 2 : 0);
        }
    }
    if (game_fps > 0) { snprintf(buf, sizeof buf, "%d FPS", game_fps); text(W - 3 - tw(buf, 1), H - 10, buf, 1, 0); }
}

void game_render(void) {
    { Car *P = ME; camx = P->x + P->vx * 0.35f; camy = P->y + P->vy * 0.35f; }
    draw_ground();
    for (int i = 0; i < NSKID; i++) {
        if (skids[i].life <= 0) continue;
        if (skids[i].life < 3 && (i & 1)) continue;          /* fade: thin out */
        if (skids[i].life < 1.5f && (i & 2)) continue;
        int x = (int)sx(skids[i].x), y = (int)sy(skids[i].y);
        rectf(x, y, x + 2, y + 2, 0);
    }
    draw_marker();
    for (int k = 0; k < ncops; k++) draw_car(&cops[k], 1);
    draw_peds();
    draw_car(&pl, 0);
    if (has_tank) { /* tank: tracks, hull, turret + barrel */
        float x = sx(tank.x), y = sy(tank.y), fx = cosf(tank.a), fy = sinf(tank.a);
        float xs[4], ys[4];
        float cx[4] = {12, 12, -12, -12}, cy[4] = {9, -9, -9, 9};
        for (int i = 0; i < 4; i++) { xs[i] = x + fx * cx[i] - fy * cy[i]; ys[i] = y + fy * cx[i] + fx * cy[i]; }
        poly(xs, ys, 4, 0);
        float ix[4], iy[4], ex[4] = {10, 10, -10, -10}, ey[4] = {6, -6, -6, 6};
        for (int i = 0; i < 4; i++) { ix[i] = x + fx * ex[i] - fy * ey[i]; iy[i] = y + fy * ex[i] + fx * ey[i]; }
        poly(ix, iy, 4, 1);
        float tx2 = cosf(turret), ty2 = sinf(turret);
        for (int w = -1; w <= 1; w++) line((int)(x - ty2 * w), (int)(y + tx2 * w), (int)(x + tx2 * 18 - ty2 * w), (int)(y + ty2 * 18 + tx2 * w), 0);
        for (int dy = -5; dy <= 5; dy++) for (int dx = -5; dx <= 5; dx++) { int r = dx * dx + dy * dy; if (r <= 25) px((int)x + dx, (int)y + dy, r > 12 ? 0 : 1); }
        rectf((int)x - 1, (int)y - 1, (int)x + 2, (int)y + 2, 0);
    }
    if (fx_t > 0) { /* shell tracer + explosion */
        int ex = (int)sx(fx_x), ey = (int)sy(fx_y);
        if (fx_t > 0.3f && has_tank) line((int)sx(tank.x), (int)sy(tank.y), ex, ey, 0);
        int r = (int)((0.45f - fx_t) * 40) + 4;
        for (int a = 0; a < 16; a++) {
            float an = a * PI / 8, rr = r * ((a & 1) ? 0.6f : 1.0f);
            line(ex, ey, ex + (int)(cosf(an) * rr), ey + (int)(sinf(an) * rr), 0);
        }
        for (int dy = -r / 2; dy <= r / 2; dy++) for (int dx = -r / 2; dx <= r / 2; dx++) if (dx * dx + dy * dy <= r * r / 4) px(ex + dx, ey + dy, (dx + dy) & 1);
    }
    if (onfoot) {
        int x = (int)sx(man.x), y = (int)sy(man.y);
        float fx = cosf(man.a), fy = sinf(man.a);
        int reach = punch_t > 0.1f ? 10 : 5;
        if (punch_t > 0.1f) { line(x, y, x + (int)(fx * reach), y + (int)(fy * reach), 0); line(x + 1, y, x + 1 + (int)(fx * reach), y + (int)(fy * reach), 0); }
        if (punch_t > 0.1f) rectf(x + (int)(fx * reach) - 2, y + (int)(fy * reach) - 2, x + (int)(fx * reach) + 3, y + (int)(fy * reach) + 3, 0);
        static float ph; if (man.vx != 0 || man.vy != 0) ph += 0.9f;
        person(x, y, man.a, ph, 1);
    }
    for (int i = 0; i < nb; i++) draw_building(&blds[i]);
    draw_decor();
    draw_arrow();
    draw_hud();
    if (state == 2) {
        textbox(W / 2, H / 2 - 30, "MISSION", 4, 1);
        textbox(W / 2, H / 2 + 10, "PASSED", 4, 1);
        textbox(W / 2, H / 2 + 50, "+$50000", 2, 0);
    }
    if (state == 3) {
        rectf(0, H / 2 - 40, W, H / 2 + 40, 0);
        text(W / 2 - tw(busted ? "BUSTED" : "WASTED", 5) / 2, H / 2 - 30, busted ? "BUSTED" : "WASTED", 5, 1);
        if (otimer > 1.0f) textbox(W / 2, H / 2 + 50, "TAP TO RESTART", 1, 0);
    }
    if (state == 4) {
        layout_pause();
        rectf(20, H / 2 - 150, W - 20, H / 2 + 160, 1);
        recto(20, H / 2 - 150, W - 20, H / 2 + 160, 0); recto(22, H / 2 - 148, W - 22, H / 2 + 158, 0);
        text(W / 2 - tw("PAUSED", 4) / 2, H / 2 - 136, "PAUSED", 4, 0);
        text(W / 2 - tw("HOLD 2 FINGERS FOR DIAGONALS", 1) / 2, H / 2 - 100, "HOLD 2 FINGERS FOR DIAGONALS", 1, 0);
        text(W / 2 - tw("JOYSTICK: UP GAS, DOWN BRAKE/BACK", 1) / 2, H / 2 - 88, "JOYSTICK: UP GAS, DOWN BRAKE/BACK", 1, 0);
        text(W / 2 - tw("RIGHT BUTTONS: EXIT CAR / PUNCH", 1) / 2, H / 2 - 76, "LEFT/RIGHT: STEER", 1, 0);
        for (int i = 0; i < 3; i++) button(pbtn[i].x0, pbtn[i].y0, pbtn[i].x1, pbtn[i].y1, pbtn[i].t, 2, 0);
    }
}
