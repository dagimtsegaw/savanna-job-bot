import http from 'node:http';

export function startHealthServer(port = process.env.PORT) {
  if (port === undefined || port === null || port === '') {
    return null;
  }
  const parsed = Number(port);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    return null;
  }
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
  });
  server.on('error', (error) => {
    console.error(`[jobbot] Health check failed: ${error.message}`);
  });
  server.listen(parsed, '0.0.0.0');
  server.unref();
  server.on('listening', () => {
    const address = server.address();
    const actual = address && typeof address === 'object' ? address.port : parsed;
    console.log(`[jobbot] Listening on port ${actual}`);
  });
  return server;
}

export function keepWebServiceAwake(url = process.env.RENDER_EXTERNAL_URL) {
  if (!url) {
    return;
  }
  const ping = () => {
    fetch(url).catch(() => {});
  };
  const starter = setTimeout(() => {
    ping();
    const timer = setInterval(ping, 10 * 60 * 1000);
    timer.unref();
  }, 60_000);
  starter.unref();
  console.log('[jobbot] Will ping the service URL so the web service stays awake.');
}
