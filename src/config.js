import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(packageRoot, '.env') });

function trimmed(name) {
  return (process.env[name] || '').trim();
}

export const config = {
  packageRoot,
  intervalMs: 2 * 60 * 60 * 1000,
  firstBroadcastMs: 30 * 1000,
  maxPerRun: 12,
  instantCount: 5,
  cacheSeconds: 600,
  get botToken() {
    return trimmed('BOT_TOKEN');
  },
  get addisKey() {
    return trimmed('ADDIS_API_KEY');
  },
  get addisBase() {
    return trimmed('ADDIS_BASE_URL') || 'https://api.addisassistant.com';
  },
  get translator() {
    return trimmed('TRANSLATOR').toLowerCase() || 'auto';
  },
  get nllbModel() {
    return trimmed('NLLB_MODEL') || 'Xenova/nllb-200-distilled-600M';
  },
  get dbPath() {
    return trimmed('DB_PATH') || path.join(packageRoot, 'bot.db');
  },
};

export function validateStartupConfig() {
  if (!config.botToken) {
    console.error(
      'BOT_TOKEN is missing. Copy .env.example to .env and set BOT_TOKEN from BotFather. The bot will not start.',
    );
    process.exit(1);
  }
  if (!config.addisKey) {
    console.warn(
      '[jobbot] ADDIS_API_KEY is not set. English and Arabic stay on Edge. Amharic and Somali fall back to Edge. Oromo and Tigrinya are read in English.',
    );
  }
}
