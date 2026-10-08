# Linux Quest scenarios for Killercoda

Each folder is one Killercoda scenario. Publish by adding this repository to
your Killercoda creator profile (killercoda.com/creators): every push to the
chosen branch updates the scenarios.

## linux-quest-mission-1

Four steps: hidden files (ls -a), find by name, grep a log, base64 decode.

- `intro/background.sh` runs hidden as root at start: creates the unprivileged
  user `player`, builds the four missions, and writes random flags to
  `/root/.quest` (readable only by root).
- `intro/foreground.sh` waits for setup, then switches the terminal to `player`.
- Students record answers with `submit <flag>`, which appends to
  `/home/player/.answers`; each step's `verify.sh` checks that file when the
  student presses CHECK.

Limits: this is a practice environment. The terminal starts as root before it
switches to `player`, so a student who exits the `player` shell gets root and
can read the answers. Fine for practice; do not use it for anything graded.

## Local test

`test-local.sh` runs the whole scenario in a plain Ubuntu container: setup,
student-style solutions as `player`, and every verify script.
