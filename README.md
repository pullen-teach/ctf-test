# Linux Quest scenarios for Killercoda

Each folder is one Killercoda scenario. Publish by adding this repository to
your Killercoda creator profile (killercoda.com/creators): every push to the
chosen branch updates the scenarios.

## linux-quest-mission-1

Four steps: hidden files (ls -a), find by name, grep a log, base64 decode.

- `intro/background.sh` runs hidden as root at start: creates the unprivileged
  user `player`, builds the four missions with random flags, and keeps only
  SHA-256 fingerprints of the flags in `/root/.quest` (readable only by root).
  The flags themselves are never stored, so there is no answer file to find.
- `intro/foreground.sh` waits for setup, then switches the terminal to `player`.
- Students record answers with `submit <flag>`, which appends to
  `/home/player/.answers`; each step's `verify.sh` fingerprints those answers
  and compares when the student presses CHECK.
- Steps have hints but no solutions.

Limits: this is a practice environment. The terminal starts as root before it
switches to `player`, so a student who exits the `player` shell gets root. Root
still can't read the answers (only fingerprints are kept), but it can read the
mission files directly. Fine for practice; do not use it for anything graded.

## Local test

`test-local.sh` runs the whole scenario in a plain Ubuntu container: setup,
student-style solutions as `player`, and every verify script.
