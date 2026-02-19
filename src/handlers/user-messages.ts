import { GrammyError, type Bot, type Context } from "grammy"
import type { Logger } from "pino"
import { TopicService } from "../topic-service"

interface RegisterUserMessageHandlerOptions {
  adminChatId: number
  topicService: TopicService
  logger: Logger
}

const isMissingTopicError = (error: GrammyError): boolean =>
  error.error_code === 400 &&
  /message thread|topic.*not found|thread.*not found/i.test(error.description)

export const registerUserMessageHandler = (
  bot: Bot<Context>,
  options: RegisterUserMessageHandlerOptions,
): void => {
  bot.on("message", async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      await next()
      return
    }

    if (!ctx.from || !ctx.msg) {
      return
    }

    const forwardToThread = async (threadId: number): Promise<void> => {
      await ctx.api.forwardMessage(
        options.adminChatId,
        ctx.chat.id,
        ctx.msg.message_id,
        {
          message_thread_id: threadId,
        },
      )
    }

    try {
      const binding = await options.topicService.ensureForUser(ctx.from)

      try {
        await forwardToThread(binding.threadId)
        return
      } catch (error) {
        if (error instanceof GrammyError && isMissingTopicError(error)) {
          options.logger.warn(
            {
              userId: ctx.from.id,
              chatId: ctx.chat.id,
              messageId: ctx.msg.message_id,
              staleThreadId: binding.threadId,
              errorCode: error.error_code,
              description: error.description,
            },
            "Topic is missing; recreating and retrying user message relay",
          )

          const recreatedBinding = await options.topicService.recreateForUser(
            ctx.from,
          )
          await forwardToThread(recreatedBinding.threadId)

          options.logger.info(
            {
              userId: ctx.from.id,
              chatId: ctx.chat.id,
              messageId: ctx.msg.message_id,
              oldThreadId: binding.threadId,
              newThreadId: recreatedBinding.threadId,
            },
            "Relayed user message after topic recreation",
          )
          return
        }

        throw error
      }
    } catch (error) {
      if (error instanceof GrammyError) {
        options.logger.warn(
          {
            userId: ctx.from.id,
            chatId: ctx.chat.id,
            messageId: ctx.msg.message_id,
            errorCode: error.error_code,
            description: error.description,
          },
          "Failed to relay user message",
        )
        return
      }

      throw error
    }
  })
}
