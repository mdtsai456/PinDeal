import { JOIN_ROUTE, LEAVE_ROUTE, TRAFFIC_ROUTE } from './routes'
import type { IncidentKind, IncidentResult } from '../types'

const INCIDENTS: Record<IncidentKind, Omit<IncidentResult, 'kind'>> = {
  traffic: {
    headline: 'Highway jam. Route updated.',
    detail: 'You paid extra to stay on time. Your fare is now NT$480.',
    route: TRAFFIC_ROUTE,
    log: [
      {
        kind: 'system',
        title: '突發：國道一號壅塞',
        body: 'Google 路線預估 +12 分。正在重算每位乘客 ETA 與車資。',
      },
      {
        kind: 'reject',
        riderId: 'A',
        title: 'Agent 游否決原路線',
        body: '07:40 才到機場，超過 07:30。要求改較直接路線。',
        rejected: true,
      },
      {
        kind: 'trade',
        riderId: 'A',
        title: '重新交換',
        body: '游再加價 NT$60 改走較直接接駁。林再等 4 分換折扣。',
      },
      {
        kind: 'consensus',
        title: 'v3 重新達成',
        body: 'A 仍趕 07:30，總車資 NT$1,280。',
        route: TRAFFIC_ROUTE,
      },
    ],
  },
  join: {
    headline: 'A fifth rider was not added',
    detail: 'The extra trip conflicted with this group. Your fare is unchanged.',
    route: JOIN_ROUTE,
    log: [
      {
        kind: 'system',
        title: '突發：第五人想加入',
        body: '新乘客從士林去大安，與現有接送順序衝突。',
      },
      {
        kind: 'reject',
        riderId: 'D',
        title: 'Agent 周否決加入',
        body: '再繞會超過 10 分鐘上限。',
        rejected: true,
      },
      {
        kind: 'reject',
        riderId: 'C',
        title: 'Agent 陳否決加入',
        body: '後車廂已滿，無法再加大件行李。',
        rejected: true,
      },
      {
        kind: 'consensus',
        title: '維持原團',
        body: '建議第五人另開一組。現有四人方案不變。',
        route: JOIN_ROUTE,
      },
    ],
  },
  leave: {
    headline: 'One rider left. Fares updated.',
    detail: 'Fewer riders split the meter. Your fare is now NT$450.',
    route: LEAVE_ROUTE,
    log: [
      {
        kind: 'system',
        title: '突發：陳美里退出',
        body: 'C 臨時改搭捷運。重算三人路線與分帳。',
      },
      {
        kind: 'fare',
        riderId: 'B',
        title: '個人費用變化',
        body: '少一人分攤，林的車資 260 → 310。',
        fareFrom: 260,
        fareTo: 310,
      },
      {
        kind: 'fare',
        riderId: 'D',
        title: '個人費用變化',
        body: '周的車資 240 → 320。',
        fareFrom: 240,
        fareTo: 320,
      },
      {
        kind: 'consensus',
        title: 'v4 三人共識',
        body: '後車廂條件解除，A 仍準點到機場。',
        route: LEAVE_ROUTE,
      },
    ],
  },
}

export function resolveIncident(kind: IncidentKind): IncidentResult {
  return { kind, ...INCIDENTS[kind] }
}