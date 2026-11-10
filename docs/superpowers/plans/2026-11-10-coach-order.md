# 비서가 정해 주는 준비 순서 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결과 화면 맨 위에 "지금 할 일" 카드와 전체 준비 순서를 두고, 할 일 목록·순서·완료 기록을 하나로 합친다.

**Architecture:** 기존 `milestones(c)`를 조건부 할 일까지 만드는 `coachTasks(c)`로 바꾸고, 정렬은 순수 함수 `coachOrder()`가 맡는다. 완료와 건너뛰기 기록은 `state.prog`(기존 `state.checks` 대체)에 두고 `coach:` 키로 저장한다. 카드, 전체 순서, 일정 탭, 캘린더가 모두 이 데이터를 쓴다.

**Tech Stack:** 기존과 같다(바닐라 JS, `src/build.py`, Node `node:test` + Playwright). 테스트 명령은 `npm test`.

**Spec:** `docs/superpowers/specs/2026-11-10-coach-order-design.md`

## Global Constraints

- 할 일 기록 키는 문자열 id: `budget, res-check, share, consult, venue, meal, attire, invite, staff, count, support, final, register`.
- 저장 키는 `'coach:'+encodeAns(a)`, 값은 `{"done":{"<id>":true},"skip":["<id>",...]}`. 모든 읽기·쓰기는 try/catch로 감싼다. 기존 `chk:` 키는 읽지 않는다.
- 문구는 스펙 1장·2장의 표와 예시를 그대로 쓴다. "(기존)"인 이유는 지금 `milestones()`의 `d` 값을 쓴다.
- 묶음 기준: 지금 = `budget`·`res-check`이거나 `dd<=14`(기한 지남 포함, `register` 제외). 이번 달 = `dd<=45`. 나중에 = 그 밖.
- 통계 이벤트 이름에 `done`, `skip`을 더한다. 할 일 id는 보내지 않는다.
- 기존 테스트 33개의 의미는 유지한다. 숫자 번호(`data-i`, `state.checks`)를 쓰는 테스트만 새 이름으로 고친다.

## Review Focus

1. **답을 고쳐서 조건부 할 일이 사라질 때**(예: 거주지를 '모르겠어요'에서 '예'로): 사라진 할 일의 완료·건너뛰기 기록이 남아 있어도 진행 숫자와 카드가 깨지지 않아야 한다. 저장 키가 답 조합별이라 새 조합에서는 새 기록으로 시작한다. → Task 1 `orphan ids ignored`.
2. **모든 할 일을 건너뛰었을 때**: 카드가 비지 않고, 건너뛴 순서대로 첫 번째가 다시 나와야 한다. → Task 1 `all skipped`.
3. **예식일이 이미 지났을 때**: 혼인신고만 남는 등 대부분 "늦었어요"가 되어도 화면 오류가 없어야 한다. → Task 2 `past wedding`.
4. **저장이 막힌 브라우저**: 했어요·건너뛰기가 화면에서는 동작해야 한다. → Task 2 `storage blocked coach`.
5. **브라우저 뒤로가기로 다른 답 조합의 결과로 돌아갈 때**: 그 조합의 기록이 다시 불러와져야 한다(기존 수정 유지). → Task 1에서 기존 테스트 `checks reload after browser back to another result`를 `state.prog.done` 기준으로 바꿔 유지한다.

---

### Task 1: 할 일 데이터, 순서, 기록 저장

**Files:**
- Modify: `src/app.src.html`
  - `milestones()`를 `coachTasks()`로 교체
  - `loadChecks`/`saveChecks`를 `loadProg`/`saveProg`로 교체
  - `state.checks`를 `state.prog`로 교체(초기값, `finish`, `popstate`, 공유 링크 부팅, `change` 처리)
  - `panelPlan()`을 `coachTasks`와 `state.prog.done` 기반으로, `downloadIcs()`/`buildIcs()`의 UID를 id 기반으로
- Create: `tests/coach.test.js`
- Modify: `tests/plan.test.js`, `tests/fixes.test.js` (`data-i` → `data-id`, `state.checks` → `state.prog.done`, UID 기대값)

**Interfaces:**
- Produces: `coachTasks(c) -> Task[]`. `Task = {id, t, d, why, m, due, dd, act}`.
  - `m`, `due`, `dd`: `budget`·`res-check`는 `null`, 나머지는 기존 계산(`due` = 예식일 − round(m×30.44)일, `dd` = due − 오늘(일)).
  - `act`: `{type:'link', href, label}` | `{type:'tab', tab:'budget'|'venue', label}` | `{type:'q', key:'res', label}` | `null`.
  - `why`: 스펙 2장의 이유 문구. "(기존)"이면 `d`와 같다.
  - 목록 순서는 스펙 표 순서이고, 조건이 안 맞는 할 일은 빠진다.
- Produces: `coachOrder(tasks: Task[], prog: {done, skip}) -> {todo: Task[], done: Task[]}`. 미완료는 스펙 3장 순서, 완료는 원래 순서다. `prog`에 있지만 `tasks`에 없는 id는 무시한다.
- Produces: `coachGroup(task) -> 'now'|'month'|'later'`.
- Produces: `loadProg(a) -> {done:{}, skip:[]}`, `saveProg(a, prog) -> void`.
- Produces: `window.__app`에 `coachTasks`, `coachOrder`, `coachGroup` 추가.
- Consumes: `calc(a)`의 `c.over`, `c.total`, `c.reg`, `c.ven`, `c.res`, `c.d.peak`, `c.days`, `c.wd`, `c.today`. 기존 링크 목록의 비품비 지원 주소(`umppa.seoul.go.kr/...biz_mng_no=5131BE...`).

- [ ] **Step 1: 테스트 작성** (`tests/coach.test.js`. 날짜는 `beforeGoto`에서 `page.clock.setFixedTime(new Date(2026,10,10))`로 고정)
  - `conditional tasks`: `coachTasks(calc(A))`의 id 목록.
    - 서울·공공·`res:'u'`이면 `res-check`와 `consult`가 있고 `support`가 없다.
    - `res:'y'`이면 `support`가 있고 `res-check`가 없다.
    - 경기(`r=gg`)면 `res-check`, `consult`, `support`가 모두 없다.
    - 항상 있는 9개(`share, venue, meal, attire, invite, staff, count, final, register`)는 모든 경우에 있다.
  - `budget first`: `?d=q1&r=gg&s=sw&g=20&v=public&m=catering`(합계 초과) → `coachOrder(...).todo[0].id === 'budget'`, `act`는 `{type:'tab', tab:'budget'}`.
  - `res-check right after budget`: 서울·공공·`res:'u'` → `todo`에서 `budget`을 뺀 첫 id가 `res-check`.
  - `urgent before rest`: `d=y2026`(2026-12-19) → `share`(m 3, 기한 지남)가 `venue`보다 앞이고, `todo`에서 `register`는 맨 뒤(건너뛴 것 제외).
  - `skip goes last`: `prog.skip=['share']` → `todo`의 마지막 id가 `share`.
  - `all skipped`: 모든 id를 순서대로 `skip`에 넣으면 `todo[0].id`가 `skip[0]`이다.
  - `orphan ids ignored`: `prog.done={'res-check':true, 'nope':true}`, 경기 조건 → `done.length===0`, 오류 없음.
  - `groups`: `coachGroup({id:'budget'})==='now'`, `{id:'meal',dd:10}`→`now`, `{id:'meal',dd:-3}`→`now`, `{id:'register',dd:-3}`→`later`, `{id:'meal',dd:30}`→`month`, `{id:'meal',dd:90}`→`later`.
  - `prog persists by id`: 일정 탭에서 `[data-id=meal]` 체크 → 새로고침 → 여전히 체크. `localStorage`에 `coach:`로 시작하는 키가 있고, `chk:` 키는 없다.
  - `ics uid by id`: `buildIcs([{id:'meal',t:'a',d:'b',due:new Date(2027,0,5)}])`에 `UID:meal-20270105@100man-wedding`.
- [ ] **Step 2: 실행해 실패 확인**: `npm test` → 새 테스트 FAIL.
- [ ] **Step 3: 구현**
  - `consult` 링크는 `https://wedding.seoulwomen.or.kr`, 라벨 "상담 신청 바로가기"다.
  - `support` 링크는 기존 비품비 지원 주소, 라벨 "지원 신청 바로가기"다.
  - `venue`는 탭 이동 "장소 후보 보기", `budget`은 "줄이는 방법 보기", `res-check`는 질문 이동 "거주지 다시 답하기"다.
  - 캘린더는 `m!==null`, 미완료, `dd>=0`인 할 일만 넣는다.
- [ ] **Step 4: 기존 테스트 이름 바꾸기**: `plan.test.js`, `fixes.test.js`의 `data-i`·`state.checks`·UID 기대값을 새 이름으로 바꾼다. 검증 의미는 그대로 둔다.
- [ ] **Step 5: 통과 확인**: `npm test` → 전부 PASS.
- [ ] **Step 6: 커밋**: `git commit -am "feat: 조건부 할 일과 준비 순서 데이터, id 기반 기록"`

### Task 2: 지금 할 일 카드와 전체 순서 화면

**Files:**
- Modify: `src/app.src.html` (`viewResult()`에서 탭 위에 카드와 목록, CSS `.coach`, `.coach-all`, 클릭 처리 `cdone`/`cskip`/`cact`, `change` 처리에서 목록 체크도 같은 기록 사용)
- Test: `tests/coach.test.js`

**Interfaces:**
- Consumes: Task 1의 `coachTasks`, `coachOrder`, `coachGroup`, `loadProg`, `saveProg`, `state.prog`. 기존 `setTab(t)`, `track(name)`, `steps()`, 수정 모드 진입(`jump` 처리와 같은 방식).
- Produces: `viewCoach(c) -> string` (카드 + `<details class="coach-all">`). 버튼:
  - `[data-a=cdone][data-id]` 했어요 ✓
  - `[data-a=cskip][data-id]` 건너뛰기
  - `[data-a=cact][data-id]` 실행. 링크형은 `<a target=_blank rel=noopener>`이고 `data-a`는 붙이지 않는다.
- 체크박스는 전체 순서와 일정 탭 모두 `input[data-id]`이고, 하나의 `change` 처리기가 `state.prog.done`을 바꾼다.

- [ ] **Step 1: 테스트 작성** (날짜 고정은 Task 1과 같다)
  - `card shows first todo`: `?d=fall&r=seoul&s=gs&res=y&g=20&v=public&m=box` → `.coach h2`가 `todo[0].t`와 같다. `.coach`에 `'왜 지금?'`과 `'완료 0 / '`가 있다.
  - `done advances`: `[data-a=cdone]` 클릭 → 제목이 `todo[1].t`로 바뀌고 `'완료 1 / '`가 된다. 새로고침 후에도 같다. `track`이 `'done'`으로 한 번 불린다(`window.goatcounter` 가로채기).
  - `skip moves to end`: `[data-a=cskip]` 클릭 → 제목이 바뀌고 진행 숫자는 그대로다. `.coach-all`의 마지막 미완료 줄이 건너뛴 할 일이다. `track('skip')`이 불린다.
  - `sync with plan tab`: 카드에서 했어요 → 일정 탭의 같은 `input[data-id]`가 체크돼 있다. 일정 탭에서 다른 할 일을 체크 → `.coach-all`의 같은 id가 체크되고 카드 진행이 1 늘어난다.
  - `action buttons`:
    - 합계 초과 조건에서 `[data-a=cact]` 클릭 → 예산 탭이 열린다(`aria-selected=true`).
    - `res:'u'` 조건에서 `budget`을 했어요 처리 후 `cact` 클릭 → `heading`이 거주지 질문이다.
    - `consult` 카드의 링크 `href`는 `https://wedding.seoulwomen.or.kr`이다.
  - `overdue label`: `d=y2026` → 카드에 `'늦었어요, 오늘 바로 해요'`가 있다.
  - `all done`: 모든 할 일을 했어요 처리 → `'준비를 모두 마쳤어요. 축하해요!'`가 보인다.
  - `groups render`: `.coach-all` 펼침 → `'지금'`, `'이번 달'`, `'나중에'` 중 해당하는 제목만 보인다(빈 묶음은 숨김).
  - `storage blocked coach`: `blockStorage`로 했어요·건너뛰기 → 화면이 바뀌고 오류가 없다.
  - `past wedding`: 날짜를 2027-03-01로 고정하고 `d=q1` 결과를 연다 → 오류 없이 카드가 보인다.
- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: 구현**
  - 카드는 hero 바로 아래, 탭 위에 둔다. 기존 `.notice` 계열 색 토큰을 쓰고, 다크 모드도 기존 토큰으로 맞춘다.
  - 했어요·건너뛰기 뒤에는 결과 화면 전체를 다시 그리지 않고 카드와 목록만 바꾼다. 스크롤 위치가 튀지 않게 하기 위해서다.
- [ ] **Step 4: 통과 확인**: `npm test` → 전부 PASS.
- [ ] **Step 5: 스크린샷**: 390×844에서 카드, 펼친 전체 순서, 다크 모드 카드 3장을 찍어 확인한다.
- [ ] **Step 6: 커밋**: `git commit -am "feat: 지금 할 일 카드와 전체 준비 순서"`
