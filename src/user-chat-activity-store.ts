import type { SqliteDatabase } from "./db"

interface UserChatActivityRow {
  last_activity_at: string
}

const INACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000

export class UserChatActivityStore {
  constructor(private readonly db: SqliteDatabase) {}

  getLastActivityAt(userId: number): string | null {
    const row = this.db
      .prepare(
        "SELECT last_activity_at FROM user_chat_activity WHERE user_id = ?",
      )
      .get(userId) as UserChatActivityRow | undefined

    return row?.last_activity_at ?? null
  }

  touch(userId: number, at: Date = new Date()): void {
    const now = at.toISOString()

    this.db
      .prepare(
        `
        INSERT INTO user_chat_activity (user_id, last_activity_at, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          last_activity_at = excluded.last_activity_at,
          updated_at = excluded.updated_at
      `,
      )
      .run(userId, now, now)
  }

  isInactiveFor24h(userId: number, now: Date = new Date()): boolean {
    const lastActivityAt = this.getLastActivityAt(userId)
    if (!lastActivityAt) {
      return true
    }

    const lastActivityAtMs = Date.parse(lastActivityAt)
    if (Number.isNaN(lastActivityAtMs)) {
      return true
    }

    return now.getTime() - lastActivityAtMs >= INACTIVITY_WINDOW_MS
  }
}
