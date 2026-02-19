import type { User } from "grammy/types";
import type { Bot } from "grammy";
import type { Logger } from "pino";
import { TopicStore, type UserTopicBinding } from "./topic-store";

const MAX_TOPIC_TITLE_LENGTH = 128;

const buildFullName = (user: User): string => {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ").trim() || `user-${user.id}`;
};

const stripControlCharacters = (value: string): string =>
  Array.from(value)
    .filter((char) => {
      const codePoint = char.codePointAt(0);
      return codePoint === undefined || (codePoint >= 0x20 && codePoint !== 0x7f);
    })
    .join("");

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const truncateByCodePoints = (value: string, maxLength: number): string => {
  const symbols = Array.from(value);
  return symbols.length <= maxLength ? value : symbols.slice(0, maxLength).join("");
};

const buildTopicTitle = (user: User): string => {
  const fullName = normalizeWhitespace(stripControlCharacters(buildFullName(user)));
  const username = user.username ? `@${user.username}` : "@-";
  const title = truncateByCodePoints(`${fullName} | ${username} | ${user.id}`, MAX_TOPIC_TITLE_LENGTH).trim();
  return title || `user-${user.id}`;
};

const buildUserCard = (user: User): string => {
  const fullName = buildFullName(user);
  const username = user.username ? `@${user.username}` : "-";
  const language = user.language_code ?? "-";

  return [
    "New support thread",
    `user_id: ${user.id}`,
    `full_name: ${fullName}`,
    `username: ${username}`,
    `language_code: ${language}`
  ].join("\n");
};

export class TopicService {
  private readonly inFlightEnsures = new Map<number, Promise<UserTopicBinding>>();

  constructor(
    private readonly bot: Bot,
    private readonly adminChatId: number,
    private readonly topicStore: TopicStore,
    private readonly logger: Logger
  ) {}

  async ensureForUser(user: User): Promise<UserTopicBinding> {
    const pending = this.inFlightEnsures.get(user.id);
    if (pending) {
      return pending;
    }

    const operation = this.ensureForUserInternal(user).finally(() => {
      this.inFlightEnsures.delete(user.id);
    });

    this.inFlightEnsures.set(user.id, operation);
    return operation;
  }

  private async ensureForUserInternal(user: User): Promise<UserTopicBinding> {
    const existing = this.topicStore.getByUserId(user.id);
    if (existing) {
      return existing;
    }

    const topicTitle = buildTopicTitle(user);
    const forumTopic = await this.bot.api.createForumTopic(this.adminChatId, topicTitle);

    let binding: UserTopicBinding;
    try {
      binding = this.topicStore.create({
        userId: user.id,
        threadId: forumTopic.message_thread_id,
        fullName: buildFullName(user),
        username: user.username ?? null,
        topicTitle
      });
    } catch (error) {
      const code = error instanceof Error ? (error as { code?: unknown }).code : undefined;
      if (typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")) {
        const createdByAnotherRequest = this.topicStore.getByUserId(user.id);
        if (createdByAnotherRequest) {
          this.logger.warn(
            {
              userId: user.id,
              existingThreadId: createdByAnotherRequest.threadId,
              duplicateThreadId: forumTopic.message_thread_id
            },
            "Detected concurrent topic creation; using existing topic binding"
          );
          return createdByAnotherRequest;
        }
      }
      throw error;
    }

    await this.bot.api.sendMessage(this.adminChatId, buildUserCard(user), {
      message_thread_id: binding.threadId
    });

    this.logger.info(
      {
        userId: binding.userId,
        threadId: binding.threadId,
        topicTitle: binding.topicTitle
      },
      "Created forum topic for user"
    );

    return binding;
  }
}
