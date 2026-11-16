import { config } from '../config.js';
import { fetchAll } from './scraper.js';

let fetcher = fetchAll;
let cache = { t: 0, jobs: [] };
let chain = Promise.resolve();

export function useJobFetcher(fn) {
  fetcher = fn;
}

export function resetJobCache() {
  cache = { t: 0, jobs: [] };
  chain = Promise.resolve();
}

export function getJobs(maxAge = config.cacheSeconds) {
  const run = chain.then(async () => {
    const stale = Date.now() / 1000 - cache.t > maxAge;
    if (stale || cache.jobs.length === 0) {
      cache.jobs = await fetcher();
      cache.t = Date.now() / 1000;
    }
    return cache.jobs;
  });
  chain = run.then(() => {}, () => {});
  return run;
}
