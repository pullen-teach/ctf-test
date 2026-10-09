#!/bin/bash
# Passes (exit 0) when the student has submitted the correct flag for step 10.
# Only a SHA-256 fingerprint of the flag is stored, so there is no answer to read.
want=$(cat /root/.quest/10)
while IFS= read -r a; do
  [ "$(printf '%s' "$a" | sha256sum | cut -d' ' -f1)" = "$want" ] && exit 0
done < /home/player/.answers
exit 1
