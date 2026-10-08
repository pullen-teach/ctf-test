#!/bin/bash
# Runs hidden, as root, when the scenario starts. Builds Mission 1 with fresh
# random flags every time, so no two students (and no two runs) share answers.
set -euo pipefail
Q=/root/.quest            # SHA-256 fingerprints of the flags (never the flags)
H=/home/player            # the student plays as this unprivileged user
mkdir -p "$Q"; chmod 700 "$Q"
id player >/dev/null 2>&1 || useradd -m -s /bin/bash player

flag() { printf 'CQ{%s-%s}' "$1" "$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')"; }
keep() { printf '%s' "$2" | sha256sum | cut -d' ' -f1 > "$Q/$1"; }
pick() { printf '%s\n' "$@" | shuf -n1; }
rnd()  { head -c 32 /dev/urandom | base64 | tr -dc 'a-z0-9' | cut -c1-"$1"; }

# ---- step 1: hidden file (ls -a) ----
F1=$(flag hidden); keep 1 "$F1"
mkdir -p "$H/mission1"
echo "Nothing to see here. Or is there? Some files are shy." > "$H/mission1/notes.txt"
echo "Close, but this hidden file is a decoy." > "$H/mission1/.old-$(rnd 4)"
printf 'You found the hidden file.\nFlag: %s\n' "$F1" > "$H/mission1/.$(pick vault stash secret-notes backup-codes)"

# ---- step 2: find by name ----
F2=$(flag finder); keep 2 "$F2"
ext=$(pick key vault gem)
for a in alpha bravo charlie delta echo; do
  for b in 1 2 3 4; do
    d="$H/mission2/archive/$a/$(pick box bin shelf drawer)-$(rnd 4)"; mkdir -p "$d"
    for _ in 1 2 3 4; do echo "junk $(rnd 20)" > "$d/$(rnd 6).$(pick txt log dat)"; done
  done
done
target="$(find "$H/mission2/archive" -mindepth 2 -type d | shuf -n1)/$(rnd 6).$ext"
printf 'Flag: %s\n' "$F2" > "$target"
printf 'Somewhere in archive/ is ONE file ending in .%s\nIt holds the flag.\n' "$ext" > "$H/mission2/README.txt"

# ---- step 3: grep a log ----
F3=$(flag grep); keep 3 "$F3"
who=$(pick nightowl ghost_fox zero_cool red_panda pixel_wolf)
mkdir -p "$H/mission3"
# awk only, so the setup needs nothing beyond a stock Ubuntu image
awk -v who="$who" -v flag="$F3" -v seed="$RANDOM$RANDOM" 'BEGIN {
  srand(seed); split("alice bob carol dave erin frank grace heidi ivan judy", u, " ")
  split("LOGIN_OK LOGIN_FAIL VIEW_PAGE DOWNLOAD LOGOUT", a, " ")
  hit = 5000 + int(rand() * 30000)
  for (i = 0; i < 40000; i++) {
    t = 8 * 3600 + i
    stamp = sprintf("%02d:%02d:%02d", int(t / 3600) % 24, int(t / 60) % 60, t % 60)
    if (i == hit) printf "%s user=%s action=LOGIN_OK token=%s\n", stamp, who, flag
    else printf "%s user=%s action=%s token=%08x\n", stamp, u[1 + int(rand() * 10)], a[1 + int(rand() * 5)], int(rand() * 4294967295)
  }
}' > "$H/mission3/access.log"
printf 'An intruder logged in ONCE as:  %s\nTheir token is the flag.\n' "$who" > "$H/mission3/README.txt"

# ---- step 4: base64 ----
F4=$(flag decoded); keep 4 "$F4"
mkdir -p "$H/mission4"
printf 'Decoded! Encoding is not encryption.\nFlag: %s\n' "$F4" | base64 -w 40 > "$H/mission4/message.b64"

# ---- the submit command ----
cat > /usr/local/bin/submit <<'SH'
#!/bin/bash
# Usage: submit <flag>   records your answer, then press CHECK in the instructions.
if [ -z "${1:-}" ]; then echo "Usage: submit CQ{...}"; exit 1; fi
echo "$1" >> "$HOME/.answers"
echo "Recorded. Now press CHECK in the instructions panel."
SH
chmod 755 /usr/local/bin/submit

touch "$H/.answers"
chown -R player:player "$H"
touch /tmp/.quest-ready
