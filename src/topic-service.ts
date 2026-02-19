import type { User } from "grammy/types";
import type { Bot } from "grammy";
import type { Logger } from "pino";
import { TopicStore, type UserTopicBinding } from "./topic-store";

const buildFullName = (user: User): string => {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ").trim() || `user-${user.id}`;
};

const buildTopicTitle = (user: User): string => {
  const fullName = buildFullName(user);
  const username = user.username ? `@${user.username}` : "@-";
  return `${fullName} | ${username} | ${user.id}`;
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
  constructor(
    private readonly bot: Bot,
    private readonly adminChatId: number,
    private readonly topicStore: TopicStore,
    private readonly logger: Logger
  ) {}

  async ensureForUser(user: User): Promise<UserTopicBinding> {
    const existing = this.topicStore.getByUserId(user.id);
    if (existing) {
      return existing;
    }

    const topicTitle = buildTopicTitle(user);
    const forumTopic = await this.bot.api.createForumTopic(this.adminChatId, topicTitle);

    const binding = this.topicStore.create({
      userId: user.id,
      threadId: forumTopic.message_thread_id,
      fullName: buildFullName(user),
      username: user.username ?? null,
      topicTitle
    });

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
