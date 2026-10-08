#!/bin/bash
# Passes (exit 0) when the student has submitted the correct flag for step 4.
grep -sqxF "$(cat /root/.quest/4)" /home/player/.answers
