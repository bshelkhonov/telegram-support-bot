# Telegram Support Bot

Support bot on TypeScript + grammY.

## What it does

- Replies in private chat to `/start` with:

```text
Hello!

You can contact us using this bot.
```

- Allows selected editors to update `/start` greeting via `/setgreeting` in private chat.
- Allows selected editors to update first-reply confirmation text via `/setfirstreply` in private chat.
- Supports `/cancel` to abort an active editor flow.
- Relays each private user message to an admin forum supergroup topic via forward (non-anonymous).
- Creates one forum topic per user and reuses it for future messages.
- Sends confirmation on the first non-command user message and sends it again only after 24h of chat inactivity.
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
EDITOR_USER_IDS=11111111,22222222
DATABASE_PATH=./data/support-bot.sqlite
LOG_LEVEL=info
```

- `EDITOR_USER_IDS` is a comma-separated list of Telegram `user_id` values allowed to edit greeting text in private chat.

## Install and run

```bash
pnpm install
pnpm run format:check
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
- If a mapped forum topic was deleted, the bot recreates it automatically and retries forwarding.
- Bot sends `Мы зафиксировали ваше обращение. Ответим вам в ближайшее время.` after the first non-command user message.
- The first-reply confirmation is muted for 24 hours after any successful chat activity and appears again after 24+ hours of inactivity.
- Admin-to-user relay works only for messages in `ADMIN_CHAT_ID` with `message_thread_id`.
- Only admin messages that are replies to a forwarded user message in that topic are relayed to the user anonymously.
- Fallback for groups with privacy mode: use `/r <message>` (or `/reply <message>`) as a reply in the user topic.
- If user blocked the bot, the bot posts a warning in that admin topic.
- Bot also handles `my_chat_member` updates and posts user status changes to the user topic in real time.
- Long polling runs with `allowed_updates` including `my_chat_member`.

## Greeting editor commands

- `/setgreeting` works only in private chat and only for `EDITOR_USER_IDS`.
- After `/setgreeting`, send one text message in Russian to save it as the new `/start` greeting.
- `/setfirstreply` works only in private chat and only for `EDITOR_USER_IDS`.
- After `/setfirstreply`, send one text message in Russian to save it as first-reply confirmation text.
- `/cancel` aborts active greeting or first-reply editing flow.

## Data storage

SQLite table `user_topics` keeps mapping:

- `user_id`
- `thread_id`
- `full_name`
- `username`
- `topic_title`
- `created_at`
- `updated_at`

SQLite table `bot_settings` stores bot-level values:

- `key`
- `value`
- `updated_at`

Keys currently used in `bot_settings`:

- `start_greeting`
- `first_reply_message`

SQLite table `user_chat_activity` keeps last chat activity per user:

- `user_id`
- `last_activity_at`
- `updated_at`

Default DB path: `./data/support-bot.sqlite`.

## License

MIT. See `LICENSE`.
