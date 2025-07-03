# notion2ical-cli

[![npm version](https://img.shields.io/npm/v/notion2ical-cli.svg)](https://www.npmjs.com/package/notion2ical-cli) [![GitHub repository](https://img.shields.io/badge/GitHub-Repo-blue?style=flat-square&logo=github)](https://github.com/brenank/notion2ical-cli)

A command-line tool that converts a Notion calendar database into iCalendar (`.ics`) format.

## Features

- Export Notion calendar databases to iCalendar format
- Supports incremental updates for efficient syncing
- Customizable event mapping and error handling
- Written in TypeScript, ESM-first

## Installation

```sh
npm install -g notion2ical-cli
```

Or use it directly with `npx`:

```sh
npx notion2ical-cli --help
```

## Usage

```sh
notion2ical-cli \
  --auth <token> \
  --database-id <id> \
  --title-property-name <name> \
  --date-property-name <name>
```

### Options

- `-a, --auth <token>`: (Required) Notion integration token (or set `NOTION_AUTH_TOKEN` in env)
- `-d, --database-id <id>`: (Required) Notion database ID (or set `NOTION_DATABASE_ID` in env)
- `-t, --title-property-name <name>`: (Required) Name of the property containing the event title (or set `NOTION_TITLE_PROPERTY_NAME` in env)
- `-e, --date-property-name <name>`: (Required) Name of the property containing the event start/end date (or set `NOTION_DATE_PROPERTY_NAME` in env)
- `-s, --desc-property-name <name>`: (Optional) Name of the property containing the event description (or set `NOTION_DESC_PROPERTY_NAME` in env)
- `-f, --fallback-duration <min>`: (Optional) Default duration for events without an end, in minutes (must be a positive integer, default: 60)
- `-i, --ignore-missing-dates`: (Optional) Ignore events with no date set (default: false)
- `--calendar-name <name>`: (Optional) Name of the calendar to create (default: Notion Calendar)
- `--from-date <date>`: (Optional) Include events starting on or after this date (inclusive). Accepts `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY.MM.DD`, or full ISO 8601 (e.g., `2025-06-28T14:30:00Z`)
- `--until-date <date>`: (Optional) Include events starting on or before this date (inclusive). Accepts `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY.MM.DD`, or full ISO 8601 (e.g., `2025-06-28T14:30:00Z`)
- `--incremental`: (Optional) Enable incremental sync (enables --cache-dir and --cache-max-age options, default: false)
- `--cache-dir <path>`: (Optional) Directory to store cached sync state (requires --incremental, default: system cache folder; will be created if it does not exist)
- `--cache-max-age <sec>`: (Optional) Perform a full resync if the cache is older than this many seconds (requires --incremental, a non-negative integer in seconds or 0 to disable, default: 0)
- `-v, --verbose`: (Optional) Enable verbose logging (can be used multiple times for more verbosity)
- `-o, --output <file>`: (Optional) Write the generated `.ics` to a file instead of stdout

> **Warning:**
> Incremental mode does **not** detect deleted events/pages in Notion. If you delete an event in Notion, it will remain in the generated `.ics` file until you perform a full (non-incremental) sync or manually clear the cache directory. The `--cache-max-age` option can be used to force a full resync after a specified period, which will remove deleted events from the output. Use incremental mode for performance, but be aware of this limitation.

## Example

```sh
notion2ical-cli \
  --auth secret_xxx \
  --database-id 1234567890abcdef \
  --title-property-name Name \
  --date-property-name Date
```

## Environment Variables

You can set some options via environment variables instead of command-line flags:

- `NOTION_AUTH_TOKEN`: Notion integration token
- `NOTION_DATABASE_ID`: Notion database ID
- `NOTION_TITLE_PROPERTY_NAME`: Name of the title property
- `NOTION_DATE_PROPERTY_NAME`: Name of the date property
- `NOTION_DESC_PROPERTY_NAME`: Name of the description property

## Output & Logging

- The generated `.ics` file is written to **stdout**.
- All logging and informational messages are sent to **stderr**.

## License

MIT

---

**See also:**
- [notion2ical](https://www.npmjs.com/package/notion2ical) (library)
