import assert from 'node:assert/strict';
import test from 'node:test';
import { keepWebServiceAwake, startHealthServer } from '../src/health.js';

test('no health server is opened when Render did not assign a port', () => {
  assert.equal(startHealthServer(''), null);
  assert.equal(startHealthServer(undefined), null);
  assert.equal(startHealthServer('nope'), null);
});

test('the health server answers on the assigned port', async () => {
  const server = startHealthServer(0);
  assert.ok(server);
  if (!server.listening) {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
  }
  const address = server.address();
  assert.equal(typeof address, 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'ok');
  server.close();
});

test('keep-awake does nothing without a service URL', () => {
  assert.equal(keepWebServiceAwake(''), undefined);
});
