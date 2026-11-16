import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCES } from '../src/data/catalog.js';
import { extractJobs, jobCats, matches, slugToTitle } from '../src/services/scraper.js';

const ethio = SOURCES.find((src) => src.name === 'EthioJobs');
const geez = SOURCES.find((src) => src.name === 'GeezJobs');
const hahu = SOURCES.find((src) => src.name === 'HaHu Jobs');

test('slug titles drop the EthioJobs id and file extension', () => {
  assert.equal(slugToTitle('6kSeBmPhkd-senior-software-engineer'), 'Senior Software Engineer');
  assert.equal(slugToTitle('senior-software-engineer'), 'Senior Software Engineer');
  assert.equal(slugToTitle('office_manager.pdf'), 'Office Manager');
});

test('job categories follow the same title keywords', () => {
  assert.deepEqual(jobCats('Senior Software Engineer'), ['it', 'eng']);
  assert.deepEqual(jobCats('Nurse'), ['health']);
  assert.deepEqual(jobCats('IT Officer'), ['it']);
  assert.deepEqual(jobCats('Branch Manager'), ['bank']);
  assert.ok(jobCats('Disability Inclusion Officer').includes('disab'));
});

test('an empty category list matches every job', () => {
  const job = { cats: ['health'] };
  assert.equal(matches(job, []), true);
  assert.equal(matches(job, ['it']), false);
  assert.equal(matches(job, ['health', 'it']), true);
});

test('pattern sources keep job links and drop the listing page', () => {
  const jobs = extractJobs(ethio, [
    { href: 'https://ethiojobs.net/jobs', text: 'Jobs' },
    { href: 'https://ethiojobs.net/about', text: 'About us' },
    { href: 'https://ethiojobs.net/jobs/6kSeBmPhkd-senior-accountant?src=home', text: 'Apply Now\nSenior Accountant' },
    { href: 'https://example.com/jobs/senior-accountant', text: 'Senior Accountant' },
  ]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Senior Accountant');
  assert.equal(jobs[0].link, 'https://ethiojobs.net/jobs/6kSeBmPhkd-senior-accountant');
  assert.deepEqual(jobs[0].cats, ['acc']);
});

test('the same job link is kept once', () => {
  const jobs = extractJobs(geez, [
    { href: 'https://geezjobs.com/job-detail/senior-accountant?ref=1', text: 'Senior Accountant' },
    { href: 'https://geezjobs.com/job-detail/senior-accountant#top', text: 'Senior Accountant' },
    { href: 'https://www.geezjobs.com/job-detail/senior-accountant', text: 'Senior Accountant' },
  ]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].link, 'https://geezjobs.com/job-detail/senior-accountant');
});

test('sites without a pattern ignore menus and keep job-like paths', () => {
  const jobs = extractJobs(hahu, [
    { href: 'https://www.hahu.jobs/login', text: 'Login to your account' },
    { href: 'https://www.hahu.jobs/about', text: 'About the company' },
    { href: 'https://www.hahu.jobs/', text: 'HaHu Jobs' },
    { href: 'https://www.hahu.jobs/jobs/senior-software-engineer', text: 'View details\nSenior Software Engineer' },
    { href: 'https://other.example/jobs/senior-software-engineer', text: 'Senior Software Engineer' },
  ]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Senior Software Engineer');
  assert.equal(jobs[0].source, 'HaHu Jobs');
});

test('a short label is replaced by the slug title', () => {
  const jobs = extractJobs(hahu, [
    { href: 'https://hahu.jobs/jobs/community-health-officer', text: 'New' },
  ]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, 'Community Health Officer');
  assert.ok(jobs[0].cats.includes('health'));
});
