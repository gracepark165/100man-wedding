# 비용 신뢰도 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 날짜 계산을 일수 기준으로 바로잡고, 지원금은 시나리오로만 보여주고, 절감 옵션과 지원을 연동하고, 예산 항목마다 근거를 붙이고, 5명 관찰 실험 문서를 만든다.

**Architecture:** 지원 제도와 비용 근거는 운영자가 고치는 JSON(`src/support.json`, `src/costs.json`)으로 분리하고, `build.py`가 검증해서 `__SUPPORT__`, `__COSTS__` 자리에 넣는다. `calc()`는 지원 전 합계를 기본값으로 바꾸고 지원은 별도 필드로 낸다. 할 일 기한은 `days`로 계산한다.

**Tech Stack:** 기존과 같다. 테스트는 `npm test`.

**Spec:** `docs/superpowers/specs/2026-11-13-trust-fixes-design.md`

## Global Constraints

- 기본 합계(`c.total`), 판정, 오리 장면, 비서 `budget` 할 일은 지원 전 금액 기준이다.
- 지원 상태 이름표: `공고 확인 전` / `{연도}년 공고 기준` / `거주 조건 확인 필요`.
- 시나리오 문구: "지원이 확정되면 {scenarioTotal} (−{supportScenario})".
- 직접 준비 경고 문구: "직접 준비하면 비품비 지원 대상에서 빠질 수 있어요".
- 미확인 안내 문구: "예시 단가가 포함된 추정치예요".
- 비용 근거 키: `rent, meal, decor, staff, dress, makeup, photo, flower, ring, card, register`. `basis`는 `공식|보도|견적|예시`.
- 할 일 `days` 값은 스펙 1장의 표를 그대로 쓴다.
- 지원 신청 기간 문구는 코드에 직접 적지 않는다.

## Review Focus

1. **예식 연도가 바뀌는 경계**(12월 예식의 21일 전이 전년도, 1월 예식): 기한 날짜와 연도가 정확해야 한다. → Task 1 `year boundary`.
2. **거주지 '아니요'나 다른 지역**: 시나리오 상자가 아예 나오지 않아야 하고, 기존처럼 지원 대상 아님 안내만 있어야 한다. → Task 2 `no scenario when not eligible`.
3. **장식비가 0인 장소(식당 등)에서 서울 거주 '예'**: 지원 대상 품목 금액이 작으면 시나리오 금액도 그만큼만 나와야 한다(100만원 고정 아님). → Task 2 `scenario capped by eligible items`.
4. **공유 링크로 들어온 예전 결과**: 지원 차감 금액을 기대하는 사람에게 숫자가 바뀌어 보인다. 시나리오 문구가 같은 화면에 함께 보여야 한다. → Task 2 `share link shows scenario`.
5. **`costs.json`에 없는 새 예산 줄이 생길 때**: 빌드가 실패해서 운영자가 놓치지 않아야 한다. → Task 4 `build fails on missing cost key`.

---

### Task 1: 날짜 규칙 통일

**Files:**
- Modify: `src/app.src.html` (`coachTasks`의 `m`·`lab`을 `days`로, `coachOrder`의 `m` 비교를 `days`로, `panelPlan`·`coachDue`·캘린더의 기한 계산)
- Create: `tests/dates.test.js`

**Interfaces:**
- Produces: `dueDate(wd: Date, days: number) -> Date`. `new Date(y, mo, d - days)` 방식의 달력 계산이다.
- Produces: `dueLabel(days: number) -> string`. 0 → "예식일 전후", 30 미만이고 7의 배수 → "n주 전", 그 밖 → 30일 = 1개월로 "n개월 전" 또는 "n개월 반 전".
- Produces: Task 객체에서 `m`이 `days`(숫자 또는 기한 없음 `null`)로 바뀐다. `lab`은 `dueLabel(days)`이다. 다른 필드(`due`, `dd`, `act`, `why`)는 그대로다.
- Produces: `window.__app.dueDate`, `window.__app.dueLabel`.

- [ ] **Step 1: 테스트 작성** (`tests/dates.test.js`)
  - `due dates`: 예식일 2027-02-13 기준으로 `dueDate(wd,7)`은 2027-02-06, 21은 2027-01-23, 180은 2026-08-17이다.
  - `leap year`: 2028-03-07 기준 `dueDate(wd,7)`은 2028-02-29다.
  - `year boundary`: 2027-01-10 기준 `dueDate(wd,21)`은 2026-12-20이다.
  - `labels`: `dueLabel`의 결과가 `7→'1주 전'`, `14→'2주 전'`, `21→'3주 전'`, `30→'1개월 전'`, `45→'1개월 반 전'`, `60→'2개월 전'`, `75→'2개월 반 전'`, `90→'3개월 전'`, `180→'6개월 전'`, `0→'예식일 전후'`이다.
  - `tasks use days`: `?d=q1…` 결과에서 `coachTasks`의 `final.due`가 2027-02-06, `staff.due`가 2027-01-23이다. 일정 탭 `final` 줄에 "2월 6일"이 보인다.
- [ ] **Step 2: 실행해 실패 확인**: `npm test` → 새 테스트 FAIL.
- [ ] **Step 3: 구현**
  - 정렬은 `days`가 큰 것부터 하고, 기한 없음은 맨 앞으로 둔다(기존 `99`와 같은 역할).
  - `coachGroup`, 늦음 판정(`days>0 && dd<0`), 캘린더 필터(`days!==null`)도 `m` 대신 `days`를 쓴다.
- [ ] **Step 4: 통과 확인**: `npm test` → 전부 PASS.
- [ ] **Step 5: 커밋**: `git commit -am "fix: 할 일 기한을 일수 기준으로 계산"`

### Task 2: 지원금 시나리오와 `support.json`

**Files:**
- Create: `src/support.json` (스펙 2.1 구조. `2026`의 `apply`는 "2026-05-28 ~ 2026-11-28", `checked`는 "", `url`은 기존 `SUPPORT_URL`)
- Modify: `src/build.py` (`__SUPPORT__` 넣기. `SUPPORT_JSON` 환경 변수로 바꿔 끼울 수 있게 하고, `name, max, years, eligibleItems, eligibleNote`가 없으면 실패)
- Modify: `src/app.src.html`
  - `calc()`: 지원 계산
  - 예산 탭 지원 줄: 시나리오 상자로
  - 오리 말풍선, 장소 탭 지원 안내 문단: 기간 문구를 데이터에서
  - `coachTasks`의 `budget` 이유
  - `SUPPORT_URL`: `support.json`의 해당 연도 `url`로 대체(없으면 2026의 `url`)
- Modify: `tests/residence.test.js` (`support`·`supportMaybe` 기대값을 새 필드로)
- Create: `tests/support.test.js`

**Interfaces:**
- Consumes: Task 1의 Task 구조.
- Produces: `calc(a)`의 새 필드.
  - `supportScenario: number`: 대상이 아니면 0
  - `scenarioTotal: number`
  - `supportStatus: 'confirmed-notice'|'unconfirmed'|'unknown-residence'|null`: 대상이 아니면 `null`
  - `supportYear: number`: 예식일 연도
  - `eligibleAmt: number`: 지원 대상 품목 금액 합
  - `support`, `supportMaybe` 필드는 없앤다. `total === gross`다.
- Produces: 예산 줄 객체에 `key`(Global Constraints의 키)를 붙인다. Task 3, 4가 쓴다.
- Produces: 예산 탭 시나리오 상자 `.scenario`, 이름표 `.scenario .tag`.

- [ ] **Step 1: 테스트 작성** (`tests/support.test.js`. `buildTo`로 `SUPPORT_JSON`을 바꾼 빌드도 쓴다)
  - `total is pre-support`: `DEMO`(서울·공공·`res:'y'`)의 `c.total === c.gross`이고 `c.supportScenario === Math.min(100, c.eligibleAmt)`, `c.scenarioTotal === c.gross - c.supportScenario`다.
  - `scenario box unconfirmed`: 예시 결과의 예산 탭에 `.scenario`가 있고, `'지원이 확정되면 '`, `'공고 확인 전'`이 보인다. 오리 말풍선에는 지원 전 합계가 나온다.
  - `scenario box confirmed`: `2027`을 `checked:"2026-11-13"`으로 넣은 `SUPPORT_JSON` 빌드 → `'2027년 공고 기준'`.
  - `unknown residence tag`: `res:'u'` → `'거주 조건 확인 필요'`.
  - `no scenario when not eligible`: `res:'n'`이나 `r=gg`면 `.scenario`가 없다. `res:'n'`이면 "비품비 지원 대상이 아니에요" 안내가 있다.
  - `scenario capped by eligible items`: `eligibleAmt`가 30이 되도록 `SUPPORT_JSON`의 `eligibleItems`를 바꾸거나 장식비가 작은 장소를 고른다 → `supportScenario === eligibleAmt`.
  - `share link shows scenario`: `?d=q1&r=seoul&s=gs&res=y&g=20&v=public&m=box` → 요약 아래에 `'지원 확정 시 '`가 있다.
  - `period text from data`: 결과 어디에도 `'2026년 신청 기간은'`이라는 직접 적은 문구가 없다. 예식 2027년이면 "2027년 공고는 아직 확인 전이에요"가 장소 탭 안내에 있다.
  - `budget task uses pre-support`: 서울·공공·`res:'y'`·도시락 → `coachOrder(...).todo[0].id === 'budget'`이고 `why`에 "지원 전 합계가"와 "지원이 확정되면"이 들어 있다.
  - `build fails on bad support json`: `SUPPORT_JSON`이 `{`면 빌드가 실패한다.
- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: 구현**
  - `supportStatus`가 `'confirmed-notice'`가 되는 조건: `years[연도].checked`가 비어 있지 않음. 연도 항목이 없으면 `'unconfirmed'`다.
- [ ] **Step 4: 기존 테스트 고치기**: `residence.test.js`의 `support by residence`가 새 필드를 확인하도록 바꾼다. 확인 내용: `y`면 `supportScenario>0 && total===gross`, `n`이면 `supportStatus===null`, `u`면 `'unknown-residence'`. `budget rows by residence`의 기대 문구도 새 문구로 바꾼다.
- [ ] **Step 5: 통과 확인**: `npm test` → 전부 PASS.
- [ ] **Step 6: 커밋**: `git commit -am "feat: 지원금을 시나리오로 표시, support.json 분리"`

### Task 3: 절감 옵션과 지원 연동

**Files:**
- Modify: `src/app.src.html` (예산 줄의 `cut`에 `affects`, `calc()`의 절감 합계, 예산 탭 절감 목록과 "모두 적용하면" 문구)
- Test: `tests/support.test.js`

**Interfaces:**
- Consumes: Task 2의 `eligibleAmt`, `supportScenario`, 줄 `key`.
- Produces: `cut.affects: string|undefined`. 장식 직접 준비는 `'decor'`이고, 나머지는 없다.
- Produces: `calc(a).cutResult = {gross: number, scenario: number|null}`. `gross`는 절감 후 지원 전 합계, `scenario`는 지원 대상이 아니면 `null`. 절감 후 지원 = `min(max, eligibleAmt − (eligibleItems에 든 affects의 절감액))`.

- [ ] **Step 1: 테스트 작성**
  - `cut reduces scenario`: 서울·공공·`res:'y'`·케이터링(초과)이고 절감 목록에 장식 직접 준비가 들어가면, `cutResult.scenario === cutResult.gross − Math.min(100, eligibleAmt − 장식 절감액)`이다.
  - `cut warning`: 그 절감 줄 옆에 "직접 준비하면 비품비 지원 대상에서 빠질 수 있어요"가 보인다.
  - `cut text both`: "모두 적용하면 지원 전 약 "과 ", 지원 확정 시 약 "이 함께 보인다. `r=gg`이면 "모두 적용하면 합계가 약 "만 보인다.
- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**: `npm test` → 전부 PASS.
- [ ] **Step 5: 커밋**: `git commit -am "fix: 절감 옵션을 고려해 지원 시나리오 다시 계산"`

### Task 4: 예산 항목 근거와 `costs.json`

**Files:**
- Create: `src/costs.json` (11개 키 모두)
  - `decor`: `basis:"보도"`, 세계일보 기사(기존 출처 링크), `checked:"2026-11-09"`
  - `register`: `basis:"공식"`, "혼인신고 수수료 없음", `checked:""`
  - 나머지: `basis:"예시"`, `checked:""`
  - 모두 `assume`과 `required`를 채운다(반지·꽃·청첩장은 `required:false`)
- Modify: `src/build.py` (`__COSTS__` 넣기, `COSTS_JSON` 환경 변수, 11개 키와 각 필드 검사, `basis` 값 검사)
- Modify: `src/app.src.html` (예산 줄에 이름표·펼침, 미확인 합계, 상태 문구)
- Create: `tests/costs.test.js`

**Interfaces:**
- Consumes: Task 2의 줄 `key`.
- Produces: `isUnverified(cost) -> boolean`: `basis==='예시' || !checked`.
- Produces: `calc(a).unverifiedAmt: number`: 미확인 줄의 금액 합.
- Produces: 예산 줄 `li` 안의 `<details class="basis">`(요약: 이름표 `.basis-tag`, 내용: 가정, 출처 링크, 필수 여부).

- [ ] **Step 1: 테스트 작성**
  - `basis tags`: 예산 탭의 각 줄에 `.basis-tag`가 있고, 장식 줄은 `'보도 · 2026-11-09'`, 식대 줄은 `'예시 단가'`다.
  - `unverified total`: 예산 탭에 "미확인 비용 "과 `won(c.unverifiedAmt)`가 보이고, `c.unverifiedAmt`는 `basis==='예시'`이거나 `checked`가 빈 줄의 `amt` 합과 같다.
  - `estimate notice`: 미확인 줄이 있으면 상태 문구에 "예시 단가가 포함된 추정치예요"가 있다.
  - `basis details`: 장식 줄의 `details`를 펼치면 출처 링크(`target=_blank`)와 "필수"가 보인다.
  - `build fails on missing cost key`: `COSTS_JSON`에서 `meal`을 뺀 빌드가 실패한다.
  - `build fails on bad basis`: `basis:"추측"`이면 실패한다.
- [ ] **Step 2: 실행해 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**: `npm test` → 전부 PASS.
- [ ] **Step 5: 커밋**: `git add -A src tests index.html && git commit -m "feat: 예산 항목 근거 표시와 미확인 비용 합계"`

### Task 5: 관찰 실험 문서와 운영 안내

**Files:**
- Create: `docs/research/2026-11-usability-test.md` (스펙 5장: 대상, 과업 4개, 진행 순서, 관찰 항목, 기록표 표 양식, 해석 한계)
- Modify: `README.md` (운영자 안내에 `support.json`, `costs.json` 고치는 법 추가)

- [ ] **Step 1: 문서 작성**
  - 기록표 열: 참가자, 과업 ①~④ 완료 여부, 비용 오해 횟수와 내용, 막힌 지점, 걸린 시간, 인상적인 말.
- [ ] **Step 2: 확인**: `npm test` → 전부 PASS(문서만 바뀌었으므로 변화 없음).
- [ ] **Step 3: 커밋**: `git add docs README.md && git commit -m "docs: 5명 관찰 실험 계획과 운영 안내"`
