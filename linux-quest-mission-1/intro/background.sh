#!/bin/bash
# Runs hidden, as root, when the scenario starts. Builds the five missions with fresh
# random flags every time, so no two students (and no two runs) share answers.
set -euo pipefail
Q=/root/.quest            # SHA-256 fingerprints of the flags (never the flags)
H=/home/player            # the student plays as this unprivileged user
mkdir -p "$Q"; chmod 700 "$Q"
id player >/dev/null 2>&1 || useradd -m -s /bin/bash player

flag() { printf 'CYBA{%s-%s}' "$1" "$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')"; }
keep() { printf '%s' "$2" | sha256sum | cut -d' ' -f1 > "$Q/$1"; }
pick() { printf '%s\n' "$@" | shuf -n1; }
rnd()  { head -c 32 /dev/urandom | base64 | tr -dc 'a-z0-9' | cut -c1-"$1"; }

# ---- step 1: let the cat out of the bag (cat --help shows -n) ----
F1=$(flag cat); keep 1 "$F1"
mkdir -p "$H/mission1"
line=$(shuf -i 30-95 -n1)
printf 'The cat is hiding in bag.txt.\nEvery line in the bag looks like a flag, but only line %s is real.\n' "$line" > "$H/mission1/README.txt"
for i in $(seq 1 100); do
  if [ "$i" -eq "$line" ]; then echo "meow $F1"; else echo "meow CYBA{cat-$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')}"; fi
done > "$H/mission1/bag.txt"

# ---- step 2: make your moves (pwd, ls, cd, cd .., then ls -a) ----
F2=$(flag moves); keep 2 "$F2"
mkdir -p "$H/mission2"
set -- $(printf '%s\n' park library market harbor station arcade | shuf | head -n 3)
wrong=$1; right=$2; other=$3
mid=$(pick fountain gazebo tunnel bridge kiosk); end=$(pick locker crate shed cellar toolbox)
T2="$H/mission2/town"
mkdir -p "$T2/$wrong" "$T2/$other" "$T2/$right/$mid/$end"
printf 'A flag is hidden at the end of a trail inside town/.\nStart with:  cd town\nEvery folder has a note.txt that tells you where to go next.\n' > "$H/mission2/README.txt"
printf 'Start of the trail. Go into the %s.\n' "$wrong" > "$T2/note.txt"
printf 'Dead end! Go back up one level (cd ..) and try the %s.\n' "$right" > "$T2/$wrong/note.txt"
printf 'Nothing here. Go back up and read the note in town/ again.\n' > "$T2/$other/note.txt"
printf 'Good choice. Go into the %s, then the %s.\nTip: you can do both at once:  cd %s/%s\n' "$mid" "$end" "$mid" "$end" > "$T2/$right/note.txt"
printf 'Almost there. Keep going into the %s.\n' "$end" > "$T2/$right/$mid/note.txt"
printf 'You made it! The flag is in this folder, but it is hidden.\nOne hidden file is a decoy.\n' > "$T2/$right/$mid/$end/note.txt"
echo "Close, but this hidden file is a decoy." > "$T2/$right/$mid/$end/.old-$(rnd 4)"
printf 'You made your moves.\nFlag: %s\n' "$F2" > "$T2/$right/$mid/$end/.$(pick treasure stash secret-notes backup-codes)"

# ---- step 3: find by name ----
F3=$(flag finder); keep 3 "$F3"
ext=$(pick key gem relic)
for a in alpha bravo charlie delta echo; do
  for b in 1 2 3 4; do
    d="$H/mission3/archive/$a/$(pick box bin shelf drawer)-$(rnd 4)"; mkdir -p "$d"
    for _ in 1 2 3 4; do echo "junk $(rnd 20)" > "$d/$(rnd 6).$(pick txt log dat)"; done
  done
done
target="$(find "$H/mission3/archive" -mindepth 2 -type d | shuf -n1)/$(rnd 6).$ext"
printf 'Flag: %s\n' "$F3" > "$target"
printf 'Somewhere in archive/ is ONE file ending in .%s\nIt holds the flag.\n' "$ext" > "$H/mission3/README.txt"

# ---- step 4: grep a log ----
F4=$(flag grep); keep 4 "$F4"
who=$(pick nightowl ghost_fox zero_cool red_panda pixel_wolf)
mkdir -p "$H/mission4"
# awk only, so the setup needs nothing beyond a stock Ubuntu image
awk -v who="$who" -v flag="$F4" -v seed="$RANDOM$RANDOM" 'BEGIN {
  srand(seed); split("alice bob carol dave erin frank grace heidi ivan judy", u, " ")
  split("LOGIN_OK LOGIN_FAIL VIEW_PAGE DOWNLOAD LOGOUT", a, " ")
  hit = 5000 + int(rand() * 30000)
  for (i = 0; i < 40000; i++) {
    t = 8 * 3600 + i
    stamp = sprintf("%02d:%02d:%02d", int(t / 3600) % 24, int(t / 60) % 60, t % 60)
    if (i == hit) printf "%s user=%s action=LOGIN_OK token=%s\n", stamp, who, flag
    else printf "%s user=%s action=%s token=%08x\n", stamp, u[1 + int(rand() * 10)], a[1 + int(rand() * 5)], int(rand() * 4294967295)
  }
}' > "$H/mission4/access.log"
printf 'An intruder logged in ONCE as:  %s\nTheir token is the flag.\n' "$who" > "$H/mission4/README.txt"

# ---- step 5: base64 ----
F5=$(flag decoded); keep 5 "$F5"
mkdir -p "$H/mission5"
printf 'Decoded! Encoding is not encryption.\nFlag: %s\n' "$F5" | base64 -w 40 > "$H/mission5/message.b64"

# ---- the submit command ----
cat > /usr/local/bin/submit <<'SH'
#!/bin/bash
# Usage: submit <flag>   records your answer, then press CHECK in the instructions.
if [ -z "${1:-}" ]; then echo "Usage: submit CYBA{...}"; exit 1; fi
echo "$1" >> "$HOME/.answers"
echo "Recorded. Now press CHECK in the instructions panel."
SH
chmod 755 /usr/local/bin/submit

touch "$H/.answers"
# Clear the screen when player logs in, so the root lines that Killercoda types
# into the terminal (foreground.sh) disappear. /etc/profile.d runs for every
# login shell, whatever dotfiles the image gives the new user.
cat > /etc/profile.d/zz-linux-quest.sh <<'SH'
if [ "$(id -un)" = player ]; then case $- in *i*) clear ;; esac; fi
SH
chown -R player:player "$H"
touch /tmp/.quest-ready
