#!/usr/bin/env bash
# Runs linux-quest-mission-1 in a plain Ubuntu container: setup, student-style
# solutions as `player`, and every verify script. Usage: ./test-local.sh [image]
set -uo pipefail
IMG=${1:-ubuntu:24.04}
D=$(cd "$(dirname "$0")/linux-quest-mission-1" && pwd)
docker run --rm -i -v "$D:/scenario:ro" "$IMG" bash -s <<'IN'
set -u
bash /scenario/intro/background.sh || { echo "FAIL setup"; exit 1; }
as() { su - player -c "$1" 2>&1; }
pass=0; fail=0
check() {
  if bash "/scenario/step$1/verify.sh"; then echo "  PASS  step $1 verify accepts the right flag"; pass=$((pass+1)); else echo "  FAIL  step $1"; fail=$((fail+1)); fi
}
neg() {
  if bash "/scenario/step$1/verify.sh"; then echo "  FAIL  step $1 passed before submitting"; fail=$((fail+1)); else echo "  PASS  step $1 refuses until the flag is submitted"; pass=$((pass+1)); fi
}
last() { grep -o 'CQ{[^}]*}' | tail -1; }
for n in 1 2 3 4; do neg $n; done
as 'submit CQ{wrong-00000000}' >/dev/null; neg 1
f=$(as 'cd ~/mission1 && for x in .[!.]*; do cat "$x"; done' | last);              as "submit '$f'" >/dev/null; check 1
ext=$(as 'cat ~/mission2/README.txt' | grep -o 'in \.[a-z]*' | cut -c5-)
f=$(as "cd ~/mission2 && cat \"\$(find archive -name '*.$ext')\"" | last);            as "submit '$f'" >/dev/null; check 2
who=$(as 'cat ~/mission3/README.txt' | head -1 | awk '{print $NF}')
f=$(as "cd ~/mission3 && grep $who access.log" | sed 's/.*token=//');                 as "submit '$f'" >/dev/null; check 3
f=$(as 'cd ~/mission4 && base64 -d message.b64' | last);                              as "submit '$f'" >/dev/null; check 4
echo "  lines in log: $(wc -l < /home/player/mission3/access.log), intruder lines: $(grep -c "$who" /home/player/mission3/access.log)"
if su - player -c 'cat /root/.quest/1' >/dev/null 2>&1; then echo "  FAIL  player can read answers"; fail=$((fail+1)); else echo "  PASS  player cannot read the answer files"; pass=$((pass+1)); fi
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
IN
