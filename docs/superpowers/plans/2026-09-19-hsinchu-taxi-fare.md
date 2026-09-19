# Hsinchu Taxi Fare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 成交車資改用新竹市／新竹縣（含竹北）跳表公式。Pay 與 Track 仍只讀此乘客的 match `finalFare`。牆的獨乘與共乘用同一費率。

**Architecture:** 抽出純函式 `hsinchuMeter`。`runMatch` 的 `soloFare` 與 `totalMeter` 都吃此函式的結果。畫面不改文案、不改讀取路徑。`CONSENSUS_ROUTE` 仍只當 `youFare` 初值。不要用手改 `storage/matches/current.json`；下一輪 `runMatch` 會重算。

**Tech Stack:** Vite 8、React 19、Vitest。不要加 React Testing Library。不要加新套件。

## Global Constraints

- Rider-facing UI is English. Label stays `Your fare`. Pay／Track 數字格式維持 `NT$`。
- Comments and non-code prose: Traditional Chinese, ASD-STE100. Identifiers, APIs, and required technical terms stay English.
- Tests: shallow to deep, split across files. No catch-all test file.
- Simple and direct. No weird wiring. No needless abstractions.
- Pay and Track must keep using the same match `finalFare`. Do not regress Track to `CONSENSUS_ROUTE`.
- Walls: own fare must beat solo. If the meter formula changes, both `soloFare` and the shared split must use the same tariff.
- Do not change locked match protocol: 2–4 agents + 1 arbiter, v1 → pitch → v2 → majority → wall-kick → silent recompute. Theater is not the deal.
- Do not delete `CONSENSUS_ROUTE`.
- Do not commit unless the user asks.
- Do not write API keys into this plan or source.
- Update `AGENTS.md` fare fact only after implementation. Not in the planning turn.

---

## Why Yu is NT$115 and Lin is NT$105

今日公式在 `web/src/engine/match.ts`。Repo 與 `HackMeiChuPlan` **沒有**新竹續程／延滯數字。舊計畫 `docs/superpowers/plans/2026-09-19-multi-window-match.md` 寫死：

```text
soloFare = 80 + round(soloDistanceKm * 25)
totalMeter = round(0.72 * sum(soloFare))
再按獨乘價比例分。最後一人吃四捨五入差額。
```

`storage/matches/current.json` 現況：

| 乘客 | `soloDistanceKm` | `soloDurationMin` | `soloFare` | v1 `fare` | `finalFare` | `adopted` |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Yu | 3.2 | 6 | 160 | 115 | 115 | v1 |
| Lin | 2.6 | 5 | 145 | 105 | 105 | v1 |

算術：

```text
Yu  soloFare = 80 + round(3.2 * 25) = 80 + 80 = 160
Lin soloFare = 80 + round(2.6 * 25) = 80 + 65 = 145
sum = 305
totalMeter = round(0.72 * 305) = round(219.6) = 220
Yu  = round(220 * 160 / 305) = round(115.409…) = 115
Lin = 220 - 115 = 105
```

`80 + 25 * km` 把 **全程**（含起跳 1.25 km）都用每公里 25 元算，再加 80。這不是新竹跳表。這也不是大臺北現行表（起跳 85）。沒有延滯計時。

成交走 v1：Yu 的 `scoreV2 === scoreV1`（不算贊成 v2）。Lin 的 `scoreV2 < scoreV1`。2 人要 2 票才用 v2。故 `adopted === "v1"`，`finalFare` = v1。

畫面路徑（已對齊，本計畫不要改）：

```text
runMatch → rider.finalFare
Pay  → payView(match, username).fare === own finalFare
Track → trackFare(match, username, youFare)
        有 payView 則用 payView.fare
        否則才退回 youFare（初值 CONSENSUS_ROUTE：Yu=420）
```

`CONSENSUS_ROUTE.fares`（A=420, B=260, …）是舊機場共乘劇場數字。成交後 Pay／Track **不得**再顯示它。

---

## Tariff research

Repo 內（`HackMeiChuPlan`、`docs`）**沒有** 1.25 km 之後的續程或等候費率。以下來自公開網頁。未核到的項目標在 **Needs confirm**。

### 新竹市（官方）

來源：[新竹市政府交通處「簡介」](https://dep-traffic.hccg.gov.tw/ch/home.jsp?id=40&parentpath=0%2C39)（頁內表「新竹市計程車運價日夜同錶（108年12月1日起實施）」）。2026-09-19 讀到：

| 項目 | 官方數字 |
| --- | --- |
| 起程 | 1250 公尺、100 元 |
| 續程 | 200 公尺、5 元 |
| 計時 | 80 秒、5 元。時速低於 5 公里才計。 |
| 夜間 | 23:00–06:00，每趟加收 20 元 |
| 其他 | 無線電叫車、開後行李箱不另收費。春節得另議，上限 30%。 |

續程 200 公尺 5 元 = 起跳後每公里 25 元。與今日 `* 25` 的斜率相同。差在起跳：**官方先給 1.25 km／100 元**，今日公式卻對這 1.25 km 再收約 31 元。

### 新竹縣／竹北

未找到縣府現行 HTML 運價表。次級來源與 2019 調整新聞與市表一致：

- [Newtalk 2019-11-29](https://newtalk.tw/news/view/2019-11-29/333586)（引新竹縣政府）：2019-12-01 起，起程仍 1250 公尺 100／夜間 120。續程由 250 公尺 5 元改 **200 公尺 5 元**。延滯由 180 秒 5 元改 **80 秒 5 元**。
- [yoxi 縣市費率](https://www.yoxi.app/promotion/925)（2026-01-19）：「新竹縣市」小黃 = 1250 公尺 100 元；每 200 公尺 +5；時速 &lt; 5 km/h 每 80 秒 +5；夜間 +20。
- [新進車隊費率頁](https://www.hsinjin.com/feeships.html)：同表，並寫「新竹縣計程車運價標準」。

Demo 走廊在新竹市東區（車站、北大路、清大）。市表足夠覆蓋預設點。縣／市續程與延滯自 2019-12-01 起對齊。

### 對大臺北（官方對照）

來源：[新北市政府 112-04-01 運價新聞](https://www.ntpc.gov.tw/ch/home.jsp?dataserno=6de3731612ab144a8911537a2a34e600&id=e8ca970cde5c00e1) 與 [新北市交通局運價 PDF](https://www.traffic.ntpc.gov.tw/uploaddowndoc?dis=download&file=download%2F202401041136450.pdf&filedisplay=%E6%96%B0%E5%8C%97%E5%B8%82%E8%A8%88%E7%A8%8B%E8%BB%8A%E9%81%8B%E5%83%B9%28%E5%90%AB%E6%98%A5%E7%AF%80%29.pdf)。

| 項目 | 新竹市／縣 | 大臺北（北北基主運價） |
| --- | --- | --- |
| 起跳 | **100**／1.25 km | **85**／1.25 km |
| 續程 | 200 m／5 元（相同） | 200 m／5 元 |
| 延滯（時速 &lt; 5 km/h） | **每 80 秒 5 元** | **每 60 秒 5 元** |
| 夜間 | +20／趟 | +20／趟 |

使用者說「塞車跳得比臺北快」。**官方相反**：大臺北 2023-04-01 起把延滯從 80 秒改成 60 秒。新竹仍是 80 秒。新竹貴在起跳 +15 元，不在塞車秒數。

錯誤次級來源（不要用）：[LINE GO 新竹計程車文](https://www.linego.me/news/252) 寫「臺北延滯 100 秒」。與新北市府公告不符。

### 對今日引擎的影響（距離-only）

`hsinchuMeter({ distanceKm, delaySec: 0, night: false })`：

```text
Yu  3.2 km → extra 1950 m → ceil(1950/200)=10 → 100+50 = 150   （今日 160）
Lin 2.6 km → extra 1350 m → ceil(1350/200)=7  → 100+35 = 135   （今日 145）
totalMeter = round(0.72 * 285) = 205
Yu  share = round(205 * 150 / 285) = 108
Lin share = 205 - 108 = 97
```

官方距離表會讓 **Yu／Lin 比現在的 115／105 更低**。現公式對起跳段重複計價，所以偏高。若產品要「新竹看起來更貴」，必須另加延滯，或改 `SHARE_METER_RATIO`。不要在未確認前改 0.72。

大臺北距離-only 對照：Yu 85+50=135，Lin 85+35=120。新竹距離-only 各高 15 元（只差起跳）。

Yu 的 `latestArrival` 是 21:40。夜間 23:00 起。v1 **不要**加夜間 20 元。

---

## Approaches

### A. 引擎重算跳表

`soloFare` 與 `totalMeter` 改新竹公式。`finalFare`、theater、Pay、Track 自動變。牆仍是 `fare >= soloFare`。

優：數字真的改，對準使用者指的 NT$。劣：Yu／Lin 會從 115／105 變成新數字（距離-only 是 108／97）。

### B. 只改文案

加一句 English 說明「Hsinchu flag NT$100」。**不夠。**使用者指的是 Track 上的 NT$115／NT$105。

### C. 混合（建議）

引擎用新竹表（同 A）。UI 維持 `Your fare` + `NT$` + `finalFare`。Pay 與 Track 繼續走 `payView`／`trackFare`。不解釋公式。不改協議。不刪 `CONSENSUS_ROUTE`。

**建議 C。** C 就是「A + 鎖定現有畫面路徑」。B 單獨不做。

共乘總額 v1 仍用 `round(0.72 * sum(soloFare))`。今日沒有「整團一條路」的公里數。不要在本計畫發明共乘路線跳表。之後若有整團距離，再另開計畫，且獨乘與共乘仍必須同一 `hsinchuMeter`。

---

## Needs confirm

實作前請批下列數字。未批則 Task 2 用「建議預設」。標 **TODO** 的不是官方表，是 Demo 近似。

| # | 項目 | 建議預設 | 來源 | 要批？ |
| --- | --- | --- | --- | --- |
| 1 | 起跳 | 100 元／1.25 km | 使用者 + 市交通處 | 否 |
| 2 | 續程 | 每 200 m +5 元；`ceil(extraM / 200)` | 市交通處 | 市表已夠。縣表未抓到 PDF。預設市／縣同表。 |
| 3 | 延滯費率 | 時速 &lt; 5 km/h，每 80 秒 +5 元；`floor(delaySec / 80)` | 市交通處 | **要。** 使用者說比臺北快；官方臺北是 60 秒。本計畫用 **80 秒**。 |
| 4 | `delaySec` 怎麼來 | **TODO（非官方）：** `max(0, durationMin*60 − distanceKm/30*3600)`。巡航 30 km/h 是 Demo 常數，不是法令。 | 無官方。今日引擎也用約 28 km/h 估時間。 | **要。** 現檔 Yu 6 min／3.2 km、Lin 5 min／2.6 km 會得到 **delaySec=0**。故現走廊仍是 108／97。 |
| 5 | 夜間 +20 | v1 固定 `night: false` | 市交通處有此項；Yu 21:40 不在時段 | **要** 若希望依 `latestArrival` 判斷 |
| 6 | `SHARE_METER_RATIO` | 維持 **0.72** | 現行協議 | **要** 若希望 115／105 升高而不是降 |
| 7 | 春節 30% | 不做 | 市交通處 | 否 |

若要「塞車比較貴」且現走廊 ETA 偏短，不要改官方 80 秒。改 #4。可選 **TODO** 方案（須另批，不要當官方）：

```text
delaySec = durationMin * 60 * TRAFFIC_FRACTION
TRAFFIC_FRACTION = 0.25
```

Yu 獨乘 90 秒 → +5 → solo 155。Lin 75 秒 → +0 → solo 135。共乘約 Yu 112／Lin 97。仍低於 115／105。

**批示用一句（請擇一）：**

1. `距離 + 延滯費率 80 秒；delaySec 用巡航 30 km/h。現走廊接受 108／97。`
2. `只要距離。delaySec 恒 0。現走廊 108／97。`
3. `距離 + TODO TRAFFIC_FRACTION=___ 。不要假裝這是官方延滯。`
4. `維持 0.72，但我想要大約 NT$___／___。另開數字，不要改牆規則。`

未回覆則實作 **選項 1**（建議預設）。

---

## File map

| File | Role |
| --- | --- |
| `web/src/engine/taxiTariff.ts` | 新建。常數 + `hsinchuMeter` + `delaySecFromTrip`。 |
| `web/src/engine/taxiTariff.test.ts` | 新建。淺：起跳、續程、延滯、夜間。深：Yu 3.2／Lin 2.6 距離例。 |
| `web/src/engine/match.ts` | 刪 `soloFareFromKm`。`prepareRider` 改呼叫 `hsinchuMeter`。`SHARE_METER_RATIO` 不變。 |
| `web/src/engine/hsinchuMatchFare.test.ts` | 新建。深：用現檔公里／分鐘跑 `runMatch`，對 `soloFare`／`finalFare`／牆。 |
| `web/src/engine/match.test.ts` | 只修會因新 `soloFare` 失敗的斷言。`0.72 * sum(soloFare)` 那則應仍過。 |
| `AGENTS.md` | 實作後加一行費率事實。規劃回合不改。 |

不要改：`matchView.ts`（`payView`／`trackFare`／`ownFare`）、`PayScreen.tsx`、`TrackScreen.tsx`、`trip.ts` 的 `youFare` 行為、`routes.ts` 的 `CONSENSUS_ROUTE`、`theater.ts`（它已讀 `finalFare`）。

不要用手改：`storage/matches/current.json`。

### 既有介面（直接用）

```ts
// web/src/engine/match.ts
export function runMatch(seeds: MatchSeed[]): MatchRecord
export function splitBySolo(soloFares: number[], totalMeter: number): number[]
export function hitsWall(offer: OfferSlice, walls: WallInput): boolean
const SHARE_METER_RATIO = 0.72

// web/src/engine/matchView.ts
export function payView(record: MatchRecord, username: Username): PayView | null
export function trackFare(record: MatchRecord | null, username: Username, fallbackFare: number): number
// PayView.fare === own rider finalFare
```

### 本計畫要產出的介面

```ts
// web/src/engine/taxiTariff.ts
export const HSINCHU_TAXI = {
  flagNt: 100,
  flagKm: 1.25,
  incrementM: 200,
  incrementNt: 5,
  waitSec: 80,
  waitNt: 5,
  nightExtraNt: 20,
  slowSpeedKmh: 5,
} as const

// TODO(user-confirm): Demo 巡航，不是法令。Needs confirm #4。
export const DEMO_CRUISE_KMH = 30

export function extraDistanceJumps(distanceKm: number): number
export function waitJumps(delaySec: number): number
export function delaySecFromTrip(distanceKm: number, durationMin: number): number
export function hsinchuMeter(input: {
  distanceKm: number
  delaySec?: number
  night?: boolean
}): number
```

---

### Task 1: `hsinchuMeter` 純函式

**Files:**
- Create: `web/src/engine/taxiTariff.ts`
- Test: `web/src/engine/taxiTariff.test.ts`

**Interfaces:**
- Consumes: 無。不要 import `match.ts`。
- Produces: 上表四個函式與兩個常數。

- [ ] **Step 1: Write the failing tests**

建立 `web/src/engine/taxiTariff.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  DEMO_CRUISE_KMH,
  delaySecFromTrip,
  extraDistanceJumps,
  HSINCHU_TAXI,
  hsinchuMeter,
  waitJumps,
} from './taxiTariff'

describe('HSINCHU_TAXI', () => {
  it('起跳與續程與延滯用市交通處數字', () => {
    expect(HSINCHU_TAXI.flagNt).toBe(100)
    expect(HSINCHU_TAXI.flagKm).toBe(1.25)
    expect(HSINCHU_TAXI.incrementM).toBe(200)
    expect(HSINCHU_TAXI.incrementNt).toBe(5)
    expect(HSINCHU_TAXI.waitSec).toBe(80)
    expect(HSINCHU_TAXI.waitNt).toBe(5)
  })
})

describe('extraDistanceJumps', () => {
  it('未超過起跳是 0', () => {
    expect(extraDistanceJumps(1.25)).toBe(0)
    expect(extraDistanceJumps(0.4)).toBe(0)
  })

  it('剛過起跳跳 1 格', () => {
    expect(extraDistanceJumps(1.2501)).toBe(1)
  })

  it('Yu 3.2 km 與 Lin 2.6 km', () => {
    expect(extraDistanceJumps(3.2)).toBe(10)
    expect(extraDistanceJumps(2.6)).toBe(7)
  })
})

describe('waitJumps', () => {
  it('未滿 80 秒不跳', () => {
    expect(waitJumps(0)).toBe(0)
    expect(waitJumps(79)).toBe(0)
    expect(waitJumps(80)).toBe(1)
    expect(waitJumps(160)).toBe(2)
  })
})

describe('hsinchuMeter', () => {
  it('起跳內是 100', () => {
    expect(hsinchuMeter({ distanceKm: 1.0 })).toBe(100)
    expect(hsinchuMeter({ distanceKm: 1.25 })).toBe(100)
  })

  it('距離-only：Yu 150、Lin 135', () => {
    expect(hsinchuMeter({ distanceKm: 3.2 })).toBe(150)
    expect(hsinchuMeter({ distanceKm: 2.6 })).toBe(135)
  })

  it('延滯與夜間可加在距離之上', () => {
    expect(hsinchuMeter({ distanceKm: 1.25, delaySec: 80 })).toBe(105)
    expect(hsinchuMeter({ distanceKm: 1.25, night: true })).toBe(120)
  })
})

describe('delaySecFromTrip', () => {
  it('現走廊 Yu／Lin 延滯是 0', () => {
    expect(DEMO_CRUISE_KMH).toBe(30)
    expect(delaySecFromTrip(3.2, 6)).toBe(0)
    expect(delaySecFromTrip(2.6, 5)).toBe(0)
  })

  it('時間明顯長於巡航才有延滯', () => {
    expect(delaySecFromTrip(2.4, 12)).toBeGreaterThanOrEqual(80)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- src/engine/taxiTariff.test.ts`

Expected: FAIL。`taxiTariff` 不存在。

- [ ] **Step 3: Write minimal implementation**

建立 `web/src/engine/taxiTariff.ts`。import 放檔案頂。註解用繁中短句。

```ts
export const HSINCHU_TAXI = {
  flagNt: 100,
  flagKm: 1.25,
  incrementM: 200,
  incrementNt: 5,
  waitSec: 80,
  waitNt: 5,
  nightExtraNt: 20,
  slowSpeedKmh: 5,
} as const

// TODO(user-confirm): Demo 巡航。不是法令。見計畫 Needs confirm #4。
export const DEMO_CRUISE_KMH = 30

export function extraDistanceJumps(distanceKm: number): number {
  if (distanceKm <= HSINCHU_TAXI.flagKm) return 0
  const extraM = (distanceKm - HSINCHU_TAXI.flagKm) * 1000
  return Math.ceil(extraM / HSINCHU_TAXI.incrementM)
}

export function waitJumps(delaySec: number): number {
  if (delaySec <= 0) return 0
  return Math.floor(delaySec / HSINCHU_TAXI.waitSec)
}

export function delaySecFromTrip(distanceKm: number, durationMin: number): number {
  const movingSec = (distanceKm / DEMO_CRUISE_KMH) * 3600
  return Math.max(0, Math.round(durationMin * 60 - movingSec))
}

export function hsinchuMeter(input: {
  distanceKm: number
  delaySec?: number
  night?: boolean
}): number {
  const distance = HSINCHU_TAXI.flagNt + extraDistanceJumps(input.distanceKm) * HSINCHU_TAXI.incrementNt
  const wait = waitJumps(input.delaySec ?? 0) * HSINCHU_TAXI.waitNt
  const night = input.night ? HSINCHU_TAXI.nightExtraNt : 0
  return distance + wait + night
}
```

使用者若批選項 2：`delaySecFromTrip` 改為恒回 `0`，並改對應測試。若批選項 3：另寫 `delaySec = durationMin * 60 * TRAFFIC_FRACTION`，常數寫進 `taxiTariff.ts` 並標 TODO。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- src/engine/taxiTariff.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit only if the user asks**

```bash
git add web/src/engine/taxiTariff.ts web/src/engine/taxiTariff.test.ts
git commit -m "$(cat <<'EOF'
Add Hsinchu taxi meter helpers.

EOF
)"
```

---

### Task 2: `runMatch` 改吃新竹表

**Files:**
- Modify: `web/src/engine/match.ts`（`soloFareFromKm`、`prepareRider`）
- Test: `web/src/engine/match.test.ts`（只修破裂斷言）
- Test: `web/src/engine/hsinchuMatchFare.test.ts`（新建）

**Interfaces:**
- Consumes: Task 1 的 `hsinchuMeter`、`delaySecFromTrip`
- Produces: `rider.v1.soloFare === hsinchuMeter({ distanceKm: routePage.soloDistanceKm, delaySec: delaySecFromTrip(...) })`。`totalMeter` 仍是 `round(0.72 * sum(soloFare))`。`hitsWall` 仍是 `fare >= soloFare`。

- [ ] **Step 1: Write the failing corridor test**

建立 `web/src/engine/hsinchuMatchFare.test.ts`。不要塞進 `match.test.ts`。

```ts
import { describe, expect, it } from 'vitest'
import { cloneRider } from '../data'
import { hitsWall, runMatch, splitBySolo, usernameForRider, type MatchSeed } from './match'
import { snapshotRoutePage } from './routePage'
import { delaySecFromTrip, hsinchuMeter } from './taxiTariff'

function corridorSeed(
  id: 'A' | 'B',
  km: number,
  durationMin: number,
  extraTimeMin: number,
  maxWalkMin: number,
): MatchSeed {
  const demand = cloneRider(id)
  return {
    username: usernameForRider(id),
    demand,
    routePage: snapshotRoutePage({
      pickup: {
        id: demand.originId,
        name: demand.originId,
        address: '',
        lat: 24.8018,
        lng: 120.9717,
      },
      dropoff: {
        id: demand.destinationId,
        name: demand.destinationId,
        address: '',
        lat: 24.7956,
        lng: 120.9925,
      },
      soloDurationMin: durationMin,
      soloDistanceKm: km,
      extraTimeMin,
      maxWalkMin,
      bags: demand.luggageCount,
      accessible: demand.accessibility,
      extraPay: demand.extraPay,
      notes: demand.rawText,
    }),
  }
}

describe('hsinchu corridor fares', () => {
  it('Yu／Lin 獨乘用同一跳表，且不是 80+25*km', () => {
    const record = runMatch([
      corridorSeed('A', 3.2, 6, 20, 8),
      corridorSeed('B', 2.6, 5, 18, 10),
    ])
    const yu = record.riders.find((rider) => rider.username === 'Yu')
    const lin = record.riders.find((rider) => rider.username === 'Lin')
    const yuSolo = hsinchuMeter({
      distanceKm: 3.2,
      delaySec: delaySecFromTrip(3.2, 6),
    })
    const linSolo = hsinchuMeter({
      distanceKm: 2.6,
      delaySec: delaySecFromTrip(2.6, 5),
    })
    expect(yu?.v1.soloFare).toBe(yuSolo)
    expect(lin?.v1.soloFare).toBe(linSolo)
    expect(yu?.v1.soloFare).not.toBe(160)
    expect(lin?.v1.soloFare).not.toBe(145)
  })

  it('共乘總額仍是 0.72 倍獨乘和，且每人低於自己的獨乘', () => {
    const record = runMatch([
      corridorSeed('A', 3.2, 6, 20, 8),
      corridorSeed('B', 2.6, 5, 18, 10),
    ])
    const yu = record.riders.find((rider) => rider.username === 'Yu')
    const lin = record.riders.find((rider) => rider.username === 'Lin')
    const solos = [yu?.v1.soloFare ?? 0, lin?.v1.soloFare ?? 0]
    const totalMeter = Math.round(0.72 * (solos[0]! + solos[1]!))
    const split = splitBySolo(solos, totalMeter)
    expect(record.status).toBe('settled')
    expect(record.adopted).toBe('v1')
    expect(yu?.finalFare).toBe(split[0])
    expect(lin?.finalFare).toBe(split[1])
    expect(yu?.finalFare).toBeLessThan(yu?.v1.soloFare ?? 0)
    expect(lin?.finalFare).toBeLessThan(lin?.v1.soloFare ?? 0)
  })

  it('牆用同一費率：fare === soloFare 仍撞牆', () => {
    const solo = hsinchuMeter({ distanceKm: 3.2, delaySec: delaySecFromTrip(3.2, 6) })
    expect(
      hitsWall(
        {
          walkMin: 4,
          rideMin: 10,
          fare: solo,
          soloFare: solo,
          soloRideMin: 6,
          accessible: true,
          luggageOk: true,
        },
        {
          maxWalkMin: 8,
          maxDetourMin: 20,
          accessibility: false,
          luggageCount: 1,
        },
      ),
    ).toBe(true)
  })
})
```

建議預設（選項 1、現走廊 delay=0）期望值：`yuSolo=150`、`linSolo=135`、`totalMeter=205`、`finalFare` Yu=108、Lin=97。可加兩則明確數字，但不要寫死舊的 115／105。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- src/engine/hsinchuMatchFare.test.ts`

Expected: FAIL。`soloFare` 仍是 160／145。

- [ ] **Step 3: Wire `match.ts`**

檔案頂增加（與其他 import 放一起）：

```ts
import { delaySecFromTrip, hsinchuMeter } from './taxiTariff.ts'
```

刪除：

```ts
function soloFareFromKm(distanceKm: number): number {
  return 80 + Math.round(distanceKm * 25)
}
```

新增：

```ts
function soloFareFromPage(page: RoutePageSnapshot): number {
  return hsinchuMeter({
    distanceKm: page.soloDistanceKm,
    delaySec: delaySecFromTrip(page.soloDistanceKm, page.soloDurationMin),
    night: false,
  })
}
```

`prepareRider` 內 `const soloFare = soloFareFromKm(routePage.soloDistanceKm)` 改成 `const soloFare = soloFareFromPage(routePage)`。

不要改 `SHARE_METER_RATIO`。不要改 `assignV1`／`silentRecompute` 的 `0.72 * sum(solos)`。不要改 `hitsWall`。

- [ ] **Step 4: Run match tests**

Run: `cd web && npm test -- src/engine/taxiTariff.test.ts src/engine/hsinchuMatchFare.test.ts src/engine/match.test.ts src/engine/matchView.test.ts src/engine/trackFare.test.ts src/engine/theater.test.ts`

Expected: 新檔 PASS。`match.test.ts` 的相對斷言（`finalFare < soloFare`、`0.72 * sum(soloFare)`）應仍過。若有寫死舊 80+25*km 的數字，改成讀實際 `soloFare`，不要把舊 160／145 寫回去。

`match.test.ts` 的 `seedFrom` 用 `soloDistanceKm: 2.4`、`soloDurationMin: 12`。巡航 30 km/h 時會有延滯。這是要的：同一函式在距離與時間上都工作。不要為了測過而把 12 改成 5。

- [ ] **Step 5: Commit only if the user asks**

```bash
git add web/src/engine/match.ts web/src/engine/match.test.ts web/src/engine/hsinchuMatchFare.test.ts
git commit -m "$(cat <<'EOF'
Price match fares with the Hsinchu meter.

EOF
)"
```

---

### Task 3: 對齊檢查與 AGENTS 事實

**Files:**
- Modify: `AGENTS.md`（只在實作後）
- 不要改 Pay／Track 畫面檔

**Interfaces:**
- Consumes: Task 2 的 `finalFare`
- Produces: Pay／Track 仍顯示自己的 `finalFare`。`AGENTS.md` 多一行費率事實。

- [ ] **Step 1: Lock Pay／Track alignment tests**

不要新寫畫面測試。跑既有：

Run: `cd web && npm test -- src/engine/trackFare.test.ts src/engine/matchView.test.ts`

Expected: PASS。`trackFare` 仍等於 `payView.fare`／`ownFare`。fixture 數字（144／260）不要改成新竹表。那些檔在鎖「讀自己的 `finalFare`」，不鎖公式。

- [ ] **Step 2: Manual / browser check**

1. `POST /api/match/reset` 後，Yu 與 Lin 用現預設起訖再 Match。
2. 開 Yu 的 Pay：右上 `NT$` 必須是 Yu 的 `finalFare`（建議預設 108，不是 115，也不是 420）。
3. Call taxi now → Track `Your fare` 必須同一數字。
4. 重整 `/ride/track`。數字不得回到 `CONSENSUS_ROUTE` 420。
5. 開 Lin 窗。Pay／Track 必須是 Lin 的 `finalFare`（建議預設 97）。DOM 不得出現 Yu 的 `NT$`。
6. theater 最後一行必須是 `Your fare is NT$<own finalFare>.`

若瀏覽器工具可用：Pay → Track → 重整，各讀一次 Your fare。不一致就修，再驗一次。

- [ ] **Step 3: Update AGENTS.md fare fact**

在 Learned Workspace Facts 加一句（實作後，數字用當時批過的公式）：

```text
Match soloFare and share split use the Hsinchu taxi meter (flag NT$100 / 1.25 km, then NT$5 per 200 m; delay NT$5 per 80 s when duration exceeds cruise). Pay and Track still read own finalFare.
```

不要改 Pay／Track 那句已鎖定的 `finalFare`／`trackFare` 事實。

- [ ] **Step 4: Commit only if the user asks**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
Record the Hsinchu meter in workspace facts.

EOF
)"
```

---

## Out of scope

- 不重算 `CONSENSUS_ROUTE`／`TRAFFIC_ROUTE`／`REJECTED_ROUTE`。
- 不改 `incidents.ts` 或 `SideScreens.tsx` 的展示數字。
- 不做春節 30%、行李箱加價、無線電加價。
- 不依 GPS 速度在 &lt; 5 km/h 切換計時（Demo 沒有速度軌）。
- 不把整團共乘畫成「一趟跳表再分帳」。本計畫仍用 0.72 × 獨乘和。
- 不改牆軸、pitch、majority、theater 規則。

---

## Self-review

- 使用者指 NT$ → Task 2 改引擎數字。B 單獨不做。
- Pay／Track 對齊 → 不改讀取路徑；Task 3 重跑 `trackFare` 測試。
- 牆 → `soloFare` 與 share 同一 `hsinchuMeter`；`fare >= soloFare` 不變。
- 測試拆檔 → `taxiTariff.test.ts` 淺、`hsinchuMatchFare.test.ts` 深。不把公式測塞進 `trackFare.test.ts`。
- 續程 200 m／5 元有市府網頁。延滯怎麼從 ETA 推出秒數是 TODO，已放 Needs confirm。
- 未寫「之後再補公式」而不給程式。Commit 門檻遵使用者：未要求就不 commit。
