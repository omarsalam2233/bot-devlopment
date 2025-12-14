const path = require('path');
const fs = require('fs-extra');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'bot.sqlite');

async function run() {
  await fs.ensureDir(DATA_DIR);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.prepare(
    `CREATE TABLE IF NOT EXISTS command_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT UNIQUE NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      last_used TEXT
    )`
  ).run();

  db.close();
  console.log(`Database is ready at ${DB_PATH}`);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
