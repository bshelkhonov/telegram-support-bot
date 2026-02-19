import { Bot, GrammyError, HttpError } from "grammy"
import { BotSettingsStore } from "./bot-settings-store"
import { loadConfig } from "./config"
import { initDatabase } from "./db"
import { registerAdminReplyHandler } from "./handlers/admin-replies"
import { registerGreetingEditorHandler } from "./handlers/greeting-editor"
import { registerIncomingLogsHandler } from "./handlers/incoming-logs"
import { registerMemberStatusHandler } from "./handlers/member-status"
import { registerStartHandler } from "./handlers/start"
import { registerUserMessageHandler } from "./handlers/user-messages"
import { createLogger } from "./logger"
import { TopicService } from "./topic-service"
import { TopicStore } from "./topic-store"
import { UserChatActivityStore } from "./user-chat-activity-store"

const bootstrap = async (): Promise<void> => {
  const config = loadConfig()
  const logger = createLogger(config.logLevel)
  const db = initDatabase(config.databasePath)

  const bot = new Bot(config.botToken)
  const me = await bot.api.getMe()

  const settingsStore = new BotSettingsStore(db)
  const topicStore = new TopicStore(db)
  const chatActivityStore = new UserChatActivityStore(db)
  const topicService = new TopicService(
    bot,
    config.adminChatId,
    topicStore,
    logger,
  )

  registerIncomingLogsHandler(bot, { logger })
  registerMemberStatusHandler(bot, {
    adminChatId: config.adminChatId,
    topicStore,
    logger,
  })
  registerStartHandler(bot, { settingsStore, chatActivityStore })
  registerGreetingEditorHandler(bot, {
    editorUserIds: config.editorUserIds,
    settingsStore,
  })
  registerUserMessageHandler(bot, {
    adminChatId: config.adminChatId,
    topicService,
    settingsStore,
    chatActivityStore,
    logger,
  })
  registerAdminReplyHandler(bot, {
    adminChatId: config.adminChatId,
    botId: me.id,
    topicStore,
    chatActivityStore,
    logger,
  })

  bot.catch((error) => {
    const ctx = error.ctx
    const err = error.error

    if (err instanceof GrammyError) {
      logger.error(
        {
          updateId: ctx.update.update_id,
          errorCode: err.error_code,
          description: err.description,
        },
        "Unhandled Telegram API error",
      )
      return
    }

    if (err instanceof HttpError) {
      logger.error(
        { updateId: ctx.update.update_id, message: err.message },
        "Unhandled HTTP error",
      )
      return
    }

    logger.error({ updateId: ctx.update.update_id, err }, "Unhandled bot error")
  })

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down bot")
    await bot.stop()
    db.close()
    process.exit(0)
  }

  process.once("SIGINT", () => {
    void shutdown("SIGINT")
  })
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM")
  })

  await bot.start({
    allowed_updates: ["message", "my_chat_member"],
    onStart: () => {
      logger.info(
        { botId: me.id, username: me.username },
        "Bot started in long polling mode",
      )
    },
  })
}

bootstrap().catch((error) => {
  console.error("Fatal bootstrap error", error)
  process.exit(1)
})
