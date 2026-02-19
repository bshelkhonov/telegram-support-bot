import type { Bot, Context } from "grammy"
import { BotSettingsStore } from "../bot-settings-store"

interface RegisterGreetingEditorHandlerOptions {
  editorUserIds: number[]
  settingsStore: BotSettingsStore
}

const NO_RIGHTS_MESSAGE = "Недостаточно прав для этой команды."

export const registerGreetingEditorHandler = (
  bot: Bot<Context>,
  options: RegisterGreetingEditorHandlerOptions,
): void => {
  const editorUserIds = new Set(options.editorUserIds)
  const pendingEditors = new Set<number>()

  const canEditGreeting = (userId: number): boolean => editorUserIds.has(userId)

  bot.command("setgreeting", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      return
    }

    if (!canEditGreeting(ctx.from.id)) {
      await ctx.reply(NO_RIGHTS_MESSAGE)
      return
    }

    pendingEditors.add(ctx.from.id)
    await ctx.reply(
      "Отправьте новое стартовое сообщение на русском.\n\nЧтобы отменить настройку, отправьте /cancel.",
    )
  })

  bot.command("cancel", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      return
    }

    if (!canEditGreeting(ctx.from.id)) {
      await ctx.reply(NO_RIGHTS_MESSAGE)
      return
    }

    if (!pendingEditors.has(ctx.from.id)) {
      await ctx.reply("Нет активной настройки стартового сообщения.")
      return
    }

    pendingEditors.delete(ctx.from.id)
    await ctx.reply("Настройка стартового сообщения отменена.")
  })

  bot.on("message", async (ctx, next) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      await next()
      return
    }

    if (!canEditGreeting(ctx.from.id) || !pendingEditors.has(ctx.from.id)) {
      await next()
      return
    }

    if (!ctx.msg?.text) {
      await ctx.reply("Отправьте текстовое сообщение или /cancel.")
      return
    }

    options.settingsStore.setStartGreeting(ctx.msg.text)
    pendingEditors.delete(ctx.from.id)

    await ctx.reply("Стартовое сообщение обновлено.")
  })
}
