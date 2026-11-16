export function safeError(error) {
  const description = error?.response?.description || error?.message || 'Unknown error';
  const code = error?.response?.error_code;
  let cleaned = String(description).replace(/bot\d+:[A-Za-z0-9_-]+/gi, 'bot[redacted]');
  for (const name of ['BOT_TOKEN', 'ADDIS_API_KEY']) {
    const secret = process.env[name];
    if (secret) {
      cleaned = cleaned.split(secret).join('[redacted]');
    }
  }
  return code ? `${code} ${cleaned}` : cleaned;
}
