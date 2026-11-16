import performanceCode from '../../content/examples/prepare-entry.ts.txt?raw';
import accessibilityCode from '../../content/examples/use-dialog-focus.tsx.txt?raw';
import sdkCode from '../../content/examples/event-queue.ts.txt?raw';
import type { MessageKey } from './i18n';

interface CodeExample {
  filename: string;
  language: 'ts' | 'tsx';
  code: string;
  explanation: MessageKey;
  limitation: MessageKey;
}
export const codeExamples: Record<string, CodeExample> = {
  performance: {
    filename: 'prepare-entry.ts', language: 'ts', code: performanceCode,
    explanation: 'code.performance.explanation', limitation: 'code.performance.limitation',
  },
  accessibility: {
    filename: 'use-dialog-focus.tsx', language: 'tsx', code: accessibilityCode,
    explanation: 'code.accessibility.explanation', limitation: 'code.accessibility.limitation',
  },
  sdk: {
    filename: 'event-queue.ts', language: 'ts', code: sdkCode,
    explanation: 'code.sdk.explanation', limitation: 'code.sdk.limitation',
  },
};
