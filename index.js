require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const debug = require('debug')('bot');
const Database = require('better-sqlite3');
const { Parser } = require('expr-eval');
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const ms = require('ms');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'bot.sqlite');
const DEFAULT_PREFIX = '!';

const token = process.env.DISCORD_TOKEN;
const commandPrefix = process.env.COMMAND_PREFIX || DEFAULT_PREFIX;
const statusMessage = process.env.STATUS_MESSAGE || 'Ready to help';

if (!token) {
  console.error(chalk.red('Missing DISCORD_TOKEN in environment. Please set it in your .env file.'));
  process.exit(1);
}

fs.ensureDirSync(DATA_DIR);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const upsertUsage = db.prepare(
  `INSERT INTO command_usage (command, count, last_used)
   VALUES (@command, 1, @lastUsed)
   ON CONFLICT(command) DO UPDATE SET
     count = count + 1,
     last_used = excluded.last_used`
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const parser = new Parser();

const commands = {
  ping: {
    description: 'Responds with bot latency and API ping.',
    async execute(message) {
      const sent = await message.reply({ content: 'Pinging...' });
      const latency = sent.createdTimestamp - message.createdTimestamp;
      await sent.edit(`Pong! Round-trip latency: ${latency}ms. API: ${Math.round(client.ws.ping)}ms.`);
    },
  },
  uptime: {
    description: 'Displays how long the bot process has been running.',
    async execute(message) {
      const uptime = ms(Math.floor(process.uptime() * 1000), { long: true });
      await message.reply(`I have been up for ${uptime}.`);
    },
  },
  math: {
    description: 'Evaluates a math expression. Usage: math <expression>',
    async execute(message, args) {
      if (!args.length) {
        await message.reply('Please provide an expression to evaluate.');
        return;
      }

      const expression = args.join(' ');
      try {
        const result = parser.evaluate(expression);
        await message.reply(`Result: **${result}**`);
      } catch (error) {
        await message.reply('Sorry, I could not evaluate that expression.');
        debug('Math parse error:', error);
      }
    },
  },
  help: {
    description: 'Lists all available commands.',
    async execute(message) {
      const lines = Object.entries(commands).map(
        ([name, meta]) => `${commandPrefix}${name} - ${meta.description}`
      );
      await message.reply(`Here are my commands:\n${lines.join('\n')}`);
    },
  },
};

client.once(Events.ClientReady, (readyClient) => {
  console.log(
    chalk.green(
      `Logged in as ${readyClient.user.tag}. Listening for commands with prefix "${commandPrefix}".`
    )
  );

  readyClient.user.setActivity(statusMessage);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(commandPrefix)) {
    return;
  }

  const withoutPrefix = message.content.slice(commandPrefix.length).trim();
  const [commandName, ...args] = withoutPrefix.split(/\s+/);
  const command = commands[commandName?.toLowerCase()];

  if (!command) {
    return;
  }

  const lastUsed = new Date().toISOString();
  upsertUsage.run({ command: commandName.toLowerCase(), lastUsed });

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(chalk.red('Command failed'), error);
    await message.reply('Something went wrong while running that command.');
  }
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('Shutting down gracefully...'));
  db.close();
  client.destroy();
  process.exit(0);
});

client.login(token);
