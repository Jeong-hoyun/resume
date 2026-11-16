import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createSign } from 'node:crypto';
import { messages } from '../content/messages.mjs';
import { hash, compileTranslations, validateRows } from './i18n-core.mjs';
import { sheetsConfig } from '../content/sheets.config.mjs';
const tabs = sheetsConfig.tabs;
const tab = lang => `'${tabs[lang].replaceAll("'", "''")}'`;
const sourceFormula = row => `=IFNA(VLOOKUP(A${row},${tab('ko')}!A:B,2,FALSE),"")`;
const cache = new URL('../content/generated/translations.json', import.meta.url);
const cacheTemp = new URL('../content/generated/translations.json.tmp', import.meta.url);
const command = process.argv[2] || 'check';
const headers = { ko: ['key', 'text', 'source_hash', 'usage'], ja: ['key', 'source_ko', 'auto_ja', 'reviewed_ja', 'reviewed_source_hash', 'status'] };

async function check() {
  let count = 0;
  for (const [key, value] of Object.entries(messages)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(key) || !value.ko?.trim() ) throw new Error(`Invalid seed: ${key}`);
    if (!value.ja?.trim()) console.warn(`Japanese seed missing: ${key}; run push/pull before publishing.`);
    count++;
  }
  let data;
  try { data = JSON.parse(await readFile(cache, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (data) for (const lang of ['ko', 'ja']) for (const key of Object.keys(messages)) {
    if (!data[lang]?.[key]?.trim()) throw new Error(`Cache missing ${lang}:${key}. Pull Sheets again.`);
  }
  console.log(`Validated ${count} bilingual keys (${data ? 'Sheets snapshot' : 'local seed'}).`);
}

async function connect() {
  const id = process.env.GOOGLE_SHEETS_ID || sheetsConfig.spreadsheetId;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!id || !credentialsPath) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS in .env. GOOGLE_SHEETS_ID is optional. See docs/google-sheets.md.');
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const jwt = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(jwt).sign(credentials.private_key, 'base64url');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${jwt}.${signature}` }), signal: AbortSignal.timeout(30000) });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) throw new Error('Google authentication failed. Check the service account configuration.');
  return async (path = '', method = 'GET', body) => {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}${path}`, { method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Sheets API ${response.status}. Check spreadsheet sharing, API activation and tab names.`);
    return response.json();
  };
}
async function sync() {
  const api = await connect();
  const metadata = await api('?fields=sheets.properties');
  const titles = new Set(metadata.sheets.map(s => s.properties.title));
  const missing = Object.keys(headers).filter(title => !titles.has(tabs[title]));
  if (missing.length) {
    if (command !== 'push') throw new Error('Run i18n:push first to initialize tabs.');
    await api(':batchUpdate', 'POST', { requests: missing.map(title => ({ addSheet: { properties: { title: tabs[title] } } })) });
  }
  const values = {};
  for (const lang of ['ko', 'ja']) {
    const result = await api(`/values/${encodeURIComponent(`${tab(lang)}!A:F`)}`);
    const rows = result.values || [];
    if (rows.length && headers[lang].some((h, i) => rows[0]?.[i] !== h)) throw new Error(`Unexpected ${lang} headers. See docs/google-sheets.md.`);
    values[lang] = rows.slice(1);
    validateRows(values[lang], lang);
  }
  if (command === 'pull') {
    const result = compileTranslations(messages, values.ko, values.ja);
    await mkdir(new URL('../content/generated/', import.meta.url), { recursive: true });
    await writeFile(cacheTemp, JSON.stringify(result, null, 2) + '\n');
    await rename(cacheTemp, cache);
    console.log(`Saved Sheets snapshot: ${Object.keys(messages).length} keys. No live Sheets calls during build.`);
    return;
  }
  const updates = [];
  for (const lang of ['ko', 'ja']) if (!values[lang].length) updates.push({ range: `${tab(lang)}!A1`, values: [headers[lang]] });
  const koMap = new Map(values.ko.map((row, i) => [row[0], { row, index: i + 2 }]));
  const jaMap = new Map(values.ja.map((row, i) => [row[0], { row, index: i + 2 }]));
  let koNext = values.ko.length + 2, jaNext = values.ja.length + 2;
  for (const [key, seed] of Object.entries(messages)) {
    let source = koMap.get(key);
    if (!source) {
      source = { row: [key, seed.ko], index: koNext++ };
      updates.push({ range: `${tab('ko')}!A${source.index}:D${source.index}`, values: [[key, seed.ko, hash(seed.ko), 'active']] });
    } else {
      if (!source.row[1]?.trim()) throw new Error(`Empty Korean: ${key}`);
      updates.push({ range: `${tab('ko')}!C${source.index}:D${source.index}`, values: [[hash(source.row[1]), 'active']] });
    }
    const ko = source.row[1], sourceHash = hash(ko), old = jaMap.get(key);
    if (!old) {
      const index = jaNext++;
      // RAW preserves leading '=' in text. Only formula cell is USER_ENTERED below.
      updates.push({ range: `${tab('ja')}!A${index}:F${index}`, values: [[key, '', '', seed.ko === ko && seed.ja?.trim() ? seed.ja : '', seed.ko === ko && seed.ja?.trim() ? sourceHash : '', seed.ko === ko && seed.ja?.trim() ? 'imported' : 'automatic']] });
      updates.push({ formula: true, range: `${tab('ja')}!B${index}`, values: [[sourceFormula(index)]] });
      updates.push({ formula: true, range: `${tab('ja')}!C${index}`, values: [[`=GOOGLETRANSLATE(B${index},"ko","ja")`]] });
    } else {
      updates.push({ formula: true, range: `${tab('ja')}!B${old.index}`, values: [[sourceFormula(old.index)]] });
      if (old.row[3] && old.row[4] !== sourceHash) updates.push({ range: `${tab('ja')}!F${old.index}`, values: [['needs-review']] });
    }
  }
  for (const [key, { index }] of koMap) if (!Object.hasOwn(messages, key)) updates.push({ range: `${tab('ko')}!D${index}`, values: [['unused']] });
  for (const formula of [false, true]) {
    const data = updates.filter(u => Boolean(u.formula) === formula).map(({ range, values }) => ({ range, values }));
    if (data.length) await api('/values:batchUpdate', 'POST', { valueInputOption: formula ? 'USER_ENTERED' : 'RAW', data });
  }
  console.log('Registered keys and refreshed source hashes. Existing Korean/reviewed Japanese preserved. Wait for formula calculation before i18n:pull.');
}
try {
  if (command === 'check') await check();
  else if (['push', 'pull'].includes(command)) await sync();
  else throw new Error(`Unknown command: ${command}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
