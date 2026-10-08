clear; echo "Starting Linux Quest..."; while [ ! -f /tmp/.quest-ready ]; do sleep 1; done; clear; exec su - player
