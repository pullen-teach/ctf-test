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
last() { grep -o 'CYBA{[^}]*}' | tail -1; }
for n in 1 2 3 4 5 6; do neg $n; done
as 'submit CYBA{wrong-00000000}' >/dev/null; neg 1
walk='cd ~/mission1/town && cd $(ls | sed -n "s/sign--go-into-the-//p") && cd .. && cd $(ls */ | sed -n "s/dead-end--go-back-up-and-try-the-//p") && cd $(ls | sed -n "s/go-into-the-\(.*\)-then-the-\(.*\)/\1\/\2/p") && pwd && ls'
out=$(as "$walk"); echo "$out" | grep -q "you-made-it" && { echo "  PASS  following the signposts reaches the flag folder"; pass=$((pass+1)); } || { echo "  FAIL  trail: $out"; fail=$((fail+1)); }
f=$(echo "$out" | last);                                                               as "submit '$f'" >/dev/null; check 1
as 'cat --help' | grep -q -- '-n' && { echo "  PASS  cat --help documents -n"; pass=$((pass+1)); } || { echo "  FAIL  cat --help"; fail=$((fail+1)); }
[ "$(grep -c 'CYBA{' /home/player/mission2/bag.txt)" -eq 100 ] && { echo "  PASS  bag.txt has 100 flag-like lines"; pass=$((pass+1)); } || { echo "  FAIL  bag.txt line count"; fail=$((fail+1)); }
n=$(as 'cat ~/mission2/README.txt' | grep -o 'line [0-9][0-9]*' | cut -c6-)
d=$(as 'head -1 ~/mission2/bag.txt' | last);                                          as "submit '$d'" >/dev/null; neg 2
f=$(as "cd ~/mission2 && cat -n bag.txt" | awk -v n="$n" '$1 == n' | last);            as "submit '$f'" >/dev/null; check 2
f=$(as 'cd ~/mission3 && for x in .[!.]*; do cat "$x"; done' | last);              as "submit '$f'" >/dev/null; check 3
ext=$(as 'cat ~/mission4/README.txt' | grep -o 'in \.[a-z]*' | cut -c5-)
f=$(as "cd ~/mission4 && cat \"\$(find archive -name '*.$ext')\"" | last);            as "submit '$f'" >/dev/null; check 4
who=$(as 'cat ~/mission5/README.txt' | head -1 | awk '{print $NF}')
f=$(as "cd ~/mission5 && grep $who access.log" | sed 's/.*token=//');                 as "submit '$f'" >/dev/null; check 5
f=$(as 'cd ~/mission6 && base64 -d message.b64' | last);                              as "submit '$f'" >/dev/null; check 6
echo "  lines in log: $(wc -l < /home/player/mission5/access.log), intruder lines: $(grep -c "$who" /home/player/mission5/access.log)"
if grep -rq "CYBA{" /root/.quest; then echo "  FAIL  a flag is stored in plain text"; fail=$((fail+1)); else echo "  PASS  only fingerprints are stored"; pass=$((pass+1)); fi
if su - player -c "cat /root/.quest/1" >/dev/null 2>&1; then echo "  FAIL  player can read answers"; fail=$((fail+1)); else echo "  PASS  player cannot read the answer files"; pass=$((pass+1)); fi
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
IN
