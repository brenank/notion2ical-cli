import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { Client } from "@notionhq/client";
import { Command } from "commander";
import { config as loadDotEnvironment } from "dotenv";
import {
  IncrementalStorageFileRepository,
  Notion2ICal,
  Notion2ICalErrors,
} from "notion2ical";
import * as pino from "pino";
import { PrettyOptions } from "pino-pretty";

import packageJson from "../package.json" with { type: "json" };

let homeFolder: string = path.join(homedir(), ".local", "state");
if (process.env.XDG_STATE_HOME) {
  homeFolder = process.env.XDG_STATE_HOME;
}

const defaultCacheDirectory = path.join(
  process.env.APPDATA || homeFolder,
  packageJson.name,
);

// Load environment variables from “.env” (if it exists)
loadDotEnvironment();

function increaseVerbosity(value: string, previous: number) {
  return previous + 1;
}

const program = new Command();
program.name(packageJson.name);
program.description(packageJson.description);
program.version(packageJson.version);

program
  .option(
    "-a, --auth <token>",
    "(Required) Notion integration token (required, or set NOTION_AUTH_TOKEN in env)",
  )
  .requiredOption(
    "-d, --database-id <id>",
    "(Required) Notion database ID (or set NOTION_DATABASE_ID in env)",
    process.env.NOTION_DATABASE_ID,
  )
  .requiredOption(
    "-t, --title-property-name <name>",
    "(Required) Name of the property containing the event title (or set NOTION_TITLE_PROPERTY_NAME in env)",
    process.env.NOTION_TITLE_PROPERTY_NAME,
  )
  .requiredOption(
    "-e, --date-property-name <name>",
    "(Required) Name of the property containing the event start/end date (or set NOTION_DATE_PROPERTY_NAME in env)",
    process.env.NOTION_DATE_PROPERTY_NAME,
  )
  .option(
    "-s, --desc-property-name <name>",
    "Name of the property containing the event description (or set NOTION_DESC_PROPERTY_NAME in env)",
    process.env.NOTION_DESC_PROPERTY_NAME,
  )
  .option(
    "-f, --fallback-duration <min>",
    "Default duration for events without an end, in minutes (must be a positive integer)",
    "60",
  )
  .option("-i, --ignore-missing-dates", "Ignore events with no date set", false)
  .option(
    "--calendar-name <name>",
    "Name of the calendar to create",
    "Notion Calendar",
  )
  .option(
    "--from-date <date>",
    "Include events starting on or after this date (inclusive). Accepts YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, or full ISO 8601 (e.g., 2025-06-28T14:30:00Z)",
  )
  .option(
    "--until-date <date>",
    "Include events starting on or before this date (inclusive). Accepts YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, or full ISO 8601 (e.g., 2025-06-28T14:30:00Z)",
  )
  .option(
    "-o, --output <file>",
    "Write the generated .ics to a file instead of stdout",
  )
  .option(
    "--incremental",
    "Enable incremental sync (enables --cache-dir and --cache-max-age options)",
    false,
  )
  .option(
    "--cache-dir <path>",
    "Directory to store cached sync state (requires --incremental)",
    defaultCacheDirectory,
  )
  .option(
    "--cache-max-age <sec>",
    "Perform a full resync if the cache is older than this many seconds (requires --incremental, a positive integer in seconds or '0' to disable)",
    "0",
  )
  .option(
    "-v, --verbose",
    "Enable verbose logging (can be used multiple times for more verbosity)",
    increaseVerbosity,
    0,
  )
  .action(async (options) => {
    if (!options.auth) {
      options.auth = process.env.NOTION_AUTH_TOKEN;
      if (!options.auth) {
        program.error(
          "Notion auth token is required. Set NOTION_AUTH_TOKEN in env or use -a option.",
        );
      }
    }
    if (!options.databaseId) {
      program.error(
        "Notion database ID is required. Set NOTION_DATABASE_ID in env or use -d option.",
      );
    }
    if (!options.titlePropertyName) {
      program.error(
        "Title property name is required. Set NOTION_TITLE_PROPERTY_NAME in env or use -t option.",
      );
    }
    if (!options.datePropertyName) {
      program.error(
        "Date property name is required. Set NOTION_DATE_PROPERTY_NAME in env or use -e option.",
      );
    }
    const durationMin = Number.parseInt(options.fallbackDuration, 10);
    if (Number.isNaN(durationMin) || durationMin <= 0) {
      program.error(
        `Invalid fallback duration: ${options.fallbackDuration}. It should be a positive integer in minutes.`,
      );
    }
    if (options.cacheDir !== defaultCacheDirectory && !options.incremental) {
      program.error("State folder option can only be used with --incremental.");
    }
    let maxCacheAgeMs = 0;
    if (options.cacheMaxAge !== "0") {
      if (!options.incremental) {
        program.error(
          "Cache max age option can only be used with --incremental.",
        );
      }
      const maxCacheAgeSec = Number.parseInt(options.cacheMaxAge, 10);
      if (Number.isNaN(maxCacheAgeSec) || maxCacheAgeSec < 0) {
        program.error(
          `Invalid cache max age: ${options.cacheMaxAge}. It should be a non-negative integer in seconds.`,
        );
      }
      maxCacheAgeMs = maxCacheAgeSec * 1000; // Convert seconds to milliseconds
    }

    // Date/time validation: Accept ISO 8601 (date or datetime), or date-only with -, /, .
    const dateOnlyRegex = /^(\d{4})[./-](\d{2})[./-](\d{2})$/;
    const iso8601Regex =
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(:(\d{2}))?(Z|[+-]\d{2}:?\d{2})?$/;
    function isValidDateInput(value: string) {
      return dateOnlyRegex.test(value) || iso8601Regex.test(value);
    }
    if (options.fromDate && !isValidDateInput(options.fromDate)) {
      program.error(
        `Invalid from-date: ${options.fromDate}. Use YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, or ISO 8601 (e.g., 2025-06-28T14:30:00Z).`,
      );
    }
    if (options.untilDate && !isValidDateInput(options.untilDate)) {
      program.error(
        `Invalid until-date: ${options.untilDate}. Use YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, or ISO 8601 (e.g., 2025-06-28T14:30:00Z).`,
      );
    }

    try {
      let level: pino.Level;
      if (options.verbose >= 2) {
        level = "debug";
      } else if (options.verbose === 1) {
        level = "info";
      } else {
        level = "warn";
      }

      let serializers: pino.LoggerOptions["serializers"];
      if (options.verbose < 2) {
        serializers = {
          err(error: Error) {
            return {
              type: error.name,
              message: error.message,
              // hide stack trace in non-debug mode
            };
          },
        };
      }

      const pinoPrettyOptions: PrettyOptions = {
        minimumLevel: level,
        colorize: true,
        levelFirst: true, // Show log level before msg
        translateTime: "HH:MM:ss", // Short human-readable timestamp
        ignore: "pid,hostname", // Remove noise
        singleLine: true, // Easier to scan logs
        messageFormat: "{msg}", // You can customize this
        destination: 2, // Output all logs to stderr
      };

      const logger = pino.pino({
        level,
        serializers,
        transport: {
          target: "pino-pretty",
          options: pinoPrettyOptions,
        },
      });

      let incrementalUpdateStorage:
        | IncrementalStorageFileRepository
        | undefined;
      if (options.incremental) {
        if (!existsSync(options.cacheDir)) {
          mkdirSync(options.cacheDir, { recursive: true });
        }
        incrementalUpdateStorage = new IncrementalStorageFileRepository(
          options.cacheDir,
          maxCacheAgeMs, // Convert seconds to milliseconds
          logger,
        );
      }

      const notionClient = new Client({ auth: options.auth });
      const notionToiCal = new Notion2ICal({
        notionClient,
        logger,
        incrementalUpdateStorage,
        onPageError: (internalLogger, error, page) => {
          if (
            options.ignoreMissingDates &&
            error instanceof Notion2ICalErrors.EmptyDateError
          ) {
            // Ignore empty date errors if the option is set
            internalLogger?.info?.(
              { pageId: page.id },
              "Page Processed: Ignoring empty date",
            );
          } else {
            internalLogger?.warn?.(
              { pageId: page.id, err: error },
              "Page processing failed",
            );
          }
        },
      });

      const ical = await notionToiCal.convert(
        options.databaseId,
        options.titlePropertyName,
        options.datePropertyName,
        options.descPropertyName,
        options.calendarName,
        durationMin * 60 * 1000, // Convert minutes to milliseconds
        options.fromDate,
        options.untilDate,
      );
      if (options.output) {
        writeFileSync(options.output, ical, "utf8");
      } else {
        console.log(ical);
      }
    } catch (error) {
      if (error instanceof Error) {
        program.error(`Error during conversion: ${error.message}`);
      } else {
        throw error;
      }
    }
  })
  .parse(process.argv);
