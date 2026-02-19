import { GrammyError, type Bot, type Context } from "grammy"
import type { Logger } from "pino"
import { BotSettingsStore } from "../bot-settings-store"
import { TopicService } from "../topic-service"
import { UserChatActivityStore } from "../user-chat-activity-store"

interface RegisterUserMessageHandlerOptions {
  adminChatId: number
  topicService: TopicService
  settingsStore: BotSettingsStore
  chatActivityStore: UserChatActivityStore
  logger: Logger
}

const DEFAULT_FIRST_REPLY_MESSAGE =
  "Мы зафиксировали ваше обращение. Ответим вам в ближайшее время."
const COMMAND_PATTERN = /^\/[A-Za-z0-9_]+(?:@[A-Za-z0-9_]+)?(?:\s|$)/

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

    const isCommand =
      typeof ctx.msg.text === "string" && COMMAND_PATTERN.test(ctx.msg.text)
    const shouldSendFirstReply =
      !isCommand && options.chatActivityStore.isInactiveFor24h(ctx.from.id)

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
        } else {
          throw error
        }
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

    options.chatActivityStore.touch(ctx.from.id)

    if (!shouldSendFirstReply) {
      return
    }

    const firstReplyMessage =
      options.settingsStore.getFirstReplyMessage() ??
      DEFAULT_FIRST_REPLY_MESSAGE

    try {
      await ctx.api.sendMessage(ctx.chat.id, firstReplyMessage)
      options.chatActivityStore.touch(ctx.from.id)
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
          "Failed to send first-reply confirmation message",
        )
        return
      }

      throw error
    }
  })
}
