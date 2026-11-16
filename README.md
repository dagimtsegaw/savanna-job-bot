# Savanna job bot

Telegram bot for Ethiopian jobs. It scrapes EthioJobs, GeezJobs, HaHu Jobs, Ezega, EmployEthiopia, and Ethiopian Reporter Jobs when you use `/jobs` or tap the inline **Refresh** button; it does not fetch jobs automatically.

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
- Google Translate, then Addis AI for Amharic, Afaan Oromo, and Tigrinya when Google fails. Optional offline NLLB when `@huggingface/transformers` is installed

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

`TRANSLATOR=auto` uses offline NLLB when the optional package is installed, then Google Translate. `TRANSLATOR=google` skips NLLB. If Google fails, Amharic, Afaan Oromo, and Tigrinya are translated with Addis AI. That needs `ADDIS_API_KEY` on the machine that runs the bot, including the Render service. Translations are stored in `bot.db`.

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

## Deploy on Render

The failed deploy had two separate causes.

Render was running a web service. A web service has to accept HTTP on `PORT`. This bot talks to Telegram with long polling, so nothing was listening. The port scan timed out and Render stopped the process. On startup the bot now listens on `PORT` when Render sets it, and answers `ok`.

Firefox was missing at runtime. `npm install` puts the browser in `/opt/render/.cache`. That directory is the build cache, and it is not part of the running service. The `Dockerfile` uses `mcr.microsoft.com/playwright:v1.65.1-noble`, which already contains Firefox and the system libraries it needs. The `playwright` dependency is pinned to `1.65.1` so it looks for the same Firefox build as that image.

On the service that produced this log:

1. Push this repo and redeploy. The bot stays up, because it binds to `PORT`.
2. In the Render dashboard, open the service, then Settings, and set the runtime to Docker. Render builds the `Dockerfile`. Leave the start command as `npm start`.
3. Confirm `BOT_TOKEN` is set, and deploy again.

A native Node deploy cannot start Firefox. The bot then reads the listing pages directly, including the jobs EthioJobs and GeezJobs embed in the page. Set the runtime to Docker when you want the browser scrape as well.

A free web service sleeps after about 15 minutes without an incoming request. Long polling does not create one. When Render sets `RENDER_EXTERNAL_URL`, the process requests that URL every 10 minutes so the service stays awake.

`bot.db` is stored on the service disk. A redeploy starts from a fresh disk, so subscribers and the translation cache disappear unless you attach a Render disk and set `DB_PATH` to a file on that disk.

Run one service for this token. A second web service or worker using the same `BOT_TOKEN` makes Telegram reject updates.

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
