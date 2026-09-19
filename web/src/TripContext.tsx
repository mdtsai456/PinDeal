import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearSessionUsername, readSessionRiderId, readSessionUsername } from './auth'
import { cloneRider, YOU_ID } from './data'
import { usernameForRider, type MatchRecord } from './engine/match'
import { type JoinMatchResult, postMatchJoin } from './engine/matchApi'
import { keepOwnMatch } from './engine/matchView'
import type { MatchJoinBody } from './engine/routePage'
import type { Place, RiderDemand, SavedSlot, SavedSlotId } from './types'

type TripContextValue = {
  you: RiderDemand
  paid: boolean
  match: MatchRecord | null
  savedSlots: SavedSlot[]
  recents: Place[]
  joinCurrentMatch: (body: MatchJoinBody) => Promise<JoinMatchResult>
  absorbMatch: (record: MatchRecord) => void
  pay: () => void
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

function youFromSession(): RiderDemand {
  return cloneRider(readSessionRiderId() ?? YOU_ID)
}

export function TripProvider({ children }: { children: ReactNode }) {
  const [you, setYou] = useState<RiderDemand>(youFromSession)
  const [paid, setPaid] = useState(false)
  const [match, setMatch] = useState<MatchRecord | null>(null)
  const [savedSlots, setSavedSlots] = useState<SavedSlot[]>(EMPTY_SLOTS)
  const [recents, setRecents] = useState<Place[]>([])

  const sessionUsername = useCallback(() => {
    return readSessionUsername() ?? usernameForRider(you.id)
  }, [you.id])

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

  const setSavedPlace = useCallback((id: SavedSlotId, place: Place) => {
    setSavedSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, place } : slot)))
  }, [])

  const pushRecent = useCallback((place: Place) => {
    setRecents((prev) => [place, ...prev.filter((item) => item.id !== place.id)].slice(0, 6))
  }, [])

  const pay = useCallback(() => {
    setPaid(true)
  }, [])

  const resetTrip = useCallback(() => {
    setMatch(null)
    setPaid(false)
    setYou((current) => cloneRider(current.id))
  }, [])

  const logout = useCallback(() => {
    clearSessionUsername()
    setMatch(null)
    setPaid(false)
    setYou(cloneRider(YOU_ID))
  }, [])

  const value = useMemo<TripContextValue>(
    () => ({
      you,
      paid,
      match,
      savedSlots,
      recents,
      joinCurrentMatch,
      absorbMatch,
      pay,
      resetTrip,
      logout,
      setYou,
      setSavedPlace,
      pushRecent,
    }),
    [
      you,
      paid,
      match,
      savedSlots,
      recents,
      joinCurrentMatch,
      absorbMatch,
      pay,
      resetTrip,
      logout,
    ],
  )

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrip must be used inside TripProvider')
  return ctx
}
