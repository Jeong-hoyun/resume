#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--dry-run')) throw new Error('Usage: node scripts/commit-copy-and-netlify.mjs [--dry-run]');
const dryRun = args.includes('--dry-run');
function run(command, parameters, options = {}) {
  const result = spawnSync(command, parameters, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${parameters.join(' ')}\n${result.stderr || result.stdout || 'Command failed'}`);
  return result.stdout;
}
const git = (...parameters) => run('git', parameters);
const list = output => output.split('\0').filter(Boolean);
const script = 'scripts/commit-copy-and-netlify.mjs';
const groups = [
  {
    message: 'fix: polish Korean and Japanese resume copy',
    paths: [
      'content/messages.mjs', 'content/generated/translations.json',
      'src/components/ProjectVisual.astro', 'docs/copy-review.md', 'docs/google-sheets.md',
    ],
  },
  {
    message: 'fix: configure Netlify publishing and home redirect',
    paths: ['netlify.toml', 'public/_redirects', 'README.md'],
  },
];
const expected = new Set([...groups.flatMap(group => group.paths), script]);
const staged = list(git('diff', '--cached', '--name-only', '-z'));
const unexpected = staged.filter(path => !expected.has(path));
if (unexpected.length) throw new Error(`다른 작업이 스테이징되어 있습니다. 먼저 처리해주세요:\n${unexpected.join('\n')}`);
if (git('diff', '--name-only', '--diff-filter=U').trim()) throw new Error('충돌을 먼저 해결해주세요.');
// Always pass an explicit non-empty path list. Empty pathspecs make Git inspect the whole tree.
const targets = [...expected];
const changed = new Set([
  ...list(git('diff', 'HEAD', '--name-only', '-z', '--', ...targets)),
  ...list(git('ls-files', '--others', '--exclude-standard', '-z', '--', ...targets)),
  ...staged,
]);
git('diff', 'HEAD', '--check', '--', ...targets);
const plan = groups.map(group => ({ ...group, paths: group.paths.filter(path => changed.has(path)) }));
for (const [index, group] of plan.entries()) {
  console.log(`\n${index + 1}. ${group.message}`);
  console.log(group.paths.length ? group.paths.map(path => `   ${path}`).join('\n') : '   변경 없음 — 건너뜀');
}
console.log(`\n3. chore: add copy and Netlify commit helper\n   ${changed.has(script) ? script : '변경 없음 — 건너뜀'}`);
console.log('지정된 대상 파일의 현재 작업 내용을 자동으로 스테이징합니다. 다른 파일은 포함하지 않습니다.');
if (dryRun) {
  console.log('\n미리보기 완료. 파일·스테이징·커밋은 변경하지 않았습니다.');
  process.exit(0);
}
for (const task of ['check', 'build', 'test']) run('npm', ['run', task], { stdio: 'inherit' });
// Preserve the initial staged patch and tree before the first commit.
const backup = resolve(git('rev-parse', '--git-path', `commit-staged-backups/${new Date().toISOString().replace(/[:.]/g, '-')}`).trim());
mkdirSync(backup, { recursive: true });
writeFileSync(resolve(backup, 'staged.patch'), git('diff', '--cached', '--binary'));
writeFileSync(resolve(backup, 'state.json'), JSON.stringify({
  head: git('rev-parse', 'HEAD').trim(), indexTree: git('write-tree').trim(), staged,
}, null, 2) + '\n');
console.log(`\n스테이징 백업: ${backup}`);
try {
  for (const group of plan) {
    if (!group.paths.length) continue;
    // Refresh only this group's index entries; preserve working files and other staged groups.
    git('add', '--', ...group.paths);
    if (!git('diff', '--cached', '--name-only', '--', ...group.paths).trim()) continue;
    git('diff', '--cached', '--check', '--', ...group.paths);
    run('git', ['commit', '--only', '-m', group.message, '--', ...group.paths], { stdio: 'inherit' });
  }
  git('add', '--', script);
  if (git('diff', '--cached', '--name-only', '--', script).trim()) {
    run('git', ['commit', '--only', '-m', 'chore: add copy and Netlify commit helper', '--', script], { stdio: 'inherit' });
  }
} catch (error) {
  console.error(`실패한 단계에서 중단했습니다. 생성된 커밋은 유지되며 남은 변경은 git status로 확인할 수 있습니다. 백업: ${backup}`);
  throw error;
}
console.log('\n기능별 커밋 완료. 푸시는 수행하지 않았습니다.');
console.log(git('status', '--short', '--branch'));
console.log(git('log', '-3', '--oneline'));
