#!/bin/sh
# Run from any directory. Stages only the reviewed project files in explicit groups.
set -eu
cd "$(dirname "$0")/.."
git rev-parse --is-inside-work-tree >/dev/null
if ! git diff --cached --quiet; then
  echo '이미 스테이징된 변경이 있습니다. 해당 변경을 먼저 처리한 뒤 다시 실행해주세요.' >&2
  exit 1
fi
commit_group() {
  message=$1
  shift
  git add -- "$@"
  if git diff --cached --quiet; then
    echo "변경 없음: $message"
  else
    git diff --cached --stat
    git commit -m "$message"
  fi
}
commit_group 'chore: add project frontend design skill' \
  .agents/skills/frontend-design/SKILL.md \
  .agents/skills/frontend-design/LICENSE.txt \
  skills-lock.json
commit_group 'feat: organize shared resume facts and bilingual content' \
  content/README.md content/facts.json content/projects.mjs content/messages.mjs
commit_group 'feat: add Google Sheets translation synchronization' \
  .env.example scripts/i18n.mjs scripts/i18n-core.mjs scripts/i18n-core.test.mjs \
  content/sheets.config.mjs content/generated/translations.json docs/google-sheets.md
commit_group 'feat: build bilingual resume site with Astro' \
  .gitignore package.json package-lock.json astro.config.mjs tsconfig.json \
  public/favicon.svg src/layouts/Document.astro src/lib/i18n.ts \
  src/components/ProjectDetail.astro src/components/ProjectVisual.astro \
  'src/pages/[lang]/index.astro' 'src/pages/[lang]/resume.astro' \
  'src/pages/[lang]/career.astro' 'src/pages/[lang]/portfolio.astro' \
  src/pages/index.astro src/pages/404.astro src/styles/global.css docs/design.md
commit_group 'docs: document architecture and content workflow' \
  README.md scripts/commit-initial-work.sh
git status --short --branch
git log -5 --oneline
