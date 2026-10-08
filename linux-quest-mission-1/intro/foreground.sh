#!/bin/bash
echo "Building your mission..."
while [ ! -f /tmp/.quest-ready ]; do sleep 1; done
clear
# player's ~/.profile ends with "clear" (set up in background.sh), so the
# screen is wiped again after the switch and no root lines stay visible.
su - player
