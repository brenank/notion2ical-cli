FROM node:18-alpine

WORKDIR /data

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN npm install -g notion2ical-cli

ENV CRON_SCHEDULE="*/15 * * * *"
ENV NOTION2ICAL_ARGS=""
ENV NOTION_AUTH_TOKEN=""
ENV NOTION_DATABASE_ID=""
ENV NOTION_TITLE_PROPERTY_NAME=""
ENV NOTION_DATE_PROPERTY_NAME=""

ENTRYPOINT ["/entrypoint.sh"]
