import type { Bot, Context } from "grammy";

const START_MESSAGE = "Hello!\n\nYou can contact us using this bot.";

export const registerStartHandler = (bot: Bot<Context>): void => {
  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private") {
      return;
    }

    await ctx.reply(START_MESSAGE);
  });
};
