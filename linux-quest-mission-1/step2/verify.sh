#!/bin/bash
# Passes (exit 0) when the student has submitted the correct flag for step 2.
grep -sqxF "$(cat /root/.quest/2)" /home/player/.answers
