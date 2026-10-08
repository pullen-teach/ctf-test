#!/bin/bash
# Passes (exit 0) when the student has submitted the correct flag for step 1.
grep -sqxF "$(cat /root/.quest/1)" /home/player/.answers
