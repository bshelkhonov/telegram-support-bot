import type { SqliteDatabase } from "./db"

interface BotSettingRow {
  value: string
}

const START_GREETING_KEY = "start_greeting"
const FIRST_REPLY_MESSAGE_KEY = "first_reply_message"

export class BotSettingsStore {
  constructor(private readonly db: SqliteDatabase) {}

  getStartGreeting(): string | null {
    const row = this.db
      .prepare("SELECT value FROM bot_settings WHERE key = ?")
      .get(START_GREETING_KEY) as BotSettingRow | undefined

    return row?.value ?? null
  }

  setStartGreeting(value: string): void {
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO bot_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      )
      .run(START_GREETING_KEY, value, now)
  }

  getFirstReplyMessage(): string | null {
    const row = this.db
      .prepare("SELECT value FROM bot_settings WHERE key = ?")
      .get(FIRST_REPLY_MESSAGE_KEY) as BotSettingRow | undefined

    return row?.value ?? null
  }

  setFirstReplyMessage(value: string): void {
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO bot_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      )
      .run(FIRST_REPLY_MESSAGE_KEY, value, now)
  }
}
