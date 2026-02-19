import { config as loadDotEnv } from "dotenv"
import { z } from "zod"

export interface EnvConfig {
  botToken: string
  adminChatId: number
  editorUserIds: number[]
  databasePath: string
  logLevel: string
}

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  ADMIN_CHAT_ID: z
    .string()
    .min(1, "ADMIN_CHAT_ID is required")
    .refine(
      (value) => /^-?\d+$/.test(value),
      "ADMIN_CHAT_ID must be an integer",
    )
    .transform((value) => Number.parseInt(value, 10)),
  EDITOR_USER_IDS: z
    .string()
    .min(1, "EDITOR_USER_IDS is required")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .refine(
      (value) => value.length > 0,
      "EDITOR_USER_IDS must contain at least one integer",
    )
    .refine(
      (value) => value.every((item) => /^-?\d+$/.test(item)),
      "EDITOR_USER_IDS must be a comma-separated list of integers",
    )
    .transform((value) =>
      Array.from(new Set(value.map((item) => Number.parseInt(item, 10)))),
    ),
  DATABASE_PATH: z.string().default("./data/support-bot.sqlite"),
  LOG_LEVEL: z.string().default("info"),
})

export const loadConfig = (): EnvConfig => {
  loadDotEnv({ quiet: true })

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ")
    throw new Error(`Invalid environment configuration: ${message}`)
  }

  return {
    botToken: parsed.data.BOT_TOKEN,
    adminChatId: parsed.data.ADMIN_CHAT_ID,
    editorUserIds: parsed.data.EDITOR_USER_IDS,
    databasePath: parsed.data.DATABASE_PATH,
    logLevel: parsed.data.LOG_LEVEL,
  }
}
