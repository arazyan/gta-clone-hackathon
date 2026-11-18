#!/bin/sh
# Launch the game alone: KOReader holds an exclusive grab on the touchscreen,
# so it is closed for the duration of the game (its SSH server keeps running).
D=$(dirname "$0")
killall gta_kindle 2>/dev/null
lipc-set-prop com.lab126.powerd preventScreenSaver 1 2>/dev/null
if [ "$1" = "stopui" ]; then stop lab126_gui 2>/dev/null || stop framework 2>/dev/null; sleep 1; fi
KOSH=$(pidof koreader.sh)
for p in $(ps | grep "koreader.sh" | grep -v grep | awk '{print $1}'); do KOSH="$KOSH $p"; done
for p in $KOSH; do kill -STOP $p 2>/dev/null; done          # don't let the launcher react
killall -9 reader.lua 2>/dev/null                           # release the touch grab
FROZEN="$(pidof cvm) $(pidof kfxreader) $(pidof KPPMainApp)"
for p in $FROZEN; do kill -STOP $p 2>/dev/null; done        # native UI: no redraws
sleep 1
chmod +x "$D/gta_kindle"
"$D/gta_kindle" > /mnt/us/gta.log 2>&1
for p in $FROZEN; do kill -CONT $p 2>/dev/null; done
for p in $KOSH; do kill -CONT $p 2>/dev/null; done          # launcher cleans up -> back to Kindle UI
lipc-set-prop com.lab126.powerd preventScreenSaver 0 2>/dev/null
if [ "$1" = "stopui" ]; then start lab126_gui 2>/dev/null || start framework 2>/dev/null; fi
true
