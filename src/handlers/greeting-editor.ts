import type { Bot, Context } from "grammy"
import { BotSettingsStore } from "../bot-settings-store"

interface RegisterGreetingEditorHandlerOptions {
  editorUserIds: number[]
  settingsStore: BotSettingsStore
}

type PendingEditorMode = "start_greeting" | "first_reply"

const NO_RIGHTS_MESSAGE = "Недостаточно прав для этой команды."
const SEND_TEXT_OR_CANCEL_MESSAGE = "Отправьте текстовое сообщение или /cancel."
const NO_ACTIVE_EDITING_MESSAGE = "Нет активной настройки."

const SET_START_GREETING_PROMPT =
  "Отправьте новое стартовое сообщение на русском.\n\nЧтобы отменить настройку, отправьте /cancel."
const SET_START_GREETING_SUCCESS = "Стартовое сообщение обновлено."
const CANCEL_START_GREETING_SUCCESS = "Настройка стартового сообщения отменена."

const SET_FIRST_REPLY_PROMPT =
  "Отправьте новый текст подтверждения первого обращения.\n\nЧтобы отменить настройку, отправьте /cancel."
const SET_FIRST_REPLY_SUCCESS =
  "Текст подтверждения первого обращения обновлен."
const CANCEL_FIRST_REPLY_SUCCESS =
  "Настройка текста подтверждения первого обращения отменена."

export const registerGreetingEditorHandler = (
  bot: Bot<Context>,
  options: RegisterGreetingEditorHandlerOptions,
): void => {
  const editorUserIds = new Set(options.editorUserIds)
  const pendingEditors = new Map<number, PendingEditorMode>()

  const canEditGreeting = (userId: number): boolean => editorUserIds.has(userId)

  bot.command("setgreeting", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      return
    }

    if (!canEditGreeting(ctx.from.id)) {
      await ctx.reply(NO_RIGHTS_MESSAGE)
      return
    }

    pendingEditors.set(ctx.from.id, "start_greeting")
    await ctx.reply(SET_START_GREETING_PROMPT)
  })

  bot.command("setfirstreply", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      return
    }

    if (!canEditGreeting(ctx.from.id)) {
      await ctx.reply(NO_RIGHTS_MESSAGE)
      return
    }

    pendingEditors.set(ctx.from.id, "first_reply")
    await ctx.reply(SET_FIRST_REPLY_PROMPT)
  })

  bot.command("cancel", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      return
    }

    if (!canEditGreeting(ctx.from.id)) {
      await ctx.reply(NO_RIGHTS_MESSAGE)
      return
    }

    const activeMode = pendingEditors.get(ctx.from.id)
    if (!activeMode) {
      await ctx.reply(NO_ACTIVE_EDITING_MESSAGE)
      return
    }

    pendingEditors.delete(ctx.from.id)
    await ctx.reply(
      activeMode === "start_greeting"
        ? CANCEL_START_GREETING_SUCCESS
        : CANCEL_FIRST_REPLY_SUCCESS,
    )
  })

  bot.on("message", async (ctx, next) => {
    if (ctx.chat?.type !== "private" || !ctx.from) {
      await next()
      return
    }

    const activeMode = pendingEditors.get(ctx.from.id)
    if (!canEditGreeting(ctx.from.id) || !activeMode) {
      await next()
      return
    }

    if (!ctx.msg?.text) {
      await ctx.reply(SEND_TEXT_OR_CANCEL_MESSAGE)
      return
    }

    if (activeMode === "start_greeting") {
      options.settingsStore.setStartGreeting(ctx.msg.text)
    } else {
      options.settingsStore.setFirstReplyMessage(ctx.msg.text)
    }

    pendingEditors.delete(ctx.from.id)

    await ctx.reply(
      activeMode === "start_greeting"
        ? SET_START_GREETING_SUCCESS
        : SET_FIRST_REPLY_SUCCESS,
    )
  })
}
