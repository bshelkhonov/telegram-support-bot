import { GrammyError, type Bot, type Context } from "grammy";
import type { Logger } from "pino";
import { TopicService } from "../topic-service";

interface RegisterUserMessageHandlerOptions {
  adminChatId: number;
  topicService: TopicService;
  logger: Logger;
}

export const registerUserMessageHandler = (
  bot: Bot<Context>,
  options: RegisterUserMessageHandlerOptions
): void => {
  bot.on("message", async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      await next();
      return;
    }

    if (!ctx.from || !ctx.msg) {
      return;
    }

    try {
      const binding = await options.topicService.ensureForUser(ctx.from);

      await ctx.api.forwardMessage(options.adminChatId, ctx.chat.id, ctx.msg.message_id, {
        message_thread_id: binding.threadId
      });
    } catch (error) {
      if (error instanceof GrammyError) {
        options.logger.warn(
          {
            userId: ctx.from.id,
            chatId: ctx.chat.id,
            messageId: ctx.msg.message_id,
            errorCode: error.error_code,
            description: error.description
          },
          "Failed to relay user message"
        );
        return;
      }

      throw error;
    }
  });
};
