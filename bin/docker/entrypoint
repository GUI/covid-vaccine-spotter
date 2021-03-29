#!/bin/bash
set -e

while [ ! -f /app/tmp/bootstrapped ] ; do
    echo "Bootstrapping not finished, sleeping and retrying"
    sleep 5
done

exec "$@"
