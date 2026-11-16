import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserRuntimeAvailable,
  configureBrowserPath,
  ensureFirefox,
  usesBundledBrowsers,
} from '../src/services/browsers.js';

function restore(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test('browser location follows the host', async () => {
  const previousRender = process.env.RENDER;
  const previousPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const previousSkip = process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
  try {
    delete process.env.RENDER;
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    delete process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
    assert.equal(configureBrowserPath(), '');
    assert.equal(process.env.PLAYWRIGHT_BROWSERS_PATH, undefined);
    await ensureFirefox();

    process.env.RENDER = 'true';
    const stored = configureBrowserPath();
    assert.equal(stored, process.env.PLAYWRIGHT_BROWSERS_PATH);
    assert.match(stored, /\.playwright$/);

    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    delete process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
    assert.equal(browserRuntimeAvailable(), false);

    process.env.PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';
    assert.equal(configureBrowserPath(), '/ms-playwright');
    assert.equal(usesBundledBrowsers(), true);
    assert.equal(browserRuntimeAvailable(), true);
    await ensureFirefox();
  } finally {
    restore('RENDER', previousRender);
    restore('PLAYWRIGHT_BROWSERS_PATH', previousPath);
    restore('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD', previousSkip);
  }
});
