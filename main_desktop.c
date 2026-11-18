/* Desktop fallback: plain Xlib (no SDL2 headers on this box). Arrows: up gas, down brake/reverse, left/right steer; E/F actions, Enter/Space = tap, Esc/P = pause, Q = quit, mouse = tap. */
#include "game.h"
#include <X11/Xlib.h>
#include <X11/XKBlib.h>
#include <X11/keysym.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define S 2

static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec + t.tv_nsec * 1e-9; }

int main(void) {
    Display *d = XOpenDisplay(NULL);
    if (!d) { fprintf(stderr, "no X display\n"); return 1; }
    int scr = DefaultScreen(d);
    Window w = XCreateSimpleWindow(d, RootWindow(d, scr), 0, 0, W * S, H * S, 0, 0, 0);
    XStoreName(d, w, "mini GTA");
    XSelectInput(d, w, KeyPressMask | KeyReleaseMask | StructureNotifyMask | ButtonPressMask);
    Atom del = XInternAtom(d, "WM_DELETE_WINDOW", False);
    XSetWMProtocols(d, w, &del, 1);
    XMapWindow(d, w);
    XkbSetDetectableAutoRepeat(d, True, NULL);
    GC gc = XCreateGC(d, w, 0, NULL);
    uint32_t *pix = malloc(W * S * H * S * 4);
    XImage *img = XCreateImage(d, DefaultVisual(d, scr), DefaultDepth(d, scr), ZPixmap, 0, (char *)pix, W * S, H * S, 32, 0);

    game_init();
    Input in = {0};
    double last = now(), fpst = last;
    int frames = 0;
    for (;;) {
        in.tap = 0; in.pause = 0;
        while (XPending(d)) {
            XEvent e; XNextEvent(d, &e);
            if (e.type == ClientMessage) return 0;
            if (e.type == ButtonPress) { in.tap = 1; in.tapx = e.xbutton.x / S; in.tapy = e.xbutton.y / S; }
            if (e.type == KeyPress || e.type == KeyRelease) {
                int dn = e.type == KeyPress;
                KeySym k = XLookupKeysym(&e.xkey, 0);
                if (k == XK_Left || k == XK_a) in.left = dn;
                if (k == XK_Right || k == XK_d) in.right = dn;
                if (k == XK_Down || k == XK_s) in.down = dn;
                if (k == XK_Up || k == XK_w) in.up = dn;
                if (k == XK_e) in.act = dn;
                if (k == XK_f) in.act2 = dn;
                if ((k == XK_Return || k == XK_space) && dn) in.tap = 1;
                if ((k == XK_Escape || k == XK_p) && dn) in.pause = 1;
                if (k == XK_q) return 0;
            }
        }
        double t = now();
        if (game_update(in, (float)(t - last)) & G_QUIT) return 0;
        last = t;
        game_render();
        for (int y = 0; y < H * S; y++)
            for (int x = 0; x < W * S; x++) {
                uint8_t v = fb[(y / S) * W + x / S];
                pix[y * W * S + x] = v ? 0xffffff : 0;
            }
        XPutImage(d, w, gc, img, 0, 0, 0, 0, W * S, H * S);
        XFlush(d);
        frames++;
        if (t - fpst > 1) { game_fps = frames; frames = 0; fpst = t; }
        usleep(1000000 / 30);
    }
}
