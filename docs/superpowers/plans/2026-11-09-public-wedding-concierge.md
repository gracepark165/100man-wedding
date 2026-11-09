# 공공예식장 커플 전담 서비스 첫 버전 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지금의 '100만원으로 결혼하기' 사이트에 거주지 질문, 실제 공공예식장 목록, 결과 공유 링크, 체크리스트 저장·캘린더 내보내기, 1:1 도우미 신청 카드, 방문 통계를 더한다.

**Architecture:** 지금처럼 서버 없는 파일 하나(`index.html`)로 배포한다. 소스는 `src/app.src.html`(즉시 실행 함수 안의 바닐라 JS)이고, `src/build.py`가 그림과 `src/venues.json`을 끼워 넣어 `index.html`을 만든다. 테스트는 Playwright로 빌드된 `index.html`을 열어 화면을 누르고, 순수 함수는 `window.__app`으로 노출해 직접 부른다.

**Tech Stack:** 바닐라 JS(ES5 스타일, 기존 코드와 같게), Python 3 빌드 스크립트, Node `node:test` + 사전 설치된 `playwright`(설치 명령 금지).

**Spec:** `docs/superpowers/specs/2026-11-09-public-wedding-concierge-design.md`

## Global Constraints

- 배포물은 `index.html` 하나다. 서버, 로그인, 결제는 만들지 않는다.
- 외부 요청은 Google Fonts(기존), 구글폼 링크, GoatCounter 스크립트만 허용한다. 뒤의 둘은 설정 값이 비어 있으면 넣지 않는다.
- 개인정보(이름, 연락처)는 URL, `localStorage`, 통계 어디에도 넣지 않는다.
- `localStorage`의 모든 읽기·쓰기는 try/catch로 감싸고, 실패해도 화면은 정상 동작한다.
- 화면 문구는 기존 말투(해요체, 짧은 문장)를 따른다. 금액 표기는 기존 `won()`을 쓴다.
- 기존 되돌아가기 동작(결과에서 항목 고치기 `jump`, 진행 점 `goto`, `결과 보기`, 브라우저 뒤로가기)을 깨지 않는다.
- 소스를 고친 뒤에는 항상 `python3 src/build.py`로 `index.html`을 다시 만들고 둘 다 커밋한다.
- 공유 링크 키: `d` 시기, `r` 지역, `s` 세부 지역, `g` 하객, `v` 장소, `m` 식사, `res` 거주지(서울일 때만).
- 신청 카드 문구: "공공예식장 신청부터 예식까지, 카카오톡으로 같이 준비해 드려요 (무료 시범 운영)".
- 통계 이벤트 이름: `start`, `result`, `share`, `apply`.

## Review Focus

1. **잘못되었거나 오래된 공유 링크**(없는 값, 서울이 아닌데 `res`가 있음, 일부 키 누락): 오류 없이 처음 화면으로 가고, 맞는 값만 미리 선택돼 있어야 한다. → Task 4 테스트 `invalid link`.
2. **결과 화면에서 지역을 서울로 바꾸기**: 거주지 질문이 이어서 나와야 하고, 서울에서 다른 곳으로 바꾸면 `res`가 지워져 진행 점이 6개로 돌아와야 한다. → Task 2 테스트 `edit region to/from seoul`.
3. **`localStorage`가 막힌 브라우저**(사파리 사생활 보호 등): 체크와 결과가 그대로 동작해야 한다. → Task 5 테스트 `storage blocked`.
4. **모든 할 일이 이미 지난 경우**(올해 안 예식 등): 캘린더 버튼이 빈 파일을 주지 않고, 넣을 일정이 없다고 알려야 한다. → Task 5 테스트 `ics all past`.
5. **확인 전 공공예식장 데이터**(`checked`가 빈 값): 화면에 나오지 않아야 한다. 확인 안 된 정보가 공개되는 걸 막는다. → Task 3 테스트 `unchecked venues hidden`.

---

### Task 1: 테스트 기반과 기존 흐름 회귀 테스트

**Files:**
- Create: `tests/helpers.js`, `tests/flow.test.js`
- Modify: `src/app.src.html` (즉시 실행 함수 끝, `render();` 바로 앞)
- Modify: `README.md` (테스트 실행법 한 줄)

**Interfaces:**
- Produces: `tests/helpers.js`의 `open(opts?: {url?: string, blockStorage?: boolean}) -> Promise<{browser, page, errors: string[]}>`. `page`는 390×844이고 폰트 요청은 막는다. `blockStorage`가 참이면 `localStorage` 접근이 예외를 던지게 한다(`page.addInitScript`). `url`의 기본값은 `file://<repo>/index.html`이다.
- Produces: `pick(page, n: number)`(n번째 `.opt` 클릭 후 400ms 대기), `heading(page) -> Promise<string>`(`h1.q` 글자).
- Produces: `window.__app = {state, calc, firstMissing}`. 이후 태스크가 여기에 함수를 더한다.

- [ ] **Step 1: 테스트 작성** (`tests/flow.test.js`)
  - `back-navigation: jump from result edits one item`: 시작 → 6번 `pick(1)` → 결과. `[data-k=guests]` 클릭 → `heading`이 `'하객은 몇 명쯤 모실 건가요?'`, `pick(3)` → `.hero`가 있고 `[data-k=guests] .v`가 `'50명 내외'`.
  - `back-navigation: dots and browser back`: 4번 답한 뒤 `button.dot` 1번째 클릭 → `heading`이 `'어느 지역에서 하세요?'`. `page.goBack()` → `'어디서 하실 건가요?'`.
  - 각 테스트 끝에서 `errors`가 `[]`이다.
- [ ] **Step 2: 실행해 실패 확인**: `node --test tests/` → `tests/helpers.js`가 없어서 FAIL.
- [ ] **Step 3: `tests/helpers.js` 작성, `window.__app` 노출**
- [ ] **Step 4: 빌드 후 통과 확인**: `python3 src/build.py && node --test tests/` → 2 tests PASS.
- [ ] **Step 5: 커밋**: `git add tests src index.html README.md && git commit -m "test: 브라우저 흐름 테스트 기반과 되돌아가기 회귀 테스트"`

### Task 2: 거주지 질문과 지원금 계산

**Files:**
- Modify: `src/app.src.html`
  - `STEP_KEYS` 정의(약 323행), `opts()`, `QTEXT`, `firstMissing()`, `viewQuestion()`, 클릭 처리의 `pick`·`back`·`goto`
  - `calc()`의 지원금 계산(약 436행), `panelBudget()`의 지원 줄(약 543행), `chg()` 요약 칸
- Test: `tests/flow.test.js`

**Interfaces:**
- Consumes: Task 1의 `open`, `pick`, `heading`, `window.__app`.
- Produces: `steps(a: object) -> string[]`. `a.region==='seoul'`이면 `['date','region','sub','res','guests','venue','meal']`, 아니면 `['date','region','sub','guests','venue','meal']`. 기존 `STEP_KEYS`를 쓰던 곳은 모두 `steps(state.ans)`로 바꾼다.
- Produces: `RES` 옵션 `[{v:'y',label:'네, 서울에 살아요'},{v:'n',label:'아니요'},{v:'u',label:'잘 모르겠어요',sub:'지원 조건을 알려드릴게요'}]`. `opts('res')`가 이걸 돌려준다. `QTEXT.res = ['두 분 중 한 분이라도 서울에 주민등록이 되어 있나요?','서울시 공공예식장 비품비 지원(최대 100만원)을 받을 수 있는지 확인해요.']`.
- Produces: `calc(a)`의 결과에 다음을 더한다.
  - `support`: `reg.v==='seoul' && ven.v==='public' && a.res==='y'`일 때만 `Math.min(100,gross)`.
  - `supportMaybe`: 같은 조건에서 `a.res==='u'`일 때 `Math.min(100,gross)`, 아니면 0. 합계에서 빼지 않는다.
- Produces: `window.__app.steps`.

- [ ] **Step 1: 테스트 작성**
  - `res question only for seoul`: 서울을 고르면 세부 지역 다음 `heading`이 거주지 질문이고 `.prog .dot` 개수가 7. 경기·인천이면 세부 지역 다음이 하객 질문이고 점이 6.
  - `support by residence`: `__app.calc({...DEMO, res:'y'}).support === Math.min(100, c.gross)`. `res:'n'`이면 `support===0 && supportMaybe===0`. `res:'u'`이면 `support===0 && supportMaybe>0`이고 `total===gross`.
  - `budget rows`: `res:'u'` 결과의 예산 탭에 `'조건 충족 시'`가 보이고, `res:'n'`이면 `'서울시 비품비 지원'`이 없다.
  - `edit region to/from seoul`: 경기로 결과까지 간 뒤 `[data-k=region]`으로 서울, 세부 지역 선택 → `heading`이 거주지 질문이다. 답하면 결과로 간다. 다시 지역을 부산으로 바꾸고 세부 지역 선택 → 결과로 돌아오고, `__app.state.ans.res`가 `undefined`다.
  - 결과 요약 칸에 서울일 때 `[data-k=res]`가 있다.
- [ ] **Step 2: 실행해 실패 확인**: `node --test tests/` → 새 테스트 FAIL.
- [ ] **Step 3: 구현**
  - `pick`에서 지역을 바꾸면 `sub`와 함께 `res`도 지운다.
  - 수정 모드에서 지역 다음은 `sub`, 그 뒤는 `firstMissing()`을 따른다(기존 규칙 유지).
  - `res==='n'`이면 예산 탭 지원 줄 자리에 "서울 거주자가 아니면 비품비 지원 대상이 아니에요." 한 줄을 넣는다.
  - `res==='u'`이면 지원 줄을 금액 없이 "조건 충족 시 최대 100만원"으로 표시한다.
- [ ] **Step 4: 빌드 후 통과 확인**: `python3 src/build.py && node --test tests/` → 전부 PASS(Task 1 포함).
- [ ] **Step 5: 커밋**: `git commit -am "feat: 서울 거주지 질문과 지원금 조건 반영"`

### Task 3: 공공예식장 목록 데이터와 장소 탭

**Files:**
- Create: `src/venues.json`
- Modify: `src/build.py` (`__PUBLIC_VENUES__` 자리표시자를 JSON 문자열로 바꾼다. 파일이 없거나 JSON이 깨졌으면 빌드 실패)
- Modify: `src/app.src.html` (`var PUBLIC_VENUES=__PUBLIC_VENUES__;`. 기존 `VENUES`(장소 유형)와 이름이 겹치지 않게 한다. `panelVenue()`의 공공예식장 안내 부분)
- Test: `tests/flow.test.js`, `tests/build.test.js`

**Interfaces:**
- Consumes: `calc(a)`의 `c.sub.v`, `c.g`(하객 수, 숫자), `c.reg.v`, `c.ven.v`.
- Produces: `venueList(list: object[], area: string, guests: number) -> {v: object, fits: boolean}[]`.
  - `checked`가 빈 문자열인 항목은 뺀다.
  - 정렬은 3단계로 한다: (같은 `area` 그리고 `fits`) → (다른 `area` 그리고 `fits`) → (`fits` 아님).
  - `fits`는 `cap[0] <= guests <= cap[1]`이다.
  - 같은 단계 안에서는 원래 순서를 유지한다.
- Produces: `oldestChecked(list) -> string`(보이는 항목 중 가장 이른 `checked`, 없으면 `''`). `window.__app.venueList`, `window.__app.oldestChecked`.
- JSON 항목 필드는 스펙 2.2와 같다: `id, name, gu, area, cap, fee, food, open, url, checked`.

- [ ] **Step 1: 테스트 작성**
  - `tests/build.test.js`의 `build fails on bad venues json`: 임시 복사본 디렉터리에서 `venues.json`을 `{`로 바꾸고 `build.py` 실행 → 종료 코드가 0이 아니다.
  - `venue sort`: 입력 순서 `mp-1`(mp, 30~100), `gn-1`(gn, 10~40), `mp-2`(mp, 50~200), `mp-3`(mp, 10~30), 하객 20, area `mp`.
    - 기대 id 순서: `['mp-3','gn-1','mp-1','mp-2']`
    - 기대 `fits`: `[true,true,false,false]`
  - `unchecked venues hidden`: `checked:''`인 항목은 `venueList` 결과에 없다.
  - `venue tab render`: 서울 결과의 장소 탭에 `.pv-card`가 1개 이상, 맞지 않는 카드에는 `'하객 수보다 작아요'` 또는 `'하객 수보다 커요'` 표시, `'정보 기준일'` 문구가 있다. 서울이 아닌 지역에서는 `.pv-card`가 0개다.
- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: 구현**
  - 카드(`.pv-card`)에는 이름, 구, `수용 n~m명`, `fee`, `food`, `open`, 공식 안내 링크(`target=_blank rel=noopener`)를 보여준다.
  - 맞지 않는 표시: 하객 < `cap[0]`이면 "하객 수보다 커요", 하객 > `cap[1]`이면 "하객 수보다 작아요".
  - 목록은 기존 '공공예식장 알아두기' 안내 위에 둔다. 장소 유형이 공공예식장이 아니어도 서울이면 보여준다.
- [ ] **Step 4: `src/venues.json` 초안 작성**
  - 서울시 공식 자료(`wedding.seoulwomen.or.kr`, `news.seoul.go.kr`)로 항목을 모은다.
  - 모든 항목의 `checked`는 `""`로 둔다. 운영자가 직접 확인한 뒤 날짜를 넣는다(스펙 5장).
  - 테스트용으로 `tests/fixtures/venues.json`(checked가 채워진 3개)을 따로 두고, 테스트는 `VENUES_JSON` 환경 변수로 빌드할 때 그 파일을 쓴다(`build.py`가 이 변수를 읽는다).
- [ ] **Step 5: 빌드 후 통과 확인**: `python3 src/build.py && node --test tests/` → PASS.
- [ ] **Step 6: 커밋**: `git add src tests index.html && git commit -m "feat: 공공예식장 목록 데이터와 장소 탭"`

### Task 4: 결과 공유 링크

**Files:**
- Modify: `src/app.src.html` (시작 시 주소 읽기, `render()` 뒤 주소 맞추기, 결과 화면 `.foot`에 공유 버튼, 클릭 처리 `share`)
- Test: `tests/flow.test.js`

**Interfaces:**
- Consumes: `steps(a)`, `firstMissing()`, `find(key,v,a)`.
- Produces: `encodeAns(a: object) -> string`. `?` 없는 쿼리 문자열이고, `steps(a)` 순서대로 공유 링크 키를 쓴다. 예: `d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box`.
- Produces: `decodeAns(qs: string) -> {ans: object, ok: boolean}`.
  - 키를 `steps` 순서로 읽으면서 `find`로 검사하고, 맞는 값만 `ans`에 넣는다.
  - `ok`는 모든 단계가 맞을 때만 참이다.
  - 서울이 아닌데 `res`가 있으면 무시한다.
- Produces: `window.__app.encodeAns`, `window.__app.decodeAns`.
- 주소 맞추기: 결과 화면일 때만 `history.replaceState(history.state, '', '?'+encodeAns(state.ans))`를 부른다. 처음 화면으로 갈 때는 쿼리를 지운다. 기존 `record()`의 기록 객체는 그대로 둔다.

- [ ] **Step 1: 테스트 작성**
  - `encode/decode roundtrip`: `decodeAns(encodeAns(DEMO_WITH_RES)).ans`가 원본과 같고 `ok===true`다.
  - `share link opens result`: `open({url: file+'?d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box'})` → `.hero`가 있다. `__app.state.ans.res==='y'`다.
  - `invalid link`: `?d=q1&r=seoul&s=zz&g=999` → `h1.q`가 처음 화면 제목이다. `__app.state.ans`는 `{date:'q1', region:'seoul'}`다. 오류가 없다.
  - `url follows edits`: 결과에서 하객을 50으로 바꾸면 `page.url()`에 `g=50`이 들어간다.
  - `share button fallback`: `navigator.share`를 `undefined`로 지운 뒤 `[data-a=share]` 클릭 → `navigator.clipboard.writeText`(테스트에서 가로챔)가 주소와 함께 불리고, `'링크를 복사했어요'`가 보인다.
- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: 구현**
  - 공유 버튼 문구는 "결과 공유하기"로 하고, `.foot`의 첫 버튼으로 둔다.
  - `navigator.share({title:'100만원으로 결혼하기', url})`를 시도하고, 없거나 실패하면 클립보드에 복사한다. 클립보드도 실패하면 기존 상담 문구 복사의 `fb`처럼 주소를 보여주고 선택해 둔다.
- [ ] **Step 4: 빌드 후 통과 확인**
- [ ] **Step 5: 커밋**: `git commit -am "feat: 결과 공유 링크"`

### Task 5: 체크리스트 저장과 캘린더 내보내기

**Files:**
- Modify: `src/app.src.html` (`finish()`의 `state.checks={}` 대신 불러오기, `change` 처리에서 저장, `panelPlan()`에 버튼 추가, 클릭 처리 `ics`)
- Test: `tests/flow.test.js`

**Interfaces:**
- Consumes: `encodeAns(a)`, `milestones(c)`(기존: `{t, d, due: Date, dd: number, i}` 배열), `calc(a)`.
- Produces: `loadChecks(a) -> object`, `saveChecks(a, checks) -> void`. 키는 `'chk:'+encodeAns(a)`이고 둘 다 try/catch로 감싼다.
- Produces: `buildIcs(items: {t:string,d:string,due:Date}[]) -> string`.
  - 내용: `BEGIN:VCALENDAR`/`VERSION:2.0`/`PRODID:-//100man-wedding//KO`, 항목마다 종일 `VEVENT`. 필드는 `DTSTART;VALUE=DATE:YYYYMMDD`, `DTEND`(다음 날), `SUMMARY`, `DESCRIPTION`, `UID:<i>-<YYYYMMDD>@100man-wedding`, `DTSTAMP`.
  - 줄바꿈은 CRLF로 한다. 글자 속 `\`, `;`, `,`, 줄바꿈은 RFC 5545 방식으로 이스케이프한다.
- Produces: `window.__app.buildIcs`.
- 버튼: 일정 탭 진행 막대 아래에 "내 캘린더에 넣기"(`data-a="ics"`)를 둔다. `dd >= 0`인 할 일만 넣는다. 0개면 파일을 만들지 않고 "남은 할 일이 없어 캘린더에 넣을 일정이 없어요."라고 보여준다.
- 파일 이름: `wedding-plan.ics`. Blob과 `a[download]`로 내려받는다.

- [ ] **Step 1: 테스트 작성**
  - `checks persist`: 결과의 일정 탭에서 첫 체크 → `page.reload()` → 같은 체크가 켜져 있다(공유 링크로 결과가 다시 열린다).
  - `storage blocked`: `open({blockStorage:true})`로 끝까지 진행 → 체크가 동작하고 `errors`가 `[]`이다.
  - `ics format`: `buildIcs([{t:'장소, 예약',d:'a;b',due:new Date(2027,0,5)}])`에 `'DTSTART;VALUE=DATE:20270105'`, `'DTEND;VALUE=DATE:20270106'`, `'SUMMARY:장소\\, 예약'`, `'DESCRIPTION:a\\;b'`가 들어 있고, 모든 줄이 `\r\n`으로 끝난다.
  - `ics download`: 2027년 가을 결과에서 버튼 클릭 → `page.waitForEvent('download')`의 파일 이름이 `wedding-plan.ics`다.
  - `ics all past`: 페이지를 열기 전에 `page.clock.setFixedTime(new Date(2027,2,1))`로 오늘을 고정한다(`q1` 예식일 2027-02-13 이후). `?d=q1&r=gg&s=sw&g=20&v=public&m=box`로 열고 일정 탭 버튼 클릭 → 다운로드 이벤트가 없고 "남은 할 일이 없어 캘린더에 넣을 일정이 없어요."가 보인다.
- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 빌드 후 통과 확인**
- [ ] **Step 5: 커밋**: `git commit -am "feat: 체크리스트 저장과 캘린더 내보내기"`

### Task 6: 1:1 도우미 신청 카드, 방문 통계, 운영자 안내

**Files:**
- Create: `src/config.json` (`{"formUrl":"","formSummaryEntry":"","goatcounter":""}`. 운영자가 고치는 유일한 설정 자리)
- Modify: `src/app.src.html` (스크립트 맨 위 `var CONFIG=__CONFIG__;`, `viewResult()`에 신청 카드, 클릭 처리 `apply`, `track()` 호출 4곳)
- Modify: `src/build.py` (`__CONFIG__`를 `src/config.json` 내용으로 바꾼다. 환경 변수 `CONFIG_JSON`이 있으면 그 값을 대신 쓴다. `goatcounter`가 비어 있지 않으면 `index.html`의 `</body>` 앞에 `<script data-goatcounter="https://<code>.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>`를 넣는다)
- Modify: `README.md` (운영자 안내: `venues.json` 고치는 법과 `checked` 규칙, `config.json` 넣는 법, 빌드·테스트 명령)
- Test: `tests/flow.test.js`, `tests/build.test.js`

**Interfaces:**
- Consumes: `calc(a)`, `encodeAns(a)`.
- Produces: 전역 `CONFIG` 객체(`src/config.json`에서 옴). 필드는 아래 셋이다.
  - `formUrl` 예: `https://docs.google.com/forms/d/e/<id>/viewform`
  - `formSummaryEntry` 예: `entry.123456`
  - `goatcounter` 예: `mycode`
- Produces: `summaryText(c) -> string`. 내용은 `시기: … / 지역: … … / 하객: … / 장소: … / 식사: … / 거주지: …`이고, 거주지는 서울일 때만 넣는다.
- Produces: `applyUrl(c) -> string`. `formUrl + '?usp=pp_url&' + formSummaryEntry + '=' + encodeURIComponent(summaryText(c))`.
- Produces: `track(name: 'start'|'result'|'share'|'apply') -> void`. `window.goatcounter && window.goatcounter.count({path: name, event: true})`를 try/catch로 부르고, 없으면 아무 일도 하지 않는다.
- 호출 지점: 시작 버튼 → `start`, 결과 화면이 처음 그려질 때(로딩 뒤) → `result`, 공유 → `share`, 신청 → `apply`.

- [ ] **Step 1: 테스트 작성**
  - `apply card hidden without config`: 기본 빌드 결과에 `[data-a=apply]`가 없다.
  - `apply card with config`: 테스트에서 `CONFIG_JSON='{"formUrl":"https://example.com/f","formSummaryEntry":"entry.1","goatcounter":""}'`로 빌드한다(`build.py`가 이 변수가 있으면 `CONFIG`를 덮어쓴다). 결과에 카드 문구 "공공예식장 신청부터 예식까지, 카카오톡으로 같이 준비해 드려요 (무료 시범 운영)"가 있다. 링크의 `href`가 `https://example.com/f?usp=pp_url&entry.1=`로 시작하고, 디코딩하면 `'하객: 20명 내외'`가 들어 있다.
  - `track calls`: `window.goatcounter={count: e => calls.push(e.path)}`를 미리 심고 시작 → 결과 → 공유를 진행하면 `calls`가 `['start','result','share']`다.
  - `tests/build.test.js`의 `config json invalid fails build`: `CONFIG_JSON='{'`로 빌드 → 종료 코드가 0이 아니다.
  - `tests/build.test.js`의 `goatcounter tag only when configured`: 기본 빌드의 `index.html`에 `gc.zgo.at`이 없다. `CONFIG_JSON`에 `goatcounter:"x"`를 주면 `data-goatcounter="https://x.goatcounter.com/count"`가 있다.
- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: 구현**
  - 카드는 탭 아래, 안내 문구(`.fine`) 위에 둔다. 버튼 문구는 "1:1 준비 도우미 신청하기", `target=_blank rel=noopener`.
  - 카드 아래 작은 글씨로 "신청서에서 이름과 연락 방법을 받아요. 예식 후 3개월이 지나면 삭제해요."를 넣는다.
- [ ] **Step 4: README 운영자 안내 작성**
- [ ] **Step 5: 빌드 후 전체 통과 확인**: `python3 src/build.py && node --test tests/` → 전부 PASS. 마지막으로 `index.html`을 기본 설정으로 다시 빌드했는지 확인한다(`grep -c gc.zgo.at index.html` → `0`).
- [ ] **Step 6: 커밋**: `git add -A && git commit -m "feat: 1:1 도우미 신청 카드, 방문 통계, 운영자 안내"`

---

## 마무리 확인 (모든 태스크 뒤)

- `node --test tests/` 전부 통과.
- 390×844 스크린샷 4장(거주지 질문, 장소 목록, 일정 탭 버튼, 신청 카드)을 찍어 사용자에게 보여준다.
- `main` 반영은 사용자 확인 뒤에 한다. `venues.json`의 모든 항목이 `checked:""`이면 장소 목록이 비어 보이니, 운영자 확인이 끝나기 전에 반영할지 사용자에게 묻는다.
