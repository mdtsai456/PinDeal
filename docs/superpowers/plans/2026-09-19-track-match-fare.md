# Track Match Fare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track 的 Your fare 與 Pay 相同，讀此乘客的 match `finalFare`。瀏覽器重整後仍相同。

**Architecture:** 不在 `pay()` 寫入 `youFare`。`TripProvider` 重整後會重掛，`match` 回到 `null`，`youFare` 回到 `CONSENSUS_ROUTE`。Track 仿 Pay：`match` 未成交時 `fetchMatch` + `absorbMatch`。畫面車資用 `trackFare`：有 `payView` 則用 `payView.fare`（即自己的 `finalFare` / `ownFare`），否則保留目前 `youFare`。不要刪 `CONSENSUS_ROUTE`。

**Tech Stack:** Vite 8、React 19、Vitest、既有 `fetchMatch` / `payView` / `absorbMatch`。不要加 React Testing Library。

## Global Constraints

- Rider-facing UI is English. Label stays `Your fare`.
- Comments and non-code prose: Traditional Chinese, ASD-STE100. Identifiers, APIs, and required technical terms stay English.
- Tests: shallow to deep, split across files. No catch-all test file.
- Simple and direct. No weird wiring. No needless abstractions. Do not extract a shared fetch hook.
- Do not write `youFare` only inside `pay()`. That does not survive refresh.
- Do not delete `CONSENSUS_ROUTE`. Track stops using it for fare when match exists.
- Do not edit `docs/superpowers/plans` 裡舊的 rider_segment_map 計畫。
- Do not commit unless the user asks.
- Update `AGENTS.md` fare fact only after implementation (Task 3). Not in the planning turn.

## Why `pay()` is not enough

```text
Pay 按 Call taxi → pay() → /ride/track
  此時記憶體裡 match 仍在，但 Track 今天讀 youFare
  youFare 初值 = CONSENSUS_ROUTE.fares[youId]（Yu = 420）
  Pay 讀 payView(match, username).fare（Yu 現檔可為 115）

重整 /ride/track
  TripProvider 重掛
  match = null
  youFare = CONSENSUS_ROUTE 再一次
  若只在 pay() 寫 youFare，寫入值已丟
```

因此 Track 必須自己載入 match，再讀與 Pay 同一來源。

## File map

| File | Role |
| --- | --- |
| `web/src/engine/matchView.ts` | 新增純函式 `trackFare`。不要改 `payView` / `ownFare`。 |
| `web/src/engine/trackFare.test.ts` | 新建。淺：fallback。深：等於 `payView.fare` / `ownFare`。 |
| `web/src/screens/TrackScreen.tsx` | 載入 match（同 Pay）並顯示 `trackFare`。 |
| `web/src/engine/trip.ts` | 只改註解。`pay` 仍只設 `paid: true`。 |
| `web/src/engine/trip.test.ts` | 加一則：`pay` 不改 `youFare`。 |
| `AGENTS.md` | 實作後改 Fare 事實句。本規劃回合不改。 |

不要改：`PayScreen.tsx`、`TripContext.tsx`、`matchApi.ts`、`routes.ts`。

### 既有介面（直接用）

```ts
// web/src/engine/matchView.ts
export function ownFare(record: MatchRecord, username: Username): number | null
export function payView(record: MatchRecord, username: Username): PayView | null
// PayView.fare === own rider finalFare

// web/src/engine/matchApi.ts
export async function fetchMatch(): Promise<MatchRecord>

// web/src/TripContext.tsx
absorbMatch: (record: MatchRecord) => void
match: MatchRecord | null
youFare: number
```

Pay 載入（原樣抄到 Track，不要抽 hook）：

```ts
const view = match ? payView(match, username) : null

useEffect(() => {
  if (view) return
  let cancelled = false
  void fetchMatch()
    .then((record) => {
      if (!cancelled) absorbMatch(record)
    })
    .catch(() => undefined)
  return () => {
    cancelled = true
  }
}, [absorbMatch, view])
```

---

### Task 1: `trackFare` 純函式

**Files:**
- Modify: `web/src/engine/matchView.ts`（加在 `payView` 之後）
- Create: `web/src/engine/trackFare.test.ts`

**Interfaces:**
- Consumes: `payView(record, username)`；`MatchRecord | null`；`Username`；fallback `number`
- Produces:

```ts
export function trackFare(
  record: MatchRecord | null,
  username: Username,
  fallbackFare: number,
): number
```

規則：`record` 為 null 或 `payView` 為 null → 回 `fallbackFare`。否則回 `payView.fare`。不要在 collecting 時用 `ownFare`（該值可為 `0`）。

- [ ] **Step 1: Write the failing tests**

建立 `web/src/engine/trackFare.test.ts`。`as MatchRecord` 只填本函式會讀的欄位：

```ts
import { describe, expect, it } from 'vitest'
import type { MatchRecord } from './match'
import { ownFare, payView, trackFare } from './matchView'

const settled = {
  id: 'current',
  status: 'settled',
  adopted: 'v1',
  riders: [
    { username: 'Yu', outcome: 'share', finalFare: 144 },
    { username: 'Lin', outcome: 'share', finalFare: 260 },
  ],
} as MatchRecord

const collecting = {
  id: 'current',
  status: 'collecting',
  adopted: 'solo',
  riders: [{ username: 'Yu', outcome: 'solo', finalFare: 0 }],
} as MatchRecord

describe('trackFare', () => {
  it('無 match 時保留 fallback youFare', () => {
    expect(trackFare(null, 'Yu', 420)).toBe(420)
  })

  it('collecting 保留 fallback，不用 ownFare 的 0', () => {
    expect(ownFare(collecting, 'Yu')).toBe(0)
    expect(payView(collecting, 'Yu')).toBeNull()
    expect(trackFare(collecting, 'Yu', 420)).toBe(420)
  })

  it('成交後等於 payView.fare 與 ownFare，且不是別人的車資', () => {
    const view = payView(settled, 'Yu')
    expect(view?.fare).toBe(144)
    expect(ownFare(settled, 'Yu')).toBe(144)
    expect(trackFare(settled, 'Yu', 420)).toBe(144)
    expect(trackFare(settled, 'Yu', 420)).not.toBe(260)
  })

  it('solo 狀態也讀自己的 finalFare', () => {
    const solo = { ...settled, status: 'solo', adopted: 'solo' } as MatchRecord
    expect(trackFare(solo, 'Yu', 420)).toBe(144)
  })
})
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `cd web && npm test -- src/engine/trackFare.test.ts`

Expected: FAIL。`trackFare` is not exported.

- [ ] **Step 3: Write minimal implementation**

在 `web/src/engine/matchView.ts` 的 `payView` 之後加入：

```ts
export function trackFare(
  record: MatchRecord | null,
  username: Username,
  fallbackFare: number,
): number {
  if (!record) return fallbackFare
  return payView(record, username)?.fare ?? fallbackFare
}
```

不要改 `ownFare` 或 `payView`。

- [ ] **Step 4: Run tests and confirm they pass**

Run: `cd web && npm test -- src/engine/trackFare.test.ts src/engine/matchView.test.ts`

Expected: PASS。既有 `payView` / `ownFare` 測試仍綠。

---

### Task 2: Track 載入 match 並顯示 `trackFare`

**Files:**
- Modify: `web/src/screens/TrackScreen.tsx`
- Modify: `web/src/engine/trip.ts`（只改第 22 行註解）
- Modify: `web/src/engine/trip.test.ts`（加一則）

**Interfaces:**
- Consumes: Task 1 的 `trackFare`；`fetchMatch`；`absorbMatch`；`payView`（只用來決定要不要 fetch，同 Pay）
- Produces: Track 畫面 `NT${fare}`。`fare === trackFare(match, username, youFare)`。文案仍是 `Your fare`。

- [ ] **Step 1: Write the failing trip test**

在 `web/src/engine/trip.test.ts` 的 `reset` 測試之後加入：

```ts
it('pay 不改 youFare', () => {
  const next = tripReducer(initialTrip(), { type: 'pay' })
  expect(next.paid).toBe(true)
  expect(next.youFare).toBe(CONSENSUS_ROUTE.fares.A)
})
```

此則應立刻通過（鎖行為，防止之後把車資寫進 `pay()`）。

Run: `cd web && npm test -- src/engine/trip.test.ts`

Expected: PASS。

- [ ] **Step 2: Wire TrackScreen**

`web/src/screens/TrackScreen.tsx` 變更如下。

Imports（檔案頂部，不要 inline import）：

```ts
import { fetchMatch } from '../engine/matchApi'
import { payView, trackFare } from '../engine/matchView'
```

在 `useTrip()` 解構加上 `absorbMatch`：

```ts
const { you, youFare, resetTrip, match, absorbMatch } = useTrip()
const username = readSessionUsername() ?? usernameForRider(you.id)
const view = match ? payView(match, username) : null
const fare = trackFare(match, username, youFare)
```

在既有 `booking` / `driveLine` 的 `useEffect` 旁，加上與 Pay 相同的載入（見 File map）。依賴：`[absorbMatch, view]`。

把

```tsx
<strong>NT${youFare}</strong>
```

改成

```tsx
<strong>NT${fare}</strong>
```

`Your fare` 四字不要改。

不要改 `pay()`。不要改 `TripContext`。不要為了 Track 刪 `CONSENSUS_ROUTE`。

- [ ] **Step 3: Fix the trip.ts comment**

`web/src/engine/trip.ts` 第 22 行現在寫「Track 仍用 CONSENSUS_ROUTE」。改成：

```ts
  // youFare 初值來自 CONSENSUS_ROUTE。Track 在 match 已成交時改讀 payView.fare。
```

`playing`、`beatIndex`、`log` 不要在本任務清理。

- [ ] **Step 4: Run unit tests**

Run: `cd web && npm test -- src/engine/trackFare.test.ts src/engine/matchView.test.ts src/engine/trip.test.ts`

Expected: PASS。

---

### Task 3: 全測、瀏覽器、AGENTS.md

**Files:**
- Modify: `AGENTS.md`（只改 Fare 那一句）

**Interfaces:**
- Consumes: Task 1–2 的行為
- Produces: 全測綠；Pay 與 Track 數字相同；重整 Track 後數字仍相同；`AGENTS.md` 與程式一致

- [ ] **Step 1: Full unit suite**

Run: `cd web && npm test`

Expected: PASS。

Run: `cd web && npx tsc -b --pretty false`

Expected: 無錯誤。

- [ ] **Step 2: Browser check（必要）**

專案沒有 RTL。用瀏覽器走真人路徑，不要只截一張圖。

1. `cd web && npm run dev`
2. 登入 `Yu`，與至少一人完成 match（或沿用 `storage/matches/current.json` 已 settled 的團）。
3. 開 Pay：右上 `NT$` 記住數字（應為自己的 `finalFare`，不是 420，除非成交剛好是 420）。
4. Call taxi now → Track。Your fare 必須與 Pay 同一數字。
5. 在 `/ride/track` 重整。Your fare 必須仍是該數字，不得回到 `CONSENSUS_ROUTE` 的 420（Yu）。
6. 若 API 尚未回來：允許短暫顯示 fallback `youFare`，載入後改成交數字。
7. 畫面上不得出現別人的 `NT$`（例如 Lin 的 105）。

若瀏覽器工具可用：Pay → Track → 重整，各讀一次 Your fare 節點。不一致就修，再驗一次。

- [ ] **Step 3: Update AGENTS.md fare fact**

把

```text
The fare/taxi card on Pay shows match conclusion, rider count, and plan on the left, and only this user’s match `finalFare` on the right. Track Your fare still reads `CONSENSUS_ROUTE`, not the match record.
```

改成一句（英文，與檔內其他 facts 同風格）：

```text
The fare/taxi card on Pay shows match conclusion, rider count, and plan on the left, and only this user’s match `finalFare` on the right. Track Your fare uses the same `payView.fare` / own `finalFare`; if match is not ready it keeps current `youFare`.
```

不要改 `AGENTS.md` 其他條。不要在本規劃回合改此檔。

---

## Out of scope

- 刪除或改寫 `CONSENSUS_ROUTE` 本體
- 把 match 存進 `sessionStorage` / `localStorage`
- 在 `pay()` 或 `absorbMatch` 同步 `youFare`
- 抽出 `useMatchIfMissing` 之類的 hook
- 改 Pay 版面或文案
- 提交 git
