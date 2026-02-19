# Telegram Support Bot

Support bot on TypeScript + grammY.

## What it does

- Replies in private chat to `/start` with:

```text
Hello!

You can contact us using this bot.
```

- Relays each private user message to an admin forum supergroup topic via forward (non-anonymous).
- Creates one forum topic per user and reuses it for future messages.
- Relays admin replies back to the user anonymously (only when admin replies to a bot message in that topic).

## Requirements

- Node.js 20+
- pnpm (for example via `corepack enable`)
- Telegram bot token
- Telegram forum supergroup with topics enabled
- Bot added to the admin group with rights to create topics and send messages

## Configuration

Copy `.env.example` to `.env` and set values:

```env
BOT_TOKEN=123456789:your_bot_token
ADMIN_CHAT_ID=-1001234567890
DATABASE_PATH=./data/support-bot.sqlite
LOG_LEVEL=info
```

## Install and run

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run dev
```

Or run compiled build:

```bash
pnpm run start
```

## Troubleshooting

If you see `Could not locate the bindings file` for `better-sqlite3`, run:

```bash
pnpm rebuild better-sqlite3
```

## Relay rules

- Private user messages are forwarded to admin forum topic (non-anonymous).
- Admin-to-user relay works only for messages in `ADMIN_CHAT_ID` with `message_thread_id`.
- Only admin messages that are replies to a forwarded user message in that topic are relayed to the user anonymously.
- Fallback for groups with privacy mode: use `/r <message>` (or `/reply <message>`) as a reply in the user topic.
- If user blocked the bot, the bot posts a warning in that admin topic.

## Data storage

SQLite table `user_topics` keeps mapping:

- `user_id`
- `thread_id`
- `full_name`
- `username`
- `topic_title`
- `created_at`
- `updated_at`

Default DB path: `./data/support-bot.sqlite`.
