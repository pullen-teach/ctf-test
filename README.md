# Linux Quest scenarios for Killercoda

Each folder is one Killercoda scenario. Publish by adding this repository to
your Killercoda creator profile (killercoda.com/creators): every push to the
chosen branch updates the scenarios.

## linux-quest-mission-1

Six steps: navigation (cd, ls; the flag is a file name), cat with --help (`cat -n`),
hidden files (ls -a), find by name, grep a log, base64 decode. Steps name useful commands and hint at
`--help`; they never give the answer.

- `intro/background.sh` runs hidden as root at start: creates the unprivileged
  user `player`, builds the four missions with random flags, and keeps only
  SHA-256 fingerprints of the flags in `/root/.quest` (readable only by root).
  The flags themselves are never stored, so there is no answer file to find.
- `intro/foreground.sh` waits for setup, then switches the terminal to `player`.
- Students record answers with `submit <flag>`, which appends to
  `/home/player/.answers`; each step's `verify.sh` fingerprints those answers
  and compares when the student presses CHECK.
- Steps have hints but no solutions.

- `intro/foreground.sh` is one line: it clears the screen at once, waits for
  setup, then replaces the root shell with `player` (`exec su - player`), so
  typing `exit` ends the session instead of dropping to root.

Limits: this is a practice environment. Killercoda opens every terminal as
root, so the root prompt shows for a split second before the screen clears, and
a student who opens a new terminal tab gets root there. Root still can't read
the answers (only fingerprints are kept), but it can read the mission files
directly. Fine for practice; do not use it for anything graded.

## Local test

`test-local.sh` runs the whole scenario in a plain Ubuntu container: setup,
student-style solutions as `player`, and every verify script.
