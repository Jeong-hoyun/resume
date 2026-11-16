# Google Sheets로 표현 관리하기

사이트 구조·신규 키는 코드에서 관리하고, 기존 문장 수정은 시트에서 합니다.
현재 시트에 136개 키를 등록했고, 연결된 Google Sheets 도구로 읽어온 스냅샷을 사이트에 반영했습니다.

사용 중인 시트: https://docs.google.com/spreadsheets/d/1NrrRdrbq_PPrD55Fb55vl_BHp5SMMOU3YIgn9XZn_Fw/edit

물리 탭은 `ko`, `jp`이며 일본어 언어 코드는 `ja`입니다. `content/sheets.config.mjs`에서 연결합니다. 대화 중 동기화는 연결된 도구를 이용할 수 있고, 로컬 터미널·CI 동기화는 아래 서비스 계정 설정이 필요합니다.

## 터미널·CI 인증 설정

1. Google Cloud 프로젝트에서 Google Sheets API를 활성화합니다.
2. 서비스 계정을 만들고 JSON 키를 **이 저장소 밖**에 보관합니다.
3. 위 스프레드시트에서 서비스 계정의 `client_email`에 편집 권한을 부여합니다. 웹에 게시할 필요는 없습니다.
4. `.env.example`을 `.env`로 복사한 뒤 `GOOGLE_SHEETS_ID`와 `GOOGLE_APPLICATION_CREDENTIALS`를 설정합니다.
5. `npm run i18n:push`를 실행합니다. `ko`, `jp` 탭과 헤더가 없으면 생성합니다. 다른 형식의 기존 탭이 있으면 중단합니다.
6. 일본어 자동 번역 수식 계산이 완료되면 `npm run i18n:pull`을 실행합니다.
7. `npm run build`로 확인합니다.

환경변수나 서비스 계정 JSON을 `PUBLIC_` 변수 또는 `public/`에 넣지 마세요. 스크립트는 Node 기본 모듈과 Sheets REST API를 사용하므로 별도 Google SDK가 필요하지 않습니다.

## 탭 형식

### ko

| A | B | C | D |
|---|---|---|---|
| key | text | source_hash | usage |

한국어 표현은 B열을 수정합니다. C·D열은 `i18n:push`가 갱신합니다.
새 키는 `content/messages.mjs`에 한국어 기본 문장을 추가합니다. 일본어 기본값이 없으면 `ja: ''`로 두면 됩니다. 시트에 등록할 때 자동 번역됩니다. 기존 키를 코드에서 삭제하면 행을 제거하지 않고 `unused`로 표시합니다.

### jp (언어 코드 ja)

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| key | source_ko | auto_ja | reviewed_ja | reviewed_source_hash | status |

- B열: `VLOOKUP` 수식으로 ko 탭에서 같은 key의 한국어 원문을 조회합니다. ko의 B열을 수정하면 원문과 자동 번역이 갱신되며, 행 순서에 의존하지 않습니다.
- C열: `=GOOGLETRANSLATE(B2,"ko","ja")`. 신규 행에만 수식을 넣습니다.
- D열: 직접 검수한 일본어. 있으면 자동 번역보다 우선합니다.
- E열: 검수 대상 한국어의 해시. 검수 완료 시 ko 탭의 해당 `source_hash`를 복사합니다.
- F열: `imported`, `automatic`, `reviewed`, `needs-review`.

초기 일본어는 PDF 내용을 바탕으로 사이트용으로 정리한 기본값입니다. 최초 등록 시 D열에 보존하고 `imported`로 표시합니다. 사용자가 일본어를 검수했다는 의미가 아닙니다.

## 평소 작업

```bash
# 개발에서 새 키 추가 → 시트에 없는 키만 등록
npm run i18n:push

# 기존 표현은 시트에서 수정
# 한국어 변경 시 다시 push하여 일본어 원문과 해시 갱신
npm run i18n:push

# 수식 계산 후 번역 가져오기
npm run i18n:pull
npm run build
```

`push`는 시트의 기존 한국어나 일본어 검수본을 덮어쓰지 않습니다. 한국어 변경으로 D열 검수본의 해시가 달라지면 `needs-review`로 표시하며, `pull`이 중단됩니다. 일본어를 검토·수정한 뒤 E열에 최신 해시를 넣고 F열을 `reviewed`로 바꾸세요. 검수본을 쓰지 않으려면 D·E열을 비우고 F열을 `automatic`으로 바꿉니다.

`{percent}` 같은 자리표시자는 일본어에도 그대로 보존합니다. 번역 수식 오류·계산 중·누락·중복·자리표시자 불일치는 내려받기에서 차단합니다. 실패 시 마지막 정상 스냅샷은 그대로 남습니다.

`content/generated/translations.json`은 자동 생성되는 **공개 콘텐츠 전용** 빌드 스냅샷입니다. 직접 편집하지 않고, 첫 생성 후 Git에 함께 커밋하면 시트 접속 없이 동일한 내용을 빌드할 수 있습니다. 스냅샷 생성 후 새 키를 추가하면 `pull`을 먼저 실행해야 합니다.

## 자동화

- `npm run build`: 기존 스냅샷으로 오프라인 빌드. 외부 서비스에 쓰지 않습니다.
- `npm run build:sync`: 시트 등록 → 내려받기 → 빌드. 번역 계산 대기 중이면 실패 후 재실행합니다.
- `npm run dev`: 로컬 개발 서버. 파일 변경만으로 원격 시트를 수정하지 않습니다.

원격 동기화를 파일 저장 때마다 실행하는 watcher와 시트 수정 후 자동 배포는 아직 추가하지 않았습니다. 먼저 이 기본 흐름으로 운영한 뒤 연결할 수 있습니다. 동시에 여러 `push`를 실행하면 같은 신규 행에 쓰기 충돌이 생길 수 있으므로 CI에서도 직렬 실행하세요.

현재 탭에는 공개 문장만 넣습니다. 비공개 이력서는 이 빌드 파이프라인에 포함하지 않습니다.
