# Savanna job bot

Telegram bot for Ethiopian job alerts. It scrapes EthioJobs, GeezJobs, HaHu Jobs, Ezega, EmployEthiopia, and Ethiopian Reporter Jobs, then messages subscribers about new listings about every 2 hours.

The subscriber list, seen links, and translation cache stay in `bot.db` in this folder. A database created by the earlier Python bot is read as-is.

Supported languages: Amharic, English, Afaan Oromo, Arabic, Somali, and Tigrinya.

Access modes:

- Standard: a short text list
- Blind / low vision: plain text, plus a voice message
- Deaf / hard of hearing: short visual cards, and no audio

Voice uses Addis Voices for Amharic, Afaan Oromo, Tigrinya, and Somali. English and Arabic use Edge TTS. If Addis is missing, Amharic and Somali fall back to Edge, and Oromo and Tigrinya are read in English.

## Technologies

- Node.js 22.5 or newer, ES modules
- [Telegraf](https://telegraf.js.org/) for the Telegram Bot API
- Playwright Firefox for the job pages
- `node:sqlite` for `bot.db`
- `dotenv` for environment variables
- Google Translate, with optional offline NLLB when `@huggingface/transformers` is installed

## Create a bot with BotFather

1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts.
3. Copy the token BotFather gives you. Treat it like a password.

## Configure `.env`

From this folder:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Put the token in `.env`:

```env
BOT_TOKEN=123456789:the-token-from-botfather
```

The token is not written in source code. `.env` is listed in `.gitignore`.

`ADDIS_API_KEY` turns on Addis Voices. Leave it empty to use the Edge fallback described above.

`TRANSLATOR=auto` uses offline NLLB when the optional package is installed, then Google Translate. `TRANSLATOR=google` skips NLLB. Translations are stored in `bot.db`.

## Install and run

```bash
npm install
npx playwright install firefox
npm start
```

Development, with a restart when files change:

```bash
npm run dev
```

The process uses long polling. Messages sent while it was offline are picked up on startup, up to Telegram's 24 hour limit. Stop it with Ctrl+C.

Test the scrapers without starting Telegram:

```bash
npm run scrape
npm run scrape -- geez
```

Warm up translation:

```bash
npm start -- --warmup
```

Unit tests:

```bash
npm test
```

Optional offline translation model:

```bash
npm install @huggingface/transformers
```

The first NLLB run downloads a large model file.

## Commands

| Command | Action |
| --- | --- |
| `/start` | Choose a language, access mode, and job types |
| `/language` | Change language |
| `/mode` | Standard, blind / low vision, or deaf / hard of hearing |
| `/categories` | Choose job types |
| `/jobs` | Show the latest matching jobs now |
| `/linkedin` | LinkedIn search links for Ethiopia |
| `/help` | List the commands |
| `/stop` | Unsubscribe |
