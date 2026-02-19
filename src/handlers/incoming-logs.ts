import type { Bot, Context } from "grammy";
import type { Logger } from "pino";

interface RegisterIncomingLogsHandlerOptions {
  logger: Logger;
}

const extractCommand = (ctx: Context): string | null => {
  const text = ctx.msg?.text;
  if (!text) {
    return null;
  }

  const match = text.match(/^\/\S+/);
  return match?.[0] ?? null;
};

export const registerIncomingLogsHandler = (
  bot: Bot<Context>,
  options: RegisterIncomingLogsHandlerOptions
): void => {
  bot.use(async (ctx, next) => {
    if (ctx.msg) {
      options.logger.info(
        {
          updateId: ctx.update.update_id,
          messageId: ctx.msg.message_id,
          fromId: ctx.from?.id,
          fromUsername: ctx.from?.username ?? null,
          chatId: ctx.chat?.id,
          chatType: ctx.chat?.type,
          text: ctx.msg.text ?? null,
          caption: ctx.msg.caption ?? null,
          command: extractCommand(ctx)
        },
        "Incoming message"
      );
    }

    await next();
  });
};
