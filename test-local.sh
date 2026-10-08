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
for n in 1 2 3 4 5; do neg $n; done
as 'submit CQ{wrong-00000000}' >/dev/null; neg 1
out=$(as 'vault'); case "$out" in *locked*) echo "  PASS  vault stays locked without an option"; pass=$((pass+1));; *) echo "  FAIL  vault opened with no option"; fail=$((fail+1));; esac
as 'vault --help' | grep -q -- '--open' && { echo "  PASS  vault --help documents --open"; pass=$((pass+1)); } || { echo "  FAIL  vault --help"; fail=$((fail+1)); }
grep -q 'CQ{' /usr/local/bin/vault && { echo "  FAIL  flag readable in the vault script"; fail=$((fail+1)); } || { echo "  PASS  flag is not plain text in the vault script"; pass=$((pass+1)); }
f=$(as 'vault --open' | last);                                                         as "submit '$f'" >/dev/null; check 1
f=$(as 'cd ~/mission2 && for x in .[!.]*; do cat "$x"; done' | last);              as "submit '$f'" >/dev/null; check 2
ext=$(as 'cat ~/mission3/README.txt' | grep -o 'in \.[a-z]*' | cut -c5-)
f=$(as "cd ~/mission3 && cat \"\$(find archive -name '*.$ext')\"" | last);            as "submit '$f'" >/dev/null; check 3
who=$(as 'cat ~/mission4/README.txt' | head -1 | awk '{print $NF}')
f=$(as "cd ~/mission4 && grep $who access.log" | sed 's/.*token=//');                 as "submit '$f'" >/dev/null; check 4
f=$(as 'cd ~/mission5 && base64 -d message.b64' | last);                              as "submit '$f'" >/dev/null; check 5
echo "  lines in log: $(wc -l < /home/player/mission4/access.log), intruder lines: $(grep -c "$who" /home/player/mission4/access.log)"
if grep -rq "CQ{" /root/.quest; then echo "  FAIL  a flag is stored in plain text"; fail=$((fail+1)); else echo "  PASS  only fingerprints are stored"; pass=$((pass+1)); fi
if su - player -c "cat /root/.quest/1" >/dev/null 2>&1; then echo "  FAIL  player can read answers"; fail=$((fail+1)); else echo "  PASS  player cannot read the answer files"; pass=$((pass+1)); fi
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
IN
