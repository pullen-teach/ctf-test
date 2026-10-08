#!/bin/bash
# Passes (exit 0) when the student has submitted the correct flag for step 3.
grep -sqxF "$(cat /root/.quest/3)" /home/player/.answers
