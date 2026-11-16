import https from 'node:https';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Telegraf } from 'telegraf';
import { config, validateStartupConfig } from './config.js';
import { HELP, NLLB_CODES, SOURCES } from './data/catalog.js';
import { openDatabase, useDatabase } from './db.js';
import { registerCallbacks } from './handlers/callbacks.js';
import { registerCommands } from './handlers/commands.js';
import { broadcast } from './services/broadcast.js';
import { fetchAll } from './services/scraper.js';
import { tr } from './services/translate.js';
import { safeError } from './utils/safeLog.js';

function telegramAgent() {
  return new https.Agent({ family: 4, keepAlive: true, timeout: 30_000 });
}

export function createBot(token = config.botToken) {
  const bot = new Telegraf(token, {
    handlerTimeout: 10 * 60 * 1000,
    telegram: {
      agent: telegramAgent(),
      attachmentAgent: telegramAgent(),
    },
  });
  registerCommands(bot);
  registerCallbacks(bot);
  bot.catch((error) => {
    console.error(`[jobbot] Handler error: ${safeError(error)}`);
  });
  return bot;
}

export function parseArgs(argv) {
  const testAt = argv.indexOf('--test');
  if (testAt !== -1) {
    const next = argv[testAt + 1];
    const name = next && !next.startsWith('--') ? next.toLowerCase() : '';
    return { command: 'test', name };
  }
  if (argv.includes('--warmup')) {
    return { command: 'warmup' };
  }
  return { command: 'bot' };
}

export async function runScrapeTest(name) {
  const sources = SOURCES.filter((src) => src.name.toLowerCase().includes(name));
  const jobs = await fetchAll(sources);
  for (const src of sources) {
    const mine = jobs.filter((job) => job.source === src.name);
    console.log(`\n=== ${src.name}: ${mine.length} jobs ===`);
    for (const job of mine.slice(0, 5)) {
      console.log(`- ${job.title}  ${formatList(job.cats)}\n  ${job.link}`);
    }
  }
}

function formatList(items) {
  return `[${items.map((item) => `'${item}'`).join(', ')}]`;
}

export async function runWarmup() {
  for (const code of Object.keys(NLLB_CODES)) {
    console.log(code, '->', await tr('Senior Accountant', code));
  }
}

let broadcasting = false;

async function runBroadcast(bot) {
  if (broadcasting) {
    return;
  }
  broadcasting = true;
  try {
    await broadcast(bot.telegram);
  } catch (error) {
    console.error(`[jobbot] broadcast failed: ${safeError(error)}`);
  } finally {
    broadcasting = false;
  }
}

function startSchedule(bot) {
  let interval;
  const first = setTimeout(() => {
    runBroadcast(bot);
    interval = setInterval(() => runBroadcast(bot), config.intervalMs);
  }, config.firstBroadcastMs);
  return () => {
    clearTimeout(first);
    if (interval) {
      clearInterval(interval);
    }
  };
}

async function publishCommands(bot) {
  try {
    await bot.telegram.setMyCommands(HELP.map(([command, description]) => ({
      command: command.slice(1),
      description,
    })));
  } catch (error) {
    console.error(`[jobbot] Could not publish command menu: ${safeError(error)}`);
  }
}

function isDirectRun() {
  if (!process.argv[1]) {
    return false;
  }
  const resolved = path.resolve(process.argv[1]);
  return fileURLToPath(import.meta.url) === resolved || import.meta.url === pathToFileURL(resolved).href;
}

if (isDirectRun()) {
  useDatabase(openDatabase(config.dbPath));
  const args = parseArgs(process.argv);
  if (args.command === 'test') {
    try {
      await runScrapeTest(args.name);
    } catch (error) {
      console.error(`[jobbot] scrape test failed: ${safeError(error)}`);
      process.exit(1);
    }
  } else if (args.command === 'warmup') {
    try {
      await runWarmup();
    } catch (error) {
      console.error(`[jobbot] warmup failed: ${safeError(error)}`);
      process.exit(1);
    }
  } else {
    validateStartupConfig();
    const bot = createBot();
    const stopSchedule = startSchedule(bot);
    const shutdown = (signal) => {
      stopSchedule();
      try {
        bot.stop(signal);
      } catch (error) {
        console.error(`[jobbot] Shutdown: ${safeError(error)}`);
        process.exit(0);
      }
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    try {
      const me = await bot.telegram.getMe();
      console.log(`[jobbot] Connected as @${me.username}. Job alerts run every 2 hours.`);
      await publishCommands(bot);
      await bot.launch({ dropPendingUpdates: false });
    } catch (error) {
      console.error(`[jobbot] Failed to start bot: ${safeError(error)}`);
      process.exit(1);
    }
  }
}
