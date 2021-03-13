#!/bin/bash
set -e

rm -f /app/tmp/bootstrapped
if [ -f /tmp/bootstrapped ] ; then
    # This ensures we always bootstrap the DB once, but skip during any
    # subsequent docker-compose up commands
    touch /app/tmp/bootstrapped
    echo "Bootstrap already completed, exiting"
    exec "$@"
fi

yarn install --production=false

# Apply initial migrations
set +e
/app/node_modules/.bin/knex migrate:latest
if [ $? -ne 0 ] ; then
    echo "DB not up yet, sleeping and trying again"
    sleep 1
    /app/node_modules/.bin/knex migrate:latest
fi
set -e


# Download geonames and import initial models
/app/bin/download-geonames
/app/bin/import-states
/app/bin/import-postal-codes

# /app/tmp is for inter-container communication
touch /app/tmp/bootstrapped
# /tmp is for local to this container, to remember if we have ran it
touch /tmp/bootstrapped

exec "$@"
