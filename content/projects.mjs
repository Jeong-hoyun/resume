import facts from './facts.json' with { type: 'json' };

// Structure and non-linguistic facts live in code. Wording lives in Sheets.
export const profile = {
  github: 'https://github.com/Jeong-hoyun',
  blog: 'https://sauce.im/blog/n8n-ai-code-review',
  skills: ['React', 'TypeScript', 'Next.js', 'Vite', 'Vue.js', 'Socket.IO', 'Vitest', 'Playwright', 'PHP', 'MySQL'],
};
export const companies = [
  { id: 'mobidoo', start: '2023-02', end: '2026-08', stack: 'React · TypeScript · Vite · Next.js · Socket.IO' },
  { id: 'officebusters', start: '2017-09', end: facts.employment.officebusters.endDate, stack: 'PHP · MySQL · jQuery · Apache' },
];
export const projects = [
  { id: 'accessibility', company: 'mobidoo', start: '2026-06', end: '2026-07', tags: ['Accessibility', 'React', 'E2E'], featured: true },
  { id: 'ai-review', company: 'mobidoo', start: '2026-03', end: '2026-04', tags: ['n8n', 'Claude API', 'GitLab CI'], link: profile.blog },
  { id: 'performance', company: 'mobidoo', start: '2025-12', end: '2026-04', tags: ['Vite', 'Playwright', 'Web Performance'], featured: true },
  { id: 'sdk', company: 'mobidoo', start: '2025-09', end: '2026-01', tags: ['TypeScript', 'Vitest', 'GitLab CI'], featured: true },
  { id: 'admin', company: 'mobidoo', start: '2024-07', end: '2025-06', tags: ['Vue', 'React', 'Next.js'] },
  { id: 'timeshift', company: 'mobidoo', start: '2024-05', end: '2024-07', tags: ['Video', 'iOS', 'WebView'] },
  { id: 'pip', company: 'mobidoo', start: '2024-02', end: '2024-06', tags: ['Web SDK', 'postMessage', 'interactjs'] },
  { id: 'engagekit', company: 'mobidoo', start: facts.projects.engagekit.startDate, end: facts.projects.engagekit.endDate, tags: ['Socket.IO', 'Kinesis', 'Lottie'] },
  { id: 'sauceclip', company: 'mobidoo', start: facts.projects.sauceclipInitialDevelopment.startDate, end: facts.projects.sauceclipInitialDevelopment.endDate, tags: ['React', 'Video', 'Google Analytics'] },
  { id: 'dashboard', company: 'officebusters', start: '2020-11', end: '2021-01', tags: ['PHP', 'MySQL', 'jQuery'] },
  { id: 'tax', company: 'officebusters', start: '2020-07', end: '2020-10', tags: ['MySQL', 'Migration'] },
  { id: 'seo', company: 'officebusters', start: '2019-07', end: '2020-04', tags: ['PHP', 'Apache', 'JSON-LD'] },
  { id: 'paneo', company: null, tags: ['Kotlin', 'Jetpack Compose', 'GitHub Actions'], featured: true },
];

// Internal measurement: Galaxy S20 Ultra, 3 runs/type, median; mean of type improvement rates.
export const performance = {
  improvements: { fcp: 34, lcp: 31, ttp: 24, transfer: 25 },
  rows: [
    { type: 'A', fcp: [592, 460], lcp: [600, 476], ttp: [1090, 651], transfer: [3370, 2508] },
    { type: 'B', fcp: [708, 436], lcp: [780, 576], ttp: [889, 742], transfer: [3330, 2468] },
    { type: 'C', fcp: [740, 384], lcp: [768, 384], ttp: [817, 812], transfer: [3323, 2503] },
    { type: 'D', fcp: [660, 480], lcp: [660, 480], ttp: [1095, 681], transfer: [3369, 2507] },
  ],
};
export { facts };
