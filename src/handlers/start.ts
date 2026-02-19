import type { Bot, Context } from "grammy"
import { BotSettingsStore } from "../bot-settings-store"
import { UserChatActivityStore } from "../user-chat-activity-store"

const DEFAULT_START_MESSAGE = "Hello!\n\nYou can contact us using this bot."

interface RegisterStartHandlerOptions {
  settingsStore: BotSettingsStore
  chatActivityStore: UserChatActivityStore
}

export const registerStartHandler = (
  bot: Bot<Context>,
  options: RegisterStartHandlerOptions,
): void => {
  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private") {
      return
    }

    const greeting =
      options.settingsStore.getStartGreeting() ?? DEFAULT_START_MESSAGE
    await ctx.reply(greeting)

    if (ctx.from) {
      options.chatActivityStore.touch(ctx.from.id)
    }
  })
}
