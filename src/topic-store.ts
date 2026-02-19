import type { SqliteDatabase } from "./db";

export interface UserTopicBinding {
  userId: number;
  threadId: number;
  fullName: string;
  username: string | null;
  topicTitle: string;
  createdAt: string;
  updatedAt: string;
}

interface NewUserTopicBinding {
  userId: number;
  threadId: number;
  fullName: string;
  username: string | null;
  topicTitle: string;
}

interface UserTopicRow {
  user_id: number;
  thread_id: number;
  full_name: string;
  username: string | null;
  topic_title: string;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: UserTopicRow): UserTopicBinding => ({
  userId: row.user_id,
  threadId: row.thread_id,
  fullName: row.full_name,
  username: row.username,
  topicTitle: row.topic_title,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class TopicStore {
  constructor(private readonly db: SqliteDatabase) {}

  getByUserId(userId: number): UserTopicBinding | null {
    const row = this.db
      .prepare("SELECT * FROM user_topics WHERE user_id = ?")
      .get(userId) as UserTopicRow | undefined;

    return row ? mapRow(row) : null;
  }

  getByThreadId(threadId: number): UserTopicBinding | null {
    const row = this.db
      .prepare("SELECT * FROM user_topics WHERE thread_id = ?")
      .get(threadId) as UserTopicRow | undefined;

    return row ? mapRow(row) : null;
  }

  create(binding: NewUserTopicBinding): UserTopicBinding {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO user_topics (
          user_id,
          thread_id,
          full_name,
          username,
          topic_title,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        binding.userId,
        binding.threadId,
        binding.fullName,
        binding.username,
        binding.topicTitle,
        now,
        now
      );

    return {
      ...binding,
      createdAt: now,
      updatedAt: now
    };
  }
}
