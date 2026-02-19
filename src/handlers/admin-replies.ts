import { GrammyError, type Bot, type Context } from "grammy"
import type { Logger } from "pino"
import { TopicStore } from "../topic-store"

interface RegisterAdminReplyHandlerOptions {
  adminChatId: number
  botId: number
  topicStore: TopicStore
  logger: Logger
}

const isBlockedByUserError = (error: GrammyError): boolean =>
  error.error_code === 403 &&
  /bot was blocked by the user/i.test(error.description)

const extractRelayCommandText = (text: string): string | null => {
  const match = text.match(
    /^\/(?:r|reply)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]+))?$/,
  )
  if (!match) {
    return null
  }

  return (match[1] ?? "").trim()
}

export const registerAdminReplyHandler = (
  bot: Bot<Context>,
  options: RegisterAdminReplyHandlerOptions,
): void => {
  bot.on("message", async (ctx) => {
    if (!ctx.chat || ctx.chat.id !== options.adminChatId) {
      return
    }

    if (!ctx.msg) {
      return
    }

    if (!ctx.msg.message_thread_id) {
      return
    }

    if (ctx.from?.id === options.botId) {
      return
    }

    const binding = options.topicStore.getByThreadId(ctx.msg.message_thread_id)
    if (!binding) {
      return
    }

    const repliedMessage = ctx.msg.reply_to_message
    if (!repliedMessage) {
      return
    }

    // In forum topics, some messages may carry implicit thread replies.
    // Relay only explicit replies to forwarded user messages.
    if (
      !("forward_origin" in repliedMessage) ||
      !repliedMessage.forward_origin
    ) {
      return
    }

    if (ctx.msg.text) {
      const commandText = extractRelayCommandText(ctx.msg.text)
      if (commandText !== null) {
        if (!commandText) {
          await ctx.api.sendMessage(
            options.adminChatId,
            "Usage: /r <message>",
            {
              message_thread_id: binding.threadId,
            },
          )
          return
        }

        try {
          await ctx.api.sendMessage(binding.userId, commandText)
          return
        } catch (error) {
          if (error instanceof GrammyError && isBlockedByUserError(error)) {
            await ctx.api.sendMessage(
              options.adminChatId,
              "Cannot deliver message: user blocked the bot.",
              {
                message_thread_id: binding.threadId,
              },
            )
            return
          }

          if (error instanceof GrammyError) {
            await ctx.api.sendMessage(
              options.adminChatId,
              `Delivery failed (${error.error_code}): ${error.description}`,
              { message_thread_id: binding.threadId },
            )
            options.logger.error(
              {
                userId: binding.userId,
                threadId: binding.threadId,
                messageId: ctx.msg.message_id,
                errorCode: error.error_code,
                description: error.description,
              },
              "Failed to relay admin /r command",
            )
            return
          }

          throw error
        }
      }
    }

    try {
      await ctx.api.copyMessage(
        binding.userId,
        options.adminChatId,
        ctx.msg.message_id,
      )
    } catch (error) {
      if (error instanceof GrammyError && isBlockedByUserError(error)) {
        await ctx.api.sendMessage(
          options.adminChatId,
          "Cannot deliver message: user blocked the bot.",
          {
            message_thread_id: binding.threadId,
          },
        )

        options.logger.info(
          {
            userId: binding.userId,
            threadId: binding.threadId,
            messageId: ctx.msg.message_id,
          },
          "User blocked the bot; admin reply not delivered",
        )
        return
      }

      if (error instanceof GrammyError) {
        await ctx.api.sendMessage(
          options.adminChatId,
          `Delivery failed (${error.error_code}): ${error.description}`,
          { message_thread_id: binding.threadId },
        )
        options.logger.error(
          {
            userId: binding.userId,
            threadId: binding.threadId,
            messageId: ctx.msg.message_id,
            errorCode: error.error_code,
            description: error.description,
          },
          "Failed to relay admin reply",
        )
        return
      }

      throw error
    }
  })
}
