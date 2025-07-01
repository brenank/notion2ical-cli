#!/bin/sh

# run once immediately on startup
notion2ical-cli ${NOTION2ICAL_ARGS}

echo "${CRON_SCHEDULE:-*/15 * * * *} notion2ical-cli ${NOTION2ICAL_ARGS}" > /etc/crontabs/root
exec crond -f -L /dev/stdout
