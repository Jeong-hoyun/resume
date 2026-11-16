import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadExample(filename) {
  const code = await readFile(new URL(`../content/examples/${filename}.txt`, import.meta.url), 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(code, {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics?.length, 0);
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { prepareEntry } = await loadExample('prepare-entry.ts');
const { createSauceLink } = await loadExample('event-queue.ts');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('entry shows the poster early and passes the same fetched data to the player', async () => {
  const player = deferred();
  const poster = deferred();
  const info = { posterUrl: 'poster.jpg' };
  let requests = 0;
  const order = [];
  const result = prepareEntry({
    fetchInfo: async () => { requests++; return info; },
    showPoster(url) { assert.equal(url, info.posterUrl); order.push('poster'); poster.resolve(); },
    loadPlayer: () => player.promise,
    reportError(error) { assert.fail(String(error)); },
  });
  await poster.promise;
  assert.deepEqual(order, ['poster']);
  player.resolve({ mount(value) { assert.strictEqual(value, info); order.push('mount'); } });
  await result;
  assert.equal(requests, 1);
  assert.deepEqual(order, ['poster', 'mount']);
});

test('allSettled waits for both jobs and reports each rejection without mounting', async () => {
  const player = deferred();
  const infoError = new Error('info');
  const playerError = new Error('player');
  const errors = [];
  let finished = false;
  const result = prepareEntry({
    fetchInfo: async () => { throw infoError; },
    showPoster() { assert.fail('No info is available'); },
    loadPlayer: () => player.promise,
    reportError: error => errors.push(error),
  }).then(() => { finished = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  player.reject(playerError);
  await result;
  assert.deepEqual(errors, [infoError, playerError]);
});

test('entry catches synchronous loader failures and mount failures', async () => {
  for (const failingStage of ['fetch', 'load', 'poster', 'mount']) {
    const errors = [];
    const error = new Error(failingStage);
    await prepareEntry({
      fetchInfo: () => { if (failingStage === 'fetch') throw error; return Promise.resolve({ posterUrl: 'poster' }); },
      showPoster: () => { if (failingStage === 'poster') throw error; },
      loadPlayer: () => {
        if (failingStage === 'load') throw error;
        return Promise.resolve({ mount() { if (failingStage === 'mount') throw error; } });
      },
      reportError: failure => errors.push(failure),
    });
    assert.deepEqual(errors, [error], failingStage);
  }
});

test('SauceLink buffers basic events until start and passes parameters unchanged', async () => {
  const sent = [];
  const sauceLink = createSauceLink(async (...command) => sent.push(command), error => assert.fail(String(error)));
  const params = { item_id: 'example-product' };
  await sauceLink('event', 'page_view');
  await sauceLink('event', 'view_item', params);
  assert.deepEqual(sent, []);
  await sauceLink('start');
  assert.deepEqual(sent, [['event', 'page_view'], ['event', 'view_item', params]]);
});

test('one drain processes arrivals during send in FIFO order without overlap', async () => {
  const gate = deferred();
  const sent = [];
  let active = 0, maxActive = 0;
  const sauceLink = createSauceLink(async (_, event) => {
    active++;
    maxActive = Math.max(maxActive, active);
    sent.push(event);
    if (event === 'page_view') await gate.promise;
    active--;
  }, error => assert.fail(String(error)));
  await sauceLink('event', 'page_view');
  await sauceLink('event', 'view_item');
  const running = sauceLink('start');
  await sauceLink('event', 'sign_up');
  await sauceLink('event', 'purchase');
  await sauceLink('start');
  assert.deepEqual(sent, ['page_view']);
  gate.resolve();
  await running;
  assert.deepEqual(sent, ['page_view', 'view_item', 'sign_up', 'purchase']);
  assert.equal(maxActive, 1);
});

test('a failed head event remains ahead of later events and can be retried', async () => {
  const attempts = [], errors = [];
  let fail = true;
  const sauceLink = createSauceLink(async (_, event) => {
    attempts.push(event);
    if (fail) { fail = false; throw new Error('offline'); }
  }, error => errors.push(error.message));
  await sauceLink('event', 'page_view');
  await sauceLink('event', 'purchase');
  await sauceLink('start');
  assert.deepEqual(attempts, ['page_view']);
  assert.deepEqual(errors, ['offline']);
  await sauceLink('start');
  assert.deepEqual(attempts, ['page_view', 'page_view', 'purchase']);
  await sauceLink('event', 'sign_up');
  assert.deepEqual(attempts, ['page_view', 'page_view', 'purchase', 'sign_up']);
});

const { publishReview } = await loadExample('publish-review.ts');
const issue = { path: 'src/player.ts', line: 12, message: 'Check the empty list.' };
test('review stays inline when registration succeeds', async () => {
  const calls = [];
  const result = await publishReview({
    inline: async value => { calls.push(value); },
    general: async () => assert.fail('No fallback is needed'),
    reportError: () => assert.fail('No error is expected'),
  }, issue);
  assert.equal(result, 'inline');
  assert.deepEqual(calls, [issue]);
});

test('failed inline review falls back once with file and line context', async () => {
  const comments = [], errors = [];
  const result = await publishReview({
    inline: async () => { throw new Error('position mismatch'); },
    general: async text => { comments.push(text); },
    reportError: (stage, error) => errors.push([stage, error.message]),
  }, issue);
  assert.equal(result, 'general');
  assert.deepEqual(comments, ['src/player.ts:12\nCheck the empty list.']);
  assert.deepEqual(errors, [['inline', 'position mismatch']]);
});

test('both failed review channels return a distinct failure for follow-up', async () => {
  const errors = [];
  const result = await publishReview({
    inline: async () => { throw new Error('inline failed'); },
    general: async () => { throw new Error('general failed'); },
    reportError: (stage, error) => errors.push([stage, error.message]),
  }, issue);
  assert.equal(result, 'failed');
  assert.deepEqual(errors, [['inline', 'inline failed'], ['general', 'general failed']]);
});
