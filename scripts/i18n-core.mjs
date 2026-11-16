import { createHash } from 'node:crypto';
export const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 16);
export function validateRows(rows, label) {
  const keys = new Set();
  for (const [i, row] of rows.entries()) {
    const key = row[0];
    if (!key || keys.has(key)) throw new Error(`${label}: missing or duplicate key at row ${i + 2}`);
    keys.add(key);
  }
}
export function compileTranslations(messages, koRows, jaRows) {
  validateRows(koRows, 'ko'); validateRows(jaRows, 'ja');
  const koMap = new Map(koRows.map(r => [r[0], r]));
  const jaMap = new Map(jaRows.map(r => [r[0], r]));
  const output = { ko: {}, ja: {} };
  for (const key of Object.keys(messages)) {
    const ko = koMap.get(key)?.[1];
    const row = jaMap.get(key);
    if (typeof ko !== 'string' || !ko.trim()) throw new Error(`Missing Korean: ${key}`);
    if (!row || row[1] !== ko) throw new Error(`Japanese source is not synchronized: ${key}. Run i18n:push.`);
    const [, , automatic = '', reviewed = '', reviewedHash = '', status = ''] = row;
    if (reviewed && reviewedHash !== hash(ko)) throw new Error(`Review is stale: ${key}. Update Japanese review and reviewed_source_hash.`);
    const ja = reviewed || automatic;
    if (typeof ja !== 'string' || !ja.trim() || ja.startsWith('#') || /^(Loading|読み込み中|로드 중)/i.test(ja)) throw new Error(`Translation pending/error: ${key}. Wait for Sheets and retry.`);
    if (status === 'needs-review') throw new Error(`Review required: ${key}`);
    const tokens = text => [...text.matchAll(/\{([\w]+)\}/g)].map(m => m[1]).sort().join(',');
    if (tokens(ko) !== tokens(ja)) throw new Error(`Placeholder mismatch: ${key}`);
    output.ko[key] = ko; output.ja[key] = ja;
  }
  return output;
}
