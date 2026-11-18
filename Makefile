ZIG ?= $(HOME)/.local/opt/zig-linux-x86_64-0.13.0/zig
FBINK = $(abspath FBInk)
FBINK_REV = c4cc9b61b739c300eafa30f1beef590e3bd45abc
KCC = $(ZIG) cc -target arm-linux-musleabihf -mcpu=cortex_a7

desktop: gta
gta: game.c game.h main_desktop.c
	cc -O2 -o gta game.c main_desktop.c -lX11 -lm

kindle: gta_kindle
gta_kindle: game.c game.h main_kindle.c $(FBINK)/Release/libfbink.a
	$(KCC) -O2 -static -I$(FBINK) -o gta_kindle game.c main_kindle.c $(FBINK)/Release/libfbink.a -lm

FBSRC = $(FBINK)/fbink.c $(FBINK)/cutef8/utf8.c $(FBINK)/cutef8/dfa.c $(FBINK)/qimagescale/qimagescale.c
$(FBINK)/fbink.c:
	git clone https://github.com/NiLuJe/FBInk $(FBINK) && cd $(FBINK) && git checkout -q $(FBINK_REV) && git submodule update --init --depth 1 stb

# patch: teach FBInk our Kindle (device id 0xC7F, MTK) — idempotent
$(FBINK)/.gn433x: $(FBINK)/fbink.c
	cd $(FBINK) && (grep -q 0xC7Fu fbink_device_id.c || git apply $(CURDIR)/fbink-gn433x.patch) && touch .gn433x

$(FBINK)/Release/libfbink.a: $(FBINK)/.gn433x
	mkdir -p $(FBINK)/Release/o
	cd $(FBINK)/Release/o && for f in $(FBSRC); do $(KCC) -O2 -w -Wno-implicit-function-declaration -include math.h -D_GNU_SOURCE -DFBINK_FOR_KINDLE -DFBINK_MINIMAL -DFBINK_WITH_DRAW -DFBINK_WITH_IMAGE -DFBINK_VERSION='"dev"' -I$(FBINK) -c $$f -o $$(basename $$f).o 2>&1 || exit 1; done
	$(ZIG) ar rcs $@ $(FBINK)/Release/o/*.o

clean:
	rm -f gta gta_kindle
