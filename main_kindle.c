/* Kindle: FBInk output (A2, GC16 every 30 frames) + raw evdev multitouch */
#include "game.h"
#include "fbink.h"
#include <dirent.h>
#include <fcntl.h>
#include <linux/input.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <time.h>
#include <unistd.h>

#define SC 4
#define MAXSLOT 10
static uint8_t big[W * SC * H * SC];
static volatile int running = 1;
static int evfd = -1;
static struct input_absinfo ax, ay;
static int sx_[MAXSLOT], sy_[MAXSLOT], sid[MAXSLOT], slot, newslot;
static int scw = W * SC, sch = H * SC;

static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec + t.tv_nsec * 1e-9; }
static void onsig(int s) { (void)s; running = 0; }

#define TB(b, a) ((a[(b) / 8] >> ((b) % 8)) & 1)
static void open_touch(void) {
    for (int i = 0; i < 16; i++) {
        char p[64]; snprintf(p, sizeof p, "/dev/input/event%d", i);
        int fd = open(p, O_RDONLY | O_NONBLOCK);
        if (fd < 0) continue;
        uint8_t abs[(ABS_MAX + 8) / 8] = {0};
        ioctl(fd, EVIOCGBIT(EV_ABS, sizeof abs), abs);
        if (TB(ABS_MT_POSITION_X, abs) || TB(ABS_X, abs)) {
            int mt = TB(ABS_MT_POSITION_X, abs);
            ioctl(fd, EVIOCGABS(mt ? ABS_MT_POSITION_X : ABS_X), &ax);
            ioctl(fd, EVIOCGABS(mt ? ABS_MT_POSITION_Y : ABS_Y), &ay);
            char name[128] = "?"; ioctl(fd, EVIOCGNAME(sizeof name), name);
            printf("touch: %s %s x[%d..%d] y[%d..%d]\n", p, name, ax.minimum, ax.maximum, ay.minimum, ay.maximum);
            int g = ioctl(fd, EVIOCGRAB, 1);
            printf("grab %s\n", g == 0 ? "ok" : "FAILED");
            evfd = fd;
            return;
        }
        close(fd);
    }
    printf("no touchscreen found\n");
}

static int read_touch(int *newdown) {
    struct input_event ev;
    *newdown = 0;
    if (evfd < 0) return 0;
    while (read(evfd, &ev, sizeof ev) == sizeof ev) {
        if (ev.type == EV_ABS) {
            if (ev.code == ABS_MT_SLOT) { slot = ev.value; if (slot < 0 || slot >= MAXSLOT) slot = 0; }
            else if (ev.code == ABS_MT_TRACKING_ID) { if (ev.value >= 0 && sid[slot] < 0) { *newdown = 1; newslot = slot; } sid[slot] = ev.value; }
            else if (ev.code == ABS_MT_POSITION_X || ev.code == ABS_X) sx_[slot] = ev.value;
            else if (ev.code == ABS_MT_POSITION_Y || ev.code == ABS_Y) sy_[slot] = ev.value;
        } else if (ev.type == EV_KEY && ev.code == BTN_TOUCH) {
            if (ev.value) { if (sid[0] < 0) { sid[0] = 1; *newdown = 1; newslot = 0; } }
            else for (int i = 0; i < MAXSLOT; i++) sid[i] = -1;
        }
    }
    return 1;
}

int main(int argc, char **argv) {
    (void)argc; (void)argv;
    signal(SIGINT, onsig); signal(SIGTERM, onsig);
    setvbuf(stdout, NULL, _IONBF, 0);
    for (int i = 0; i < MAXSLOT; i++) sid[i] = -1;

    FBInkConfig cfg = {0};
    cfg.is_quiet = true;
    cfg.ignore_alpha = true;
    cfg.dithering_mode = HWD_PASSTHROUGH;
    int fd = fbink_open();
    if (fd < 0 || fbink_init(fd, &cfg) < 0) { fprintf(stderr, "fbink init failed\n"); return 1; }
    FBInkState st; fbink_get_state(&cfg, &st);
    scw = st.screen_width; sch = st.screen_height;
    printf("screen %dx%d bpp %d\n", scw, sch, st.bpp);
    int ox = (scw - W * SC) / 2, oy = (sch - H * SC) / 2;
    if (ox < 0) ox = 0; if (oy < 0) oy = 0;
    cfg.is_flashing = true; cfg.wfm_mode = WFM_GC16;
    fbink_cls(fd, &cfg, NULL, false);

    open_touch();
    game_init();

    double last = now(), fpst = last;
    int frames = 0, fcount = 0;
    while (running) {
        int nd = 0;
        read_touch(&nd);
        Input in = {0};
        in.tap = nd;
        if (nd) {
            in.tapx = (sx_[newslot] - ax.minimum) * W / (ax.maximum - ax.minimum + 1);
            in.tapy = (sy_[newslot] - ay.minimum) * H / (ay.maximum - ay.minimum + 1);
        }
        for (int i = 0; i < MAXSLOT && in.nt < MAXT; i++) {
            if (sid[i] < 0) continue;
            in.tx[in.nt] = (sx_[i] - ax.minimum) * W / (ax.maximum - ax.minimum + 1);
            in.ty[in.nt] = (sy_[i] - ay.minimum) * H / (ay.maximum - ay.minimum + 1);
            in.nt++;
        }
        double t = now();
        int r = game_update(in, (float)(t - last));
        if (r & G_QUIT) break;
        int full = r & G_FULL;
        last = t;
        game_render();
        for (int y = 0; y < H; y++) {
            uint8_t *src = fb + y * W;
            uint8_t *row = big + (size_t)y * SC * W * SC;
            for (int x = 0; x < W; x++) memset(row + x * SC, src[x], SC);
            for (int k = 1; k < SC; k++) memcpy(row + k * W * SC, row, W * SC);
        }
        fcount++;
        if (full) { cfg.wfm_mode = WFM_GC16; cfg.is_flashing = true; }
        else if (fcount % 120 == 0) { cfg.wfm_mode = WFM_GC16; cfg.is_flashing = false; }
        else { cfg.wfm_mode = WFM_A2; cfg.is_flashing = false; }
        fbink_print_raw_data(fd, big, W * SC, H * SC, sizeof big, ox, oy, &cfg);
        { double el = now() - t; double fr = 1.0 / 8; if (el < fr) usleep((useconds_t)((fr - el) * 1e6)); }
        frames++;
        if (t - fpst > 2) { game_fps = (int)(frames / (t - fpst) + 0.5); frames = 0; fpst = t; printf("fps %d\n", game_fps); }
    }
    if (evfd >= 0) { ioctl(evfd, EVIOCGRAB, 0); close(evfd); }
    cfg.wfm_mode = WFM_GC16; cfg.is_flashing = true;
    fbink_cls(fd, &cfg, NULL, false);
    fbink_close(fd);
    return 0;
}
