import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { clearSessionUsername, readSessionRiderId, readSessionUsername } from './auth'
import { YOU_ID } from './data'
import { usernameForRider, type MatchRecord } from './engine/match'
import { type JoinMatchResult, postMatchJoin } from './engine/matchApi'
import { keepOwnMatch } from './engine/matchView'
import type { MatchJoinBody } from './engine/routePage'
import { initialTrip, tripReducer, type TripState } from './engine/trip'
import type { IncidentKind, Place, RiderDemand, SavedSlot, SavedSlotId } from './types'

type TripContextValue = TripState & {
  savedSlots: SavedSlot[]
  recents: Place[]
  match: MatchRecord | null
  joinCurrentMatch: (body: MatchJoinBody) => Promise<JoinMatchResult>
  absorbMatch: (record: MatchRecord) => void
  pay: () => void
  runIncident: (kind: IncidentKind) => void
  resetTrip: () => void
  logout: () => void
  setYou: (you: RiderDemand) => void
  setSavedPlace: (id: SavedSlotId, place: Place) => void
  pushRecent: (place: Place) => void
}

const TripContext = createContext<TripContextValue | null>(null)

const EMPTY_SLOTS: SavedSlot[] = [
  { id: 'home', label: 'Home', place: null },
  { id: 'work', label: 'Work', place: null },
  { id: 'favorite', label: 'Favorite', place: null },
]

function tripFromSession(): TripState {
  return initialTrip(readSessionRiderId() ?? YOU_ID)
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tripReducer, undefined, tripFromSession)
  const [savedSlots, setSavedSlots] = useState<SavedSlot[]>(EMPTY_SLOTS)
  const [recents, setRecents] = useState<Place[]>([])
  const [match, setMatch] = useState<MatchRecord | null>(null)

  const sessionUsername = useCallback(() => {
    return readSessionUsername() ?? usernameForRider(state.you.id)
  }, [state.you.id])

  const joinCurrentMatch = useCallback(async (body: MatchJoinBody) => {
    const result = await postMatchJoin(body)
    if (result.ok) setMatch(result.record)
    return result
  }, [])

  const absorbMatch = useCallback(
    (record: MatchRecord) => {
      setMatch((current) => keepOwnMatch(current, record, sessionUsername()))
    },
    [sessionUsername],
  )

  const setYou = useCallback((you: RiderDemand) => {
    dispatch({ type: 'setYou', you })
  }, [])

  const setSavedPlace = useCallback((id: SavedSlotId, place: Place) => {
    setSavedSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, place } : slot)))
  }, [])

  const pushRecent = useCallback((place: Place) => {
    setRecents((prev) => [place, ...prev.filter((item) => item.id !== place.id)].slice(0, 6))
  }, [])

  const resetTrip = useCallback(() => {
    setMatch(null)
    dispatch({ type: 'reset' })
  }, [])

  const logout = useCallback(() => {
    clearSessionUsername()
    setMatch(null)
    dispatch({ type: 'reset', youId: YOU_ID })
  }, [])

  const value = useMemo<TripContextValue>(
    () => ({
      ...state,
      savedSlots,
      recents,
      match,
      joinCurrentMatch,
      absorbMatch,
      pay: () => dispatch({ type: 'pay' }),
      runIncident: (kind) => dispatch({ type: 'incident', kind }),
      resetTrip,
      logout,
      setYou,
      setSavedPlace,
      pushRecent,
    }),
    [
      state,
      match,
      joinCurrentMatch,
      absorbMatch,
      resetTrip,
      logout,
      setYou,
      savedSlots,
      recents,
      setSavedPlace,
      pushRecent,
    ],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip must be used inside TripProvider')
  return ctx
}
