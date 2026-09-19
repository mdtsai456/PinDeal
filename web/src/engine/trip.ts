import { cloneRider, POOL_RIDERS, YOU_ID } from '../data'
import { parseDemands } from './parse'
import { CONSENSUS_ROUTE } from './routes'
import { resolveIncident } from './incidents'
import type {
  IncidentKind,
  IncidentResult,
  NegotiationEvent,
  RiderDemand,
  RiderId,
  SharedRoute,
  StructuredDemand,
} from '../types'

export type LoggedEvent = NegotiationEvent & { id: string }

export type TripState = {
  you: RiderDemand
  structured: StructuredDemand[]
  candidateRoute: SharedRoute | null
  activeRoute: SharedRoute
  // youFare 初值來自 CONSENSUS_ROUTE。Track 在 match 已成交時改讀 payView.fare。
  log: LoggedEvent[]
  accepted: RiderId[]
  playing: boolean
  consensus: boolean
  paid: boolean
  incident: IncidentResult | null
  beatIndex: number
  youFare: number
}

export type TripAction =
  | { type: 'setYou'; you: RiderDemand }
  | { type: 'parse' }
  | { type: 'pay' }
  | { type: 'incident'; kind: IncidentKind }
  | { type: 'reset'; youId?: RiderId }

export function initialTrip(youId: RiderId = YOU_ID): TripState {
  return {
    you: cloneRider(youId),
    structured: [],
    candidateRoute: null,
    activeRoute: CONSENSUS_ROUTE,
    log: [],
    accepted: [],
    playing: false,
    consensus: false,
    paid: false,
    incident: null,
    beatIndex: 0,
    youFare: CONSENSUS_ROUTE.fares[youId],
  }
}

function appendEvent(state: TripState, event: NegotiationEvent, index: number): TripState {
  const riderId = event.riderId
  const youId = state.you.id
  const accepted =
    event.kind === 'accept' && riderId && !state.accepted.includes(riderId)
      ? [...state.accepted, riderId]
      : state.accepted

  let youFare = state.youFare
  if (event.kind === 'fare' && event.riderId === youId && event.fareTo != null) {
    youFare = event.fareTo
  } else if (event.route) {
    youFare = event.route.fares[youId]
  }

  return {
    ...state,
    log: [...state.log, { ...event, id: `evt-${index}-${event.kind}` }],
    candidateRoute: event.route ?? state.candidateRoute,
    activeRoute: event.kind === 'consensus' && event.route ? event.route : state.activeRoute,
    accepted,
    youFare,
    consensus: event.kind === 'consensus' ? true : state.consensus,
    playing: event.kind === 'consensus' ? false : state.playing,
  }
}

export function tripReducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case 'setYou':
      return { ...state, you: action.you, youFare: CONSENSUS_ROUTE.fares[action.you.id] }
    case 'parse':
      return { ...state, structured: parseDemands([state.you, ...POOL_RIDERS]) }
    case 'pay':
      return { ...state, paid: true }
    case 'incident': {
      const result = resolveIncident(action.kind)
      let next: TripState = {
        ...state,
        incident: result,
      }
      result.log.forEach((event, offset) => {
        next = appendEvent(next, event, 1000 + offset)
      })
      return {
        ...next,
        incident: result,
        activeRoute: result.route,
        candidateRoute: result.route,
        youFare: result.route.fares[state.you.id],
      }
    }
    case 'reset':
      return initialTrip(action.youId ?? state.you.id)
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
