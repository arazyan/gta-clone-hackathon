#!/bin/sh
# usage: ./deploy.sh [host] [port]   — KOReader SSH (no password), default 172.20.10.2:2222
H=${1:-172.20.10.2}; P=${2:-2222}
set -e
cd "$(dirname "$0")"
make kindle
cp gta_kindle kual/gta/
AP=$(mktemp); printf '#!/bin/sh\necho ""\n' > $AP; chmod +x $AP
export SSH_ASKPASS=$AP SSH_ASKPASS_REQUIRE=force DISPLAY=${DISPLAY:-:0}
O="-o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password,keyboard-interactive"
ssh -p $P $O root@$H "killall gta_kindle 2>/dev/null; mkdir -p /mnt/us/extensions/gta; true"
scp -P $P $O -r kual/gta/* root@$H:/mnt/us/extensions/gta/
ssh -p $P $O root@$H "chmod +x /mnt/us/extensions/gta/*; cd /mnt/us/extensions/gta; nohup sh ./run.sh $3 >/dev/null 2>&1 & sleep 4; cat /mnt/us/gta.log"
