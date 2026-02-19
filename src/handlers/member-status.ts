import { GrammyError, type Bot, type Context } from "grammy"
import type { Logger } from "pino"
import { TopicStore } from "../topic-store"

interface RegisterMemberStatusHandlerOptions {
  adminChatId: number
  topicStore: TopicStore
  logger: Logger
}

const formatUserLabel = (fullName: string, username: string | null): string =>
  username ? `${fullName} (@${username})` : fullName

const buildStatusMessage = (
  userLabel: string,
  oldStatus: string,
  newStatus: string,
): string => {
  if (oldStatus !== "kicked" && newStatus === "kicked") {
    return `${userLabel} заблокировал(а) бота. Пока пользователь не разблокирует бота, отправлять ему сообщения нельзя.`
  }

  if (oldStatus === "kicked" && newStatus !== "kicked") {
    return `${userLabel} снова на связи: бот больше не заблокирован, сообщения снова доставляются.`
  }

  return `У пользователя ${userLabel} изменился статус в чате с ботом: ${oldStatus} -> ${newStatus}.`
}

export const registerMemberStatusHandler = (
  bot: Bot<Context>,
  options: RegisterMemberStatusHandlerOptions,
): void => {
  bot.on("my_chat_member", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.myChatMember) {
      return
    }

    const userId = ctx.chat.id
    const oldStatus = ctx.myChatMember.old_chat_member.status
    const newStatus = ctx.myChatMember.new_chat_member.status
    const binding = options.topicStore.getByUserId(userId)

    if (!binding) {
      options.logger.info(
        {
          updateId: ctx.update.update_id,
          userId,
          oldStatus,
          newStatus,
        },
        "Skipping my_chat_member notification: user has no topic binding",
      )
      return
    }

    try {
      await ctx.api.sendMessage(
        options.adminChatId,
        buildStatusMessage(
          formatUserLabel(binding.fullName, binding.username),
          oldStatus,
          newStatus,
        ),
        { message_thread_id: binding.threadId },
      )
    } catch (error) {
      if (error instanceof GrammyError) {
        options.logger.error(
          {
            updateId: ctx.update.update_id,
            userId,
            threadId: binding.threadId,
            oldStatus,
            newStatus,
            errorCode: error.error_code,
            description: error.description,
          },
          "Failed to post my_chat_member status update to topic",
        )
        return
      }

      options.logger.error(
        {
          updateId: ctx.update.update_id,
          userId,
          threadId: binding.threadId,
          oldStatus,
          newStatus,
          err: error,
        },
        "Unexpected failure while posting my_chat_member status update",
      )
    }
  })
}
