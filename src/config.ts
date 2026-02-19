import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

export interface EnvConfig {
  botToken: string;
  adminChatId: number;
  databasePath: string;
  logLevel: string;
}

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  ADMIN_CHAT_ID: z
    .string()
    .min(1, "ADMIN_CHAT_ID is required")
    .refine((value) => /^-?\d+$/.test(value), "ADMIN_CHAT_ID must be an integer")
    .transform((value) => Number.parseInt(value, 10)),
  DATABASE_PATH: z.string().default("./data/support-bot.sqlite"),
  LOG_LEVEL: z.string().default("info")
});

export const loadConfig = (): EnvConfig => {
  loadDotEnv({ quiet: true });

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  return {
    botToken: parsed.data.BOT_TOKEN,
    adminChatId: parsed.data.ADMIN_CHAT_ID,
    databasePath: parsed.data.DATABASE_PATH,
    logLevel: parsed.data.LOG_LEVEL
  };
};
