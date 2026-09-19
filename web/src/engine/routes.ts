import { lineOf } from '../geo'
import type { RiderId, RouteStop, SharedRoute } from '../types'

function stop(
  id: string,
  kind: RouteStop['kind'],
  riderId: RiderId,
  placeId: string,
  time: string,
  waitMin: number,
): RouteStop {
  return { id, kind, riderId, placeId, time, waitMin }
}

export function fareSum(route: SharedRoute): number {
  return route.fares.A + route.fares.B + route.fares.C + route.fares.D
}

export const REJECTED_ROUTE: SharedRoute = {
  id: 'v1-detour',
  label: '方案 v1 · 順路接完再走機場',
  durationMin: 78,
  totalFare: 1200,
  fares: { A: 390, B: 250, C: 270, D: 290 },
  notes: ['D 繞路約 18 分鐘', 'C 後車廂未確認', 'A 預估 07:36 抵達，超過 07:30'],
  polyline: lineOf([
    'taipeiMain',
    'xinzhuang',
    'banqiao',
    'zhonghe',
    'taipeiMain',
    'nangang',
    'songshanAirport',
    'taoyuanAirport',
  ]),
  stops: [
    stop('v1-1', 'pickup', 'A', 'taipeiMain', '07:00', 0),
    stop('v1-2', 'pickup', 'C', 'xinzhuang', '07:12', 4),
    stop('v1-3', 'pickup', 'B', 'banqiao', '07:22', 3),
    stop('v1-4', 'pickup', 'D', 'zhonghe', '07:30', 2),
    stop('v1-5', 'dropoff', 'C', 'taipeiMain', '07:44', 0),
    stop('v1-6', 'dropoff', 'D', 'nangang', '08:02', 0),
    stop('v1-7', 'dropoff', 'B', 'songshanAirport', '08:14', 0),
    stop('v1-8', 'dropoff', 'A', 'taoyuanAirport', '08:36', 0),
  ],
}

export const CONSENSUS_ROUTE: SharedRoute = {
  id: 'v2-consensus',
  label: '方案 v2 · 景安集合 + 準點機場線',
  durationMin: 52,
  totalFare: 1200,
  fares: { A: 420, B: 260, C: 280, D: 240 },
  notes: [
    'A 加價換準點，07:28 到桃園機場',
    'B 接受等待 9 分，費用折扣',
    'C 占用後車廂，適度分攤',
    'D 步行 6 分到景安集合，繞路 8 分',
  ],
  polyline: lineOf([
    'taipeiMain',
    'xinzhuang',
    'banqiao',
    'zhonghe',
    'nangang',
    'songshanAirport',
    'taoyuanAirport',
  ]),
  stops: [
    stop('v2-1', 'pickup', 'A', 'taipeiMain', '07:00', 0),
    stop('v2-2', 'pickup', 'C', 'xinzhuang', '07:10', 6),
    stop('v2-3', 'pickup', 'B', 'banqiao', '07:15', 9),
    stop('v2-4', 'meet', 'D', 'zhonghe', '07:18', 0),
    stop('v2-5', 'dropoff', 'A', 'taoyuanAirport', '07:28', 0),
    stop('v2-6', 'dropoff', 'C', 'taipeiMain', '07:32', 0),
    stop('v2-7', 'dropoff', 'B', 'songshanAirport', '07:40', 0),
    stop('v2-8', 'dropoff', 'D', 'nangang', '07:45', 0),
  ],
}

export const TRAFFIC_ROUTE: SharedRoute = {
  ...CONSENSUS_ROUTE,
  id: 'v3-traffic',
  label: '方案 v3 · 改走機場捷運接駁，避開國道',
  durationMin: 58,
  totalFare: 1280,
  fares: { A: 480, B: 270, C: 290, D: 240 },
  notes: [
    '國道壅塞 +12 分，A 原 07:28 會變成 07:40',
    'A 加價改較直接路線，仍趕 07:30',
    'B 再多等 4 分，補折扣',
    'D 路線不變',
  ],
}

export const LEAVE_ROUTE: SharedRoute = {
  id: 'v4-leave',
  label: '方案 v4 · C 退出後三人共乘',
  durationMin: 46,
  totalFare: 1080,
  fares: { A: 450, B: 310, C: 0, D: 320 },
  notes: ['後車廂條件解除', '少一人分攤，B / D 車資上升', 'A 仍走準點機場線'],
  polyline: lineOf(['taipeiMain', 'banqiao', 'zhonghe', 'nangang', 'songshanAirport', 'taoyuanAirport']),
  stops: [
    stop('v4-1', 'pickup', 'A', 'taipeiMain', '07:00', 0),
    stop('v4-2', 'pickup', 'B', 'banqiao', '07:12', 5),
    stop('v4-3', 'meet', 'D', 'zhonghe', '07:18', 0),
    stop('v4-4', 'dropoff', 'A', 'taoyuanAirport', '07:27', 0),
    stop('v4-5', 'dropoff', 'B', 'songshanAirport', '07:36', 0),
    stop('v4-6', 'dropoff', 'D', 'nangang', '07:40', 0),
  ],
}

export const JOIN_ROUTE: SharedRoute = {
  ...CONSENSUS_ROUTE,
  id: 'v5-split',
  label: '方案 v5 · 維持四人，不加入第五人',
  notes: ['第五人起訖與現有團衝突', '建議另開一組，不拆現有共識'],
}