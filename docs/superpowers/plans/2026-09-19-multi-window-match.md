# Multi-window Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Task 11（程式審查）與 Task 12（註解）必須做完才算收工。

**Goal:** 2–4 個已登入視窗（`Yu` / `Chiang` / `Lin` / `Yang`）共乘。每人上車、下車各有一個可步行圈，半徑來自該人的 Max walk。Your route 整頁寫進團檔。依定案協議仲裁。人只看自己的英文 Agent 對白與自己的走／坐／車資。

**Architecture:** SQLite 只存 `users(id, username)`。行程與仲裁只寫 repo 根目錄 `storage/matches/current.json`。Vite middleware 提供 login／join／match／reset。`runMatch` 是唯一成交邏輯。OpenRouter `openrouter/auto` 只准改 `theater[]`。

**Tech Stack:** Vite 8、React 19、Vitest、better-sqlite3、JSON、既有 Leaflet、OpenRouter。

## Global Constraints

- Rider-facing UI is English.
- Comments and non-code prose: Traditional Chinese, ASD-STE100. Identifiers, APIs, required technical terms stay English.
- Tests: shallow to deep, split across files. No catch-all test file.
- Simple and direct. No weird wiring. No needless abstractions.
- Seed usernames only: `Yu`, `Chiang`, `Lin`, `Yang`. No password. Unknown username fails.
- Login is case-insensitive. Store canonical casing. Map `Yu=A`, `Lin=B`, `Chiang=C`, `Yang=D`.
- `sessionStorage` key `sharemeter.username`. Do not use `localStorage` for login.
- Write `storage/` at the repo root. Never Vite `public/`.
- SQLite never stores trips.
- LLM output never decides the deal.
- Match size: minimum 2 riders, maximum 4 riders.
- OpenRouter key lives only in local `web/.env` as `OPENROUTER_API_KEY`. Model: `openrouter/auto` (`https://openrouter.ai/openrouter/auto`). Never write the key into this PLAN, source, match JSON, or git. `web/.env` is gitignored.
- Do not commit unless the user asks.

---

## Locked protocol（不得改流程）

```text
需求 → 2–4 份結構化初始需求
  → 仲裁 v1
  → 各 Agent：算分 + 一份爭取稿
  → 仲裁 v2
  → 各 Agent：再算分

誰撞牆 → 踢出、獨乘、留下的人重算（不算第三輪討論）
留下的人裡：多數 v2 分 > v1 分 → 用 v2
否則 → 用 v1

人只看自己 Agent 的會話表演 + 最後自己的走／坐／車資
```

人全程不進場、不投票、不選軸。

### 牆（撞到就踢，多數決無效）

- 步行 > Max walk
- 車上時間 > 獨乘 + Extra time
- 車種／行李／無障礙不過
- 自己的車資 ≥ 自己的獨乘價

被踢的人付自己的獨乘，這一團車資是 0。
留下的人用新路線新跳表重分（獨乘價比例），再驗一次牆。剩 1 人就散團、全員獨乘。

重算讀法：先比完 v1／v2 並多數決，再踢人。v1 撞牆、v2 修好，算同意 v2。定案後才踢。重算後不再投票。

### 分數與多數

撞牆 = 0，且該票是硬否決。
沒撞牆才打分，用獨乘省下的錢、剩餘 Extra time、剩餘步行合成一個數。v2 分 > v1 分才算同意。

- 2 人：2 票
- 3 人：2 票
- 4 人：3 票

多數沒過 → 用 v1。

### 爭取稿

只准推一個軸，並寫願意放出什麼。不准點名、不准寫別人車資。
表演文字由這份稿和分數翻譯，不能反過來用聊天決定成交。

User 只看：自己 Agent 的話（英文）、自己的走／坐／車資。別人的價錢與結構化欄位不上屏。

---

## 步行圈（起點一圈、終點一圈）

不是全團共用一個固定公里走廊。
是**這個使用者走路上可以接受的範圍**，也就是 Your route 的 **Max walk**。

- 步行速率：`80` m／min（4.8 km／h）
- `radiusKm = maxWalkMin * 0.08`
- **上車圈**：圓心 = 該使用者 Pickup，半徑 = 他自己的 Max walk
- **下車圈**：圓心 = 該使用者 Dropoff，半徑 = 他自己的 Max walk

Max walk 改了，兩個圈一起改。Max walk = 0 → 半徑 0，只能在點上會合。

**能否進同一團：**團裡所有人的上車圈必須有共同交集（存在一個上車會合點，每個人走路都不超過自己的 Max walk），且所有人的下車圈必須有共同交集。
新加入後若任一端沒有交集 → `POST /api/match/join` 回 409 `{ "error": "walk_circles_miss" }`。畫面英文：`Your walk range does not meet this group.`

人數：

- 1 人：`collecting`，不跑仲裁
- 2–4 人且兩端都有交集：`runMatch`
- 已 4 人：再 join 回 409 `{ "error": "match_full" }`

Your route 地圖畫出這兩個圈（上車、下車各一）。圈的大小只跟該使用者的 Max walk 走，不跟別人走。

純函式放 `web/src/engine/corridor.ts`：

```ts
export const WALK_M_PER_MIN = 80

export type Circle = {
  lat: number
  lng: number
  radiusKm: number
}

export function walkRadiusKm(maxWalkMin: number): number

export function riderCircles(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  maxWalkMin: number,
): { origin: Circle; dest: Circle }

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number

export function circlesIntersect(a: Circle, b: Circle): boolean

export function groupHasCommonIntersection(circles: Circle[]): boolean
```

兩圓相交：中心距 ≤ 兩半徑之和。
三人以上：兩兩相交不夠。必須存在一點落在每一個圈內。候選點用各成員圓心；任一圓心落在全部圈內即通過。測試需覆蓋「兩兩相交但第三人進不去」。

Seed 預設起訖放在新竹走廊，且彼此要落在對方預設 Max walk 圈內，四個視窗才能進同一團。不要用板橋／新莊／中和當這四人的預設。

測試：`web/src/engine/corridor.test.ts`。

---

## Your route 整頁入檔

`DetailsScreen`（`.scroll`）按 Match nearby riders 時，把當下畫面寫進該 username 的 `routePage`。不要事後重算來充當紀錄。

```ts
export type RoutePageSnapshot = {
  pickup: Place
  dropoff: Place
  soloDurationMin: number
  soloDistanceKm: number
  extraTimeMin: number
  sharedCapMin: number
  maxWalkMin: number
  bags: number
  accessible: boolean
  extraPay: boolean
  notes: string
  originCircle: Circle
  destCircle: Circle
}
```

| 畫面 | 欄位 |
|---|---|
| Pickup | `pickup` + `originCircle` |
| Dropoff | `dropoff` + `destCircle` |
| Solo taxi N min | `soloDurationMin` |
| Best driving path · N km | `soloDistanceKm` |
| Extra time vs solo | `extraTimeMin`（即 `maxDetourMin`） |
| may take up to X min (solo + extra) | `sharedCapMin` |
| Max walk | `maxWalkMin`（兩個圈的半徑來源） |
| Bags | `bags` |
| Accessible vehicle | `accessible` |
| Pay extra to stay on time | `extraPay` |
| Notes for matching | `notes` |

不入檔：`privateFloor`（此頁沒有）。
join body：`{ username, demand, routePage }`。
牆與分數用 `routePage` 的 solo／extra／walk／bags／accessible。若 `routePage` 缺漏，才退回 haversine 估算。

---

## OpenRouter

本機 `web/.env` 只放變數，不提交：

```
OPENROUTER_API_KEY=
VITE_GOOGLE_MAPS_API_KEY=
```

`web/.env.example` 只留空變數名。
`vite.config.ts` 已用 `loadEnv`。`parsePlugin` 與 `matchPlugin` 共用同一把 key。Model：`openrouter/auto`。

呼叫時機：`runMatch` 算完成交之後。只把每位 rider 的 `theater[]` 拿去讓個人 Agent prompt 潤稿。逾時或失敗 → 保留 `buildTheater()`。回傳裡的 score／pitch／踢人丟掉。

---

## Prompts（可選譯者，不是成交開關）

實作放 `web/src/engine/prompts.ts`。成交只走 `runMatch`。

### 個人 Agent system

```text
You are one rider's agent for ShareMeter, a shared taxi.
You speak only for this username.
You never let the rider vote, pick an axis, or join bargaining.
You never name other riders. You never mention anyone else's fare.

Hard walls (a hit is a veto, not a preference):
- walkMin > maxWalkMin
- rideMin > soloRideMin + maxDetourMin
- accessibility required but vehicle is not accessible
- luggageCount >= 2 but luggageOk is false
- fare >= soloFare

If a wall is hit, score is 0.
Otherwise score = mean of:
- (soloFare - fare) / soloFare
- leftover extra-time slack
- leftover walk slack

Write exactly one surplus pitch:
- one axis to push: fare | walk | ride | ontime
- one axis to give
- pick the axis from this rider's priority, not from a menu
- time → push ontime, give fare
- price → push fare, give walk
- comfort → push walk, give fare
- direct → push ride, give fare

Return JSON only:
{
  "score": number,
  "pitch": { "axis": "fare"|"walk"|"ride"|"ontime", "give": "fare"|"walk"|"ride"|"ontime", "note": string },
  "theater": string[]
}

theater: 3 to 5 short English lines for this rider only.
The last line may include only this rider's NT$ fare.
No structured field names, no other riders, no arbiter monologue.
```

### 個人 Agent user（v1 之後）

```text
username: {{username}}
priority: {{priority}}
walls: maxWalkMin={{maxWalkMin}} maxDetourMin={{maxDetourMin}} luggageCount={{luggageCount}} accessibility={{accessibility}}
solo: rideMin={{soloRideMin}} fare={{soloFare}}
offer v1: walkMin={{walkMin}} rideMin={{rideMin}} fare={{fare}} accessible={{accessible}} luggageOk={{luggageOk}}
```

### 個人 Agent user（v2 之後）

```text
Same rider. Score offer v2. Do not write a new pitch.
offer v2: walkMin={{walkMin}} rideMin={{rideMin}} fare={{fare}}
previous pitch: {{pitch}}
outcome if already known: {{share|solo}} finalWalkMin={{}} finalRideMin={{}} finalFare={{}}
```

### 仲裁 Agent system

```text
You are the only arbiter for one ShareMeter match (2 to 4 riders).
Riders do not talk to you. Only their agents do.

You receive structured demands, then you output offer v1 for every rider.
Then you receive one pitch per rider. You output offer v2.
You do not run a third discussion.

v1 must try to keep every rider inside their walls and cheaper than solo.
v2 may move leftover surplus along each pitch.axis and must take the matching pitch.give. Do not name riders in any public text.

You do not decide the deal by prose.
A host function will:
- set score 0 when a wall is hit
- treat v2 > v1 as one yes vote
- majority: 2→2, 3→2, 4→3
- if majority yes, adopt v2, else adopt v1
- then kick anyone who still hits a wall
- kicked rider pays solo; remaining split the new meter by solo-fare ratio
- if fewer than 2 remain, everyone solos
- no new pitches after a kick

Return JSON only:
{
  "version": "v1"|"v2",
  "totalMeter": number,
  "slices": {
    "{{username}}": {
      "walkMin": number,
      "rideMin": number,
      "fare": number,
      "accessible": boolean,
      "luggageOk": boolean
    }
  }
}
```

### 仲裁 Agent user（要 v1）

```text
Riders (structured demands only):
{{json array: username, origin, destination, maxWalkMin, maxDetourMin, luggage, accessibility, extraPay, priority, soloRideMin, soloFare}}
Produce version v1.
```

### 仲裁 Agent user（要 v2）

```text
v1 slices: {{json}}
pitches: {{json array: username, axis, give, note}}
Produce version v2. Keep sum of fares equal to totalMeter.
```

---

## Demo solver（無 key 也能 Demo）

- 獨乘優先用 `routePage.soloDurationMin`；`soloFare = 80 + round(soloDistanceKm * 25)`
- v1：`rideMin = solo + min(4, extraTimeMin)`，`walkMin = min(4, maxWalkMin)`，`totalMeter = 0.72 * sum(soloFare)`，按獨乘價比例分。最後一人吃四捨五入差額。
- v2：只沿 `pitch.axis` 微調，從 `pitch.give` 補回，再把差額補進最後一人使總額不變。
- 爭取稿由 `priority` 決定（可由 notes 沿用現有 `parseDemand`），人不能選軸：
  - time → axis `ontime`，give `fare`
  - price → axis `fare`，give `walk`
  - comfort → axis `walk`，give `fare`
  - direct → axis `ride`，give `fare`
- 上車／下車步行分鐘不得大於該人 Max walk（與圈一致）

---

## HTTP

沿用 `web/vite.parse-plugin.ts` 的 middleware 模式，新增 `web/vite.match-plugin.ts`。

- `POST /api/login` `{ username }` → `{ id, username, riderId }` 或 404 `{ error: "unknown_user" }`
- `GET /api/match` → `MatchRecord`；無檔則空 collecting
- `POST /api/match/join` `{ username, demand, routePage }`
  - 圈無交集 → 409 `walk_circles_miss`
  - 已 4 人 → 409 `match_full`
  - 1 人 → collecting
  - 2–4 人 → `runMatch`
  - 已 settled 再 join → 開新團，只帶這一筆
- `POST /api/match/reset` → 刪 `current.json`，200 `{ ok: true }`

---

## Canonical types

加在 `web/src/types.ts` 或 `web/src/engine/match.ts`（擇一，全計畫同一來源）：

```ts
export type Username = 'Yu' | 'Chiang' | 'Lin' | 'Yang'

export type SurplusAxis = 'fare' | 'walk' | 'ride' | 'ontime'

export type OfferSlice = {
  walkMin: number
  rideMin: number
  fare: number
  soloFare: number
  soloRideMin: number
  accessible: boolean
  luggageOk: boolean
}

export type Pitch = {
  axis: SurplusAxis
  give: SurplusAxis
  note: string
}

export type MatchStatus = 'collecting' | 'settled' | 'solo'

export type MatchRider = {
  username: Username
  riderId: RiderId
  routePage: RoutePageSnapshot
  demand: RiderDemand
  structured: StructuredDemand
  v1: OfferSlice
  v2: OfferSlice
  scoreV1: number
  scoreV2: number
  pitch: Pitch
  theater: string[]
  kicked: boolean
  outcome: 'share' | 'solo'
  finalWalkMin: number
  finalRideMin: number
  finalFare: number
}

export type MatchRecord = {
  id: string
  status: MatchStatus
  adopted: 'v1' | 'v2' | 'solo'
  riders: MatchRider[]
}
```

`OfferSlice`、分數、爭取稿不上騎士畫面。畫面只渲染 `username === me` 的 `theater` 與 `final*`。

---

## File map

| Path | Role |
|---|---|
| `docs/superpowers/plans/2026-09-19-multi-window-match.md` | 本計畫 |
| `storage/users.sqlite` | 四列使用者。內容 gitignore |
| `storage/matches/current.json` | 目前這一團 |
| `storage/.gitignore` | 忽略 sqlite 與 match json |
| `web/.env` | 本機 key。已 gitignore。勿提交 |
| `web/.env.example` | 空的 `OPENROUTER_API_KEY=` |
| `web/src/types.ts` | 需要時加公開型別 |
| `web/src/data.ts` | 海報名 Yu／Lin／Chiang／Yang；新竹走廊預設起訖 |
| `web/src/auth.ts` | `sessionStorage` 讀寫 |
| `web/src/engine/corridor.ts` | 步行圈 |
| `web/src/engine/corridor.test.ts` | 圈測試 |
| `web/src/engine/match.ts` | 牆、分數、爭取稿、多數、分帳、`runMatch` |
| `web/src/engine/match.test.ts` | 協議測試 |
| `web/src/engine/theater.ts` | 爭取稿＋分數 → 英文對白 |
| `web/src/engine/theater.test.ts` | 對白不含別人車資 |
| `web/src/engine/prompts.ts` | 個人／仲裁 prompt 字串 |
| `web/src/engine/routePage.ts` | 從 Your route 組 snapshot |
| `web/src/engine/routePage.test.ts` | snapshot 欄位 |
| `web/server/users.ts` | SQLite seed／查 username |
| `web/server/users.test.ts` | seed 與大小寫 |
| `web/server/matchStore.ts` | 讀寫團檔、join、觸發引擎 |
| `web/server/matchStore.test.ts` | join／圈／滿員 |
| `web/vite.match-plugin.ts` | `/api/login` `/api/match` `/api/match/join` `/api/match/reset` |
| `web/vite.config.ts` | 掛 match plugin |
| `web/src/screens/LoginScreen.tsx` | 只打 username |
| `web/src/screens/SideScreens.tsx` | Account：未登入→Login；已登入→名字＋Log out |
| `web/src/App.tsx` | `/login`；未登入不能進 `/ride/*` |
| `web/src/screens/DetailsScreen.tsx` | 畫圈、join 帶 `routePage` |
| `web/src/screens/NegotiateScreen.tsx` | 輪詢團檔，只播自己的 theater |
| `web/src/screens/PayScreen.tsx` | 只顯示自己的 `finalFare` |
| `web/src/TripContext.tsx` | join API；`you` 依登入 username |

`better-sqlite3` 只給 Node／plugin 用，不進瀏覽器 bundle。

`storage` 路徑：從 `web/vite.match-plugin.ts` 用 `path.resolve` 指向 repo 根 `storage/`（plugin 在 `web/`，上一層是 repo 根）。

---

## 測試分檔（由淺入深，禁止一個 catch-all）

| 檔 | 深度 | 內容 |
|---|---|---|
| `web/src/engine/corridor.test.ts` | 淺→中 | 半徑 = Max walk；兩圓相交；第三人進不去 |
| `web/src/engine/match.test.ts` | 中→深 | 牆、分數、多數 2/2 3/2 4/3、分帳、`runMatch`、踢人重算、少於 2 人散團 |
| `web/src/engine/theater.test.ts` | 淺 | 英文對白；無其他 username；只有自己的 `NT$` |
| `web/src/engine/routePage.test.ts` | 淺 | snapshot 欄位與畫面欄位對齊；兩圈半徑跟 Max walk |
| `web/server/users.test.ts` | 淺 | seed 四名、大小寫、未知名 |
| `web/server/matchStore.test.ts` | 深 | join 1 人 collecting、2 人 settled、圈不合 409、第 5 人 409、Your route 入檔 |

---

### Task 1: Username map + 新竹走廊預設起訖

**Files:**
- Modify: `web/src/data.ts`
- Create: `web/src/engine/match.ts`（先放 `USERNAMES`、`USERNAME_TO_RIDER`、`normalizeUsername`）
- Test: `web/src/engine/match.test.ts`

**Produces:**

```ts
export const USERNAMES: Username[] = ['Yu', 'Chiang', 'Lin', 'Yang']
export const USERNAME_TO_RIDER: Record<Username, RiderId> = {
  Yu: 'A',
  Lin: 'B',
  Chiang: 'C',
  Yang: 'D',
}
export function normalizeUsername(raw: string): string
```

- [ ] `POSTER_RIDERS` 的 `name` 改為 `Yu` / `Lin` / `Chiang` / `Yang`
- [ ] 四人預設起訖都在新竹走廊，且以預設 `maxWalkMin` 能互走進對方上車圈與下車圈
- [ ] 測試：`yu`→`Yu`、`YANG`→`Yang`、未知字原樣返回；`USERNAME_TO_RIDER.Chiang === 'C'`
- [ ] Run: `npm test -- src/engine/match.test.ts`

---

### Task 2: 步行圈 + Your route 畫圈

**Files:**
- Create: `web/src/engine/corridor.ts`、`web/src/engine/corridor.test.ts`
- Modify: `web/src/screens/DetailsScreen.tsx`、`web/src/components/MapCanvas.tsx`（若畫圈需要）

**Produces:** `walkRadiusKm`、`riderCircles`、`haversineKm`、`circlesIntersect`、`groupHasCommonIntersection`

- [ ] 測試：`walkRadiusKm(8) === 0.64`；距離 0 相交；剛好在半徑上算在圈內；超出不相交
- [ ] 測試：兩圓相交但第三人圓心不在共同區 → `groupHasCommonIntersection` 為 false
- [ ] Your route 地圖畫上車圈、下車圈；改 Max walk 時圈跟著變
- [ ] Run: `npm test -- src/engine/corridor.test.ts`

---

### Task 3: 牆、分數、多數、`runMatch`

**Files:**
- Modify: `web/src/engine/match.ts`
- Test: `web/src/engine/match.test.ts`

**Produces:** `hitsWall`、`scoreOffer`、`majorityNeeded`、`adoptVersion`、`splitBySolo`、`pitchFromDemand`、`runMatch`

必測：

1. `walkMin 9` 且 `maxWalkMin 8` → 撞牆，分數 0
2. `fare === soloFare` → 撞牆
3. 牆內且比獨乘便宜 → 分數 > 0
4. 4 人 3 票 `v2>v1` → `'v2'`；2 票 → `'v1'`
5. 2 人必須 2 票
6. `splitBySolo` 最後一格吃 residual，加總等於總跳表
7. 兩人合法 → `status==='settled'`，`outcome==='share'`，`finalFare < soloFare`
8. 多數採用 v2 後一人撞牆 → 踢出獨乘；留下 ≥2 則重分；留下 <2 則全員獨乘

- [ ] Run: `npm test -- src/engine/match.test.ts`

---

### Task 4: `routePage` snapshot

**Files:**
- Create: `web/src/engine/routePage.ts`、`web/src/engine/routePage.test.ts`
- Modify: `web/src/screens/DetailsScreen.tsx`

**Produces:**

```ts
export function snapshotRoutePage(input: {
  pickup: Place
  dropoff: Place
  soloDurationMin: number
  soloDistanceKm: number
  extraTimeMin: number
  maxWalkMin: number
  bags: number
  accessible: boolean
  extraPay: boolean
  notes: string
}): RoutePageSnapshot
```

`sharedCapMin = soloDurationMin + extraTimeMin`。兩圈用 `riderCircles`。

- [ ] 測試欄位與畫面列對齊
- [ ] Match 按鈕送 `{ username, demand, routePage }`
- [ ] Run: `npm test -- src/engine/routePage.test.ts`

---

### Task 5: theater + prompts + 可選 OpenRouter

**Files:**
- Create: `web/src/engine/theater.ts`、`web/src/engine/theater.test.ts`、`web/src/engine/prompts.ts`
- Create: `web/server/theaterLlm.ts`（Node only）

**Produces:** `buildTheater`、prompt 常數、可選潤稿

- [ ] theater 3–5 句英文；最後一行才可有自己的 `NT$`
- [ ] 測試：Yu 的對白不含 `Chiang`／`Lin`／`Yang`
- [ ] 有 `OPENROUTER_API_KEY` 才呼叫；只覆寫 `theater[]`；失敗用 `buildTheater()`
- [ ] Run: `npm test -- src/engine/theater.test.ts`

---

### Task 6: SQLite users + login API

**Files:**
- Create: `web/server/users.ts`、`web/server/users.test.ts`
- Create: `web/vite.match-plugin.ts`
- Modify: `web/vite.config.ts`、`web/package.json`
- Create: `storage/.gitignore`

**Produces:** `POST /api/login`

```
storage/.gitignore
*.sqlite
matches/*.json
!.gitkeep
!matches/.gitkeep
```

- [ ] 加 `better-sqlite3` 與 `@types/better-sqlite3`
- [ ] tmp db seed 後 4 列；`yang` 找到 `Yang`；未知 404
- [ ] `vite.config.ts` 掛 `matchPlugin(env.OPENROUTER_API_KEY ?? '')`
- [ ] 手動：`curl` login `lin` 得 `"username":"Lin","riderId":"B"`

---

### Task 7: Match store + join API

**Files:**
- Create: `web/server/matchStore.ts`、`web/server/matchStore.test.ts`
- Modify: `web/vite.match-plugin.ts`

**Produces:** `readMatch`、`joinMatch`、`resetMatch`、`GET /api/match`、`POST /api/match/join`、`POST /api/match/reset`

- [ ] 測試用 tmp 目錄，不寫真實 `storage/matches/current.json`
- [ ] 1 人 collecting；2 人 settled；圈不合 409；第 5 人 409；`routePage` 入檔
- [ ] Run: `npm test -- server/matchStore.test.ts`（或 vitest 能掃到的路徑）

---

### Task 8: sessionStorage 登入 UI

**Files:**
- Create: `web/src/auth.ts`、`web/src/screens/LoginScreen.tsx`
- Modify: `web/src/screens/SideScreens.tsx`、`web/src/App.tsx`、`web/src/screens/HomeScreen.tsx`、`web/src/TripContext.tsx`、`web/src/engine/trip.ts`

**Produces:**

```ts
export function readSessionUsername(): Username | null
export function writeSessionUsername(name: Username): void
export function clearSessionUsername(): void
```

- [ ] `/login` 只打 username；失敗 `Unknown user`
- [ ] `/account` 無 session → `/login`；有則顯示名字與 Log out
- [ ] `/` Share a ride 與 `/ride/*` 無 session → `/login`
- [ ] `resetTrip` 保留已登入的 `you`
- [ ] 四個分頁各登一人，互不覆蓋

---

### Task 9: Negotiate theater + Pay 自己的車資

**Files:**
- Modify: `web/src/screens/NegotiateScreen.tsx`、`web/src/screens/PayScreen.tsx`、`web/src/TripContext.tsx`、`web/src/index.css`

**行為：**

1. 每 800ms `GET /api/match`
2. `collecting`：英文 `Waiting for nearby riders` + spinner。不列出池中是誰
3. `settled`：只播自己的 `theater`，一句約 700ms
4. 播完 → `/ride/pay`
5. Skip：已 settled 立刻進 pay；仍 collecting 則繼續等
6. Pay：左方案與人數（`outcome==='share'` 的人數）；右 `NT$` + 自己的 `finalFare`。solo 時文案 `Solo taxi`

- [ ] DOM 不得出現別人的 `NT$`

---

### Task 10: Four-window smoke

手動：

1. `npm test` 全綠
2. `npm run dev`
3. 四窗登入 Yu／Chiang／Lin／Yang，session 不互相覆蓋
4. `Chen` → Unknown user
5. 只 Yu Match → Waiting
6. Lin 再 Match（圈內）→ 兩窗自己的 theater 與自己的車資
7. 出圈的起訖 → `Your walk range does not meet this group.`
8. reset 後四人都 Match → 最多 4 人；Pay 只顯示自己車資
9. 重新整理 theater 用檔裡句子

---

### Task 11: 倒數第二 — 程式審查與測試

做完全功能之後、改註解之前。對象是程式，不是註解。

- [ ] Review this project like your life depends on it. Make it as elegant, simple, and correct as possible. No weird wiring. No needless abstractions. Pure elegance.
- [ ] 測試由淺入深、分檔（上表）。`npm test` 全綠
- [ ] `tsc -b` 通過
- [ ] 定案協議仍在：兩輪、牆、多數、踢人靜默重算、人零選擇
- [ ] 成交只走 `runMatch`。沒有聊天決定成交
- [ ] 沒有平行的第二套分帳、第二套牆、用 LLM 當仲裁
- [ ] 沒有 `localStorage` 登入。沒有把行程寫進 SQLite。沒有把 JSON 寫進 `public/`
- [ ] Your route 入檔欄位與畫面一致
- [ ] 2–4 人、兩圈規則有測試
- [ ] 刪掉多餘 wrapper、重複 fetch、用不到的 context 欄位
- [ ] 產出：刪掉或合併的抽象清單；測試檔清單；協議對照表（每條定案對到測試名稱）

---

### Task 12: 最後 — 註解 ASD-STE100

做完 Task 11 之後。對象是註解與非程式說明，不是 identifier。

- [x] Rewrite in Traditional Chinese following ASD-STE100
- [x] This does not apply to code, identifiers, API names, or required technical terms
- [x] Remove all mannered prose
- [x] When a literal statement is available, use it instead of metaphor, flourish, or language that performs the writer rather than conveying the meaning
- [x] 騎士畫面英文維持不動
- [x] Prompt 英文維持不動
- [x] 不為了「看起來有註解」而加註。只留必要的一句：此欄誰能讀、為何不可寫進公開檔、牆的判定

---

## 不做

- 密碼、OAuth、多張 trip 歷史表
- 把仲裁過程進 SQLite
- 第三輪爭取稿
- 群聊、仲裁逐字稿
- 把 API key 寫進本 PLAN、原始碼、或團檔
- 用 `localStorage` 當登入
- 實作時順便大重構 PlacePicker

---

## Spec coverage

| 定案 | Task |
|---|---|
| 2–4 Agent + 1 仲裁、v1／爭取稿／v2 | 3、5、7 |
| 牆、踢人、靜默重算、多數 v2 否則 v1 | 3 |
| 人零選擇 | 8、9 |
| 只看自己 theater + 走／坐／車資 | 5、9 |
| 上車圈／下車圈 = Max walk | 2、4 |
| Your route 整頁入檔 | 4、7 |
| SQLite id+username、四個 seed | 6 |
| OpenRouter 只改 theater | 5 |
| 程式審查與分檔測試 | 11 |
| 註解 ASD-STE100 | 12 |
