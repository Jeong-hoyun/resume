import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTranslations, hash, validateRows } from './i18n-core.mjs';
const messages = { 'test.key': { ko: '약 {percent}%', ja: '約{percent}%' } };
const ko = [['test.key', '약 {percent}%']];
const valid = () => [['test.key', ko[0][1], '自動{percent}%', '検証済み{percent}%', hash(ko[0][1]), 'reviewed']];
test('reviewed Japanese wins over machine translation', () => {
  assert.equal(compileTranslations(messages, ko, valid()).ja['test.key'], '検証済み{percent}%');
});
test('stale reviewed Japanese cannot silently replace updated source', () => {
  const row = valid(); row[0][4] = hash('old source');
  assert.throws(() => compileTranslations(messages, ko, row), /stale/);
});
test('Google formula loading/error never enters the build snapshot', () => {
  for (const value of ['#ERROR!', '#N/A', 'Loading...', '']) {
    assert.throws(() => compileTranslations(messages, ko, [['test.key', ko[0][1], value]]), /pending\/error/);
  }
});
test('unfinished source synchronization is rejected', () => {
  const row = valid(); row[0][1] = 'old source';
  assert.throws(() => compileTranslations(messages, ko, row), /not synchronized/);
});
test('placeholders are preserved by translations', () => {
  const row = valid(); row[0][3] = 'no placeholder';
  assert.throws(() => compileTranslations(messages, ko, row), /Placeholder mismatch/);
});
test('duplicate keys and missing rows are rejected', () => {
  assert.throws(() => validateRows([...ko, ...ko], 'ko'), /duplicate/);
  assert.throws(() => compileTranslations(messages, ko, []), /not synchronized/);
});
test('machine translation works when no reviewed version exists', () => {
  const result = compileTranslations(messages, ko, [['test.key', ko[0][1], '約{percent}%']]);
  assert.equal(result.ja['test.key'], '約{percent}%');
});
