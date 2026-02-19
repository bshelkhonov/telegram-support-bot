import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SqliteDatabase = Database.Database;

export const initDatabase = (databasePath: string): SqliteDatabase => {
  mkdirSync(dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_topics (
      user_id INTEGER PRIMARY KEY,
      thread_id INTEGER NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      username TEXT,
      topic_title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  return db;
};
