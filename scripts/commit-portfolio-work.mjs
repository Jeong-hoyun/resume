#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const dryRun = process.argv.includes('--dry-run');
if (process.argv.slice(2).some(arg => arg !== '--dry-run')) throw new Error('Usage: node scripts/commit-portfolio-work.mjs [--dry-run]');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}\n${result.stderr || result.stdout || 'Command failed'}`);
  return result.stdout;
}
const git = (...args) => run('git', args);
const read = path => readFileSync(path, 'utf8');
function atHead(path) {
  const result = spawnSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : undefined;
}
function parseMessages(source) {
  const prefix = 'export const messages = ';
  const index = source.indexOf(prefix);
  if (index < 0) throw new Error('Unexpected messages.mjs format');
  return { prefix: source.slice(0, index) + prefix, values: JSON.parse(source.slice(index + prefix.length).trim().replace(/;$/, '')) };
}
function replaceRequired(source, pattern, replacement) {
  if (!pattern.test(source)) throw new Error(`Cannot split shared file: ${pattern}`);
  return source.replace(pattern, replacement);
}
const messagesPath = 'content/messages.mjs';
const snapshotPath = 'content/generated/translations.json';
const registryPath = 'src/lib/code-examples.ts';
const detailPath = 'src/components/ProjectDetail.astro';
const testPath = 'scripts/code-examples.test.mjs';
const scriptPath = 'scripts/commit-portfolio-work.mjs';
const finalMessages = parseMessages(read(messagesPath));
const originalMessages = parseMessages(atHead(messagesPath) || '');
const originalSnapshot = JSON.parse(atHead(snapshotPath) || '{}');
const finalSnapshot = JSON.parse(read(snapshotPath));
const shared = [messagesPath, snapshotPath, registryPath, detailPath, testPath, 'README.md', 'docs/google-sheets.md'];
const aiKeys = key => key.startsWith('ai.') || key.startsWith('code.ai-review.') || ['portfolio.intro', 'project.ai-review.reflection'].includes(key);
const codeKeys = key => key.startsWith('code.') || key === 'project.sdk.implementation';
for (const key of new Set([...Object.keys(originalMessages.values), ...Object.keys(finalMessages.values)])) {
  const changed = JSON.stringify(originalMessages.values[key]) !== JSON.stringify(finalMessages.values[key]);
  if (changed && !aiKeys(key) && !codeKeys(key)) throw new Error(`Unrelated wording change: ${key}. Review it separately before running this script.`);
}
const aiCommit = 'feat: add AI code review portfolio case';
const previousMessages = git('log', '-10', '--format=%s');
if (previousMessages.split('\n').includes(aiCommit)) {
  console.log('AI 포트폴리오 커밋이 이미 있습니다. 재실행 대신 git status와 커밋 내역을 확인해주세요.');
  process.exit(0);
}
const phaseMessages = structuredClone(originalMessages.values);
const phaseSnapshot = structuredClone(originalSnapshot);
for (const [key, value] of Object.entries(finalMessages.values)) if (!aiKeys(key)) phaseMessages[key] = value;
for (const lang of ['ko', 'ja']) {
  phaseSnapshot[lang] ||= {};
  for (const [key, value] of Object.entries(finalSnapshot[lang])) if (!aiKeys(key)) phaseSnapshot[lang][key] = value;
}
const phaseCount = Object.keys(phaseMessages).length;
const finalCount = Object.keys(finalMessages.values).length;
const phase = new Map([
  [messagesPath, finalMessages.prefix + JSON.stringify(phaseMessages, null, 2) + ';\n'],
  [snapshotPath, JSON.stringify(phaseSnapshot, null, 2) + '\n'],
  [registryPath, replaceRequired(replaceRequired(read(registryPath), /^import reviewCode .*\n/m, ''), /^  'ai-review': \{\n[\s\S]*?^  \},\n/m, '')],
  [detailPath, replaceRequired(replaceRequired(read(detailPath), /^import AIReviewArchitecture .*\n/m, ''), /^  \{portfolio && p\.id === 'ai-review' && <AIReviewArchitecture[^\n]*\n/m, '')],
  [testPath, read(testPath).split("const { publishReview } = await loadExample('publish-review.ts');")[0].trimEnd() + '\n'],
  ['README.md', replaceRequired(read('README.md'), /성능 개선·접근성·Web SDK·AI 코드 리뷰 상세에/, '성능 개선·접근성·Web SDK 상세에')],
  ['docs/google-sheets.md', replaceRequired(read('docs/google-sheets.md'), new RegExp(`${finalCount}개 키`), `${phaseCount}개 키`)],
]);
if (phase.get(testPath).includes('publishReview')) throw new Error('Cannot split AI review tests');
const groups = [
  { message: 'docs: review Korean and Japanese portfolio wording', paths: ['docs/copy-review.md'] },
  { message: 'feat: add bilingual code viewer and practical examples', paths: [
    ...shared, 'src/components/CodeExample.astro', 'src/styles/code-example.css',
    'content/examples/prepare-entry.ts.txt', 'content/examples/use-dialog-focus.tsx.txt', 'content/examples/event-queue.ts.txt',
  ], blobs: phase },
  { message: aiCommit, paths: [
    ...shared, 'content/projects.mjs', 'content/examples/publish-review.ts.txt',
    'src/components/AIReviewArchitecture.astro', 'src/styles/ai-review.css',
    'src/components/ProjectVisual.astro', 'src/pages/[lang]/portfolio.astro',
  ] },
  { message: 'chore: add feature-based portfolio commit script', paths: [scriptPath] },
];
const managed = new Set(groups.flatMap(group => group.paths));
for (const path of managed) if (!existsSync(path)) throw new Error(`Missing file: ${path}`);
const stagedPaths = git('diff', '--cached', '--name-only', '-z').split('\0').filter(Boolean);
const unrelated = stagedPaths.filter(path => !managed.has(path));
if (unrelated.length) throw new Error(`Unrelated staged files detected; handle these first:\n${unrelated.join('\n')}`);
if (existsSync(resolve(git('rev-parse', '--git-path', 'MERGE_HEAD').trim()))) throw new Error('Finish the current merge first.');
if (git('diff', '--name-only', '--diff-filter=U').trim()) throw new Error('Resolve merge conflicts first.');
for (const [index, group] of groups.entries()) {
  console.log(`\n${index + 1}. ${group.message}`);
  console.log(group.paths.map(path => `   ${path}`).join('\n'));
}
console.log(`\n번역 파일 분리: 코드 예제 ${phaseCount}개 키 → AI 사례 ${finalCount}개 키`);
if (dryRun) { console.log('미리보기만 수행했습니다. 인덱스·커밋·작업 파일은 변경하지 않았습니다.'); process.exit(0); }

// Validate the final working tree before changing the index or making commits.
for (const task of ['check', 'build', 'test']) run('npm', ['run', task], { stdio: 'inherit' });
const initialHead = git('rev-parse', 'HEAD').trim();
const indexTree = git('write-tree').trim();
const backup = resolve(git('rev-parse', '--git-path', `portfolio-commit-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`).trim());
mkdirSync(backup, { recursive: true });
writeFileSync(resolve(backup, 'staged.patch'), git('diff', '--cached', '--binary'));
writeFileSync(resolve(backup, 'state.json'), JSON.stringify({ initialHead, indexTree, stagedPaths }, null, 2) + '\n');
console.log(`스테이징 백업: ${backup}`);
if (stagedPaths.length) git('restore', '--staged', '--', ...stagedPaths);
let created = 0;
try {
  for (const group of groups) {
    git('add', '--', ...group.paths);
    // Only the index receives intermediate contents. Working files stay untouched.
    for (const [path, content] of group.blobs || []) {
      const hash = run('git', ['hash-object', '-w', '--stdin'], { input: content }).trim();
      git('update-index', '--add', '--cacheinfo', `100644,${hash},${path}`);
    }
    git('diff', '--cached', '--check');
    if (!git('diff', '--cached', '--name-only').trim()) { console.log(`변경 없음: ${group.message}`); continue; }
    console.log(git('diff', '--cached', '--stat'));
    run('git', ['commit', '-m', group.message], { stdio: 'inherit' });
    created++;
  }
} catch (error) {
  if (!created) {
    git('read-tree', indexTree);
    console.error('커밋이 생성되기 전 실패하여 기존 스테이징 상태를 복원했습니다.');
  } else {
    console.error('일부 커밋이 생성되었습니다. 작업 파일은 보존되어 있습니다. git status와 git log를 확인한 뒤 남은 변경을 커밋해주세요.');
  }
  throw error;
}
console.log(`\n${created}개 커밋 완료. 원격 저장소로 푸시하지 않았습니다.`);
console.log(git('status', '--short', '--branch'));
console.log(git('log', '-4', '--oneline'));
