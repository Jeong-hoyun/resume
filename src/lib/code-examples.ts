import performanceCode from '../../content/examples/prepare-entry.ts.txt?raw';
import accessibilityCode from '../../content/examples/use-dialog-focus.tsx.txt?raw';
import sdkCode from '../../content/examples/tracking-client.js.txt?raw';
import reviewCode from '../../content/examples/publish-review.ts.txt?raw';
import type { MessageKey } from './i18n';

interface CodeExample {
  filename: string;
  language: 'ts' | 'tsx' | 'js';
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
  'ai-review': {
    filename: 'publish-review.ts', language: 'ts', code: reviewCode,
    explanation: 'code.ai-review.explanation', limitation: 'code.ai-review.limitation',
  },
  sdk: {
    filename: 'tracking-client.js', language: 'js', code: sdkCode,
    explanation: 'code.sdk.explanation', limitation: 'code.sdk.limitation',
  },
};

type ImplementationSnippet = {
  label: { ko: string; ja: string };
  code: string;
  language?: 'ts' | 'tsx' | 'bash' | 'js' | 'yaml';
  description?: { ko: string; ja: string };
};

export const implementationSnippets: Partial<Record<string, ImplementationSnippet[]>> = {
  performance: [
    {
      label: { ko: '선행 요청과 Promise 재사용', ja: '先行リクエストとPromiseの再利用' },
      code: `const entry = Promise.all([fetchConfig(), fetchBroadcast()]);
// Use the same promise in the startup script and in the app.
const [config, broadcast] = await entry;`,
    },
    {
      label: { ko: '포스터 fetchPriority', ja: 'ポスターのfetchPriority' },
      code: `if (broadcast.visibility === 'public' && !broadcast.requiresPassword) {
  const poster = new Image();
  poster.fetchPriority = 'high';
  poster.src = broadcast.posterUrl;
  posterContainer.replaceChildren(poster);
}`,
    },
    {
      label: { ko: '방송 상태별 Lazy loading', ja: '配信状態に応じた遅延読み込み' },
      code: `if (status === 'scheduled') {
  mountPreview();
} else if (status === 'live' || status === 'vod') {
  const { mountPlayer } = await import('./playback-player');
  mountPlayer();
}`,
    },
    {
      label: { ko: '해시 파일명과 immutable 캐싱', ja: 'ハッシュ付きファイル名とimmutableキャッシュ' },
      language: 'bash',
      code: `curl -I https://example.com/assets/player-a1b2c3.js
# Expected response for a content-hashed asset:
# Cache-Control: public, max-age=31536000, immutable`,
    },
  ],
  accessibility: [
    {
      label: { ko: '다이얼로그 진입과 포커스 복귀', ja: 'ダイアログの初期フォーカスと復帰' },
      description: {
        ko: '다이얼로그에 aria-labelledby로 제목을 연결합니다. 패널이 열린 뒤 첫 탐색 항목에 포커스를 두고, 닫을 때 호출 버튼이 화면에 남아 있으면 포커스를 돌려줍니다.',
        ja: 'aria-labelledbyでダイアログと見出しを関連付けます。パネルが開いたら最初の操作項目へ移動し、閉じたときに元のボタンが画面に残っていればフォーカスを戻します。',
      },
      code: `const previous = document.activeElement;
initialFocus.current?.focus({ preventScroll: true });

return () => {
  if (previous instanceof HTMLElement && previous.isConnected) {
    previous.focus({ preventScroll: true });
  }
};`,
    },
    {
      label: { ko: '모달 내부 Tab 탐색', ja: 'モーダル内のTab移動' },
      description: {
        ko: '열려 있는 모달에서 마지막 항목의 Tab은 첫 항목으로, 첫 항목의 Shift+Tab은 마지막 항목으로 이동합니다. 상품을 탐색하는 동안 포커스가 배경 플레이어로 넘어가는 것을 막습니다.',
        ja: 'モーダルの最後の項目でTabを押すと先頭へ、先頭でShift+Tabを押すと末尾へ移動します。商品を探している間に背後のプレイヤーへフォーカスが移るのを防ぎます。',
      },
      code: `// Attach while the dialog is open.
function handleTab(event: KeyboardEvent, items: HTMLElement[]) {
  if (event.key !== 'Tab' || items.length === 0) return;

  const first = items[0];
  const last = items[items.length - 1];
  const edge = event.shiftKey ? first : last;
  if (document.activeElement !== edge) return;

  event.preventDefault();
  (event.shiftKey ? last : first).focus();
}`,
    },
    {
      label: { ko: '스크린리더 상태 알림', ja: 'スクリーンリーダーへの状態通知' },
      description: {
        ko: '링크 복사처럼 화면 전환 없이 끝나는 작업의 결과를 상태 영역으로 전달합니다. 예시에서는 상태 영역을 먼저 렌더링하고, 완료 후 메시지만 갱신해 포커스를 유지합니다.',
        ja: 'リンクのコピーなど画面遷移を伴わない操作の結果をステータス領域で伝えます。例では領域を先に描画し、完了後にメッセージだけを更新してフォーカスを維持します。',
      },
      language: 'tsx',
      code: `const [message, setMessage] = useState('');

async function copyLink() {
  await copyToClipboard(shareUrl);
  setMessage('Link copied.');
}

// Render this region before the action completes.
<div role="status" aria-live="polite" aria-atomic="true">
  {message}
</div>`,
    },
  ],
  sdk: [
    {
      label: { ko: '로딩 전 호출 보관', ja: '読み込み前の呼び出しを保持' },
      description: {
        ko: '호스트 페이지는 외부 번들이 준비되기 전에도 이벤트를 기록할 수 있습니다. 예시의 임시 함수는 이벤트를 메모리에 보관하고, 로딩 이후 SDK에 넘깁니다.',
        ja: '導入先ページは外部バンドルの読み込み前でもイベントを記録できます。例の仮関数はイベントをメモリに保持し、読み込み後にSDKへ渡します。',
      },
      language: 'js',
      code: `const buffered = [];
const record = event => buffered.push(event);

record({ type: 'product_viewed' });
const tracker = await loadDemoTracker();
for (const event of buffered.splice(0)) tracker.record(event);`,
    },
    {
      label: { ko: '초기화 중복 방지', ja: '初期化の重複防止' },
      description: {
        ko: '여러 페이지 모듈이 동시에 초기화를 요청해도 준비 작업은 한 번만 실행합니다. 실패하면 대기 중인 호출에 오류가 전달됩니다.',
        ja: '複数のページモジュールが同時に初期化を要求しても、準備処理は一度だけ実行します。失敗は待機中の呼び出しに伝わります。',
      },
      language: 'js',
      code: `let readiness;
function prepare() {
  return (readiness ??= Promise.resolve().then(loadDemoSettings));
}`,
    },
    {
      label: { ko: '준비 전 이벤트와 처리 순서', ja: '準備前のイベントと処理順序' },
      description: {
        ko: '번들이 이미 로드됐어도 초기화가 끝나기 전에는 전송을 미룹니다. 준비가 끝나면 대기 목록을 하나씩 처리하며, 새 이벤트와 대기 이벤트가 겹치는 경우는 회귀 검증 대상으로 둡니다.',
        ja: 'バンドル読み込み後も初期化が完了するまで送信を待ちます。準備後は待機リストを一件ずつ処理し、新規イベントと待機イベントが重なる場合は回帰検証の対象にします。',
      },
      language: 'js',
      code: `async function deliverBatch(batch) {
  await prepare();
  for (const event of batch) {
    await deliver(event);
  }
}`,
    },
    {
      label: { ko: '게스트 주문과 유입 정보', ja: 'ゲスト注文と流入情報' },
      description: {
        ko: '쇼핑몰마다 주문 완료 신호와 로그인 상태가 달랐습니다. 주문 식별과 회원 식별을 분리하고, 유입 정보가 없는 방문과 여러 경로를 거치는 방문도 검증 대상에 포함했습니다.',
        ja: 'ECサイトごとに注文完了の通知やログイン状態が異なりました。注文と会員の識別を切り分け、流入情報がない訪問や複数のパスを経由する訪問も検証対象に含めました。',
      },
      language: 'js',
      code: `function toOrderEvent(order) {
  return {
    type: 'order_completed',
    orderId: order.id,
    customerType: order.customerId ? 'member' : 'guest',
  };
}`,
    },
    {
      label: { ko: '릴리스 전 검증', ja: 'リリース前の検証' },
      description: {
        ko: '검증용 빌드와 배포용 빌드를 구분하고, 테스트 통과를 배포 조건으로 연결했습니다.',
        ja: '検証用と配布用のビルドを分け、テスト通過を配布条件にしました。',
      },
      language: 'yaml',
      code: `test:
  stage: test
  script: npm test

publish:
  stage: deploy
  needs: [test]
  script: npm run publish:sdk`,
    },
  ],
  'ai-review': [
    {
      label: { ko: '인라인 댓글 실패 시 일반 댓글로 전환', ja: 'インライン投稿失敗時に通常コメントへ切り替え' },
      code: `try {
  await api.inline(issue);
} catch (error) {
  api.reportError('inline', error);
  await api.general(\`\${issue.path}:\${issue.line} \${issue.message}\`);
}`,
    },
  ],
};
