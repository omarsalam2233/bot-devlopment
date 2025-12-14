# Discord Bot Starter

A multipurpose Discord bot built with [discord.js](https://discord.js.org/) and SQLite for lightweight persistence. The bot comes with a handful of ready-to-use prefix commands and a simple migration script to prepare the database.

## Features
- Prefix-based commands (configurable via `.env`).
- Commands: `ping`, `uptime`, `math <expression>`, and `help`.
- SQLite-backed command usage tracking.
- Graceful shutdown handling and status presence support.

## Setup
1. Copy the example environment file and fill in your bot token:
   ```bash
   cp .env.example .env
   # Open .env and set DISCORD_TOKEN plus any overrides
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run migrations and start the bot:
   ```bash
   npm run prestart
   npm start
   ```

## Environment variables
- `DISCORD_TOKEN` (required): Your Discord bot token.
- `COMMAND_PREFIX` (optional): Message prefix for commands. Defaults to `!`.
- `STATUS_MESSAGE` (optional): Custom status text displayed by the bot.

## Available commands
- `ping`: Replies with round-trip latency and API ping.
- `uptime`: Shows how long the process has been running.
- `math <expression>`: Evaluates math expressions using `expr-eval`.
- `help`: Lists all available commands and their descriptions.

## Notes
- The bot stores data in `data/bot.sqlite`. The `data` directory is created automatically.
- Use `Ctrl+C` to stop the bot gracefully; it will close the database connection before exiting.
