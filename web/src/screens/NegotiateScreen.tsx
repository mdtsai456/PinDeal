import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readSessionUsername } from '../auth'
import { Screen } from '../components/Shell'
import { usernameForRider } from '../engine/match'
import { fetchMatch, MATCH_POLL_MS } from '../engine/matchApi'
import { canSkipToPay, isMatchReady, ownTheater, THEATER_LINE_MS } from '../engine/matchView'
import { useTrip } from '../TripContext'

export function NegotiateScreen() {
  const navigate = useNavigate()
  const { you, match, absorbMatch } = useTrip()
  const username = readSessionUsername() ?? usernameForRider(you.id)
  const ready = match != null && isMatchReady(match, username)
  const lines = match && ready ? ownTheater(match, username) : []
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (ready) return
    let cancelled = false
    const pull = async () => {
      try {
        const record = await fetchMatch()
        if (!cancelled) absorbMatch(record)
      } catch {
        return
      }
    }
    void pull()
    const timer = window.setInterval(() => {
      void pull()
    }, MATCH_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [absorbMatch, ready])

  useEffect(() => {
    if (!ready) {
      setShown(0)
      return
    }
    if (lines.length === 0) {
      navigate('/ride/pay')
      return
    }
    if (shown === 0) {
      setShown(1)
      return
    }
    const timer = window.setTimeout(() => {
      if (shown >= lines.length) {
        navigate('/ride/pay')
        return
      }
      setShown((count) => count + 1)
    }, THEATER_LINE_MS)
    return () => window.clearTimeout(timer)
  }, [lines.length, navigate, ready, shown])

  function onSkip() {
    if (!canSkipToPay(match, username)) return
    navigate('/ride/pay')
  }

  return (
    <Screen>
      <div className="match-screen">
        {ready ? (
          <ul className="theater-lines">
            {lines.slice(0, shown).map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        ) : (
          <>
            <div className="spin" aria-hidden />
            <h2>Waiting for nearby riders</h2>
          </>
        )}
        <button type="button" className="ghost-btn" disabled={!canSkipToPay(match, username)} onClick={onSkip}>
          Skip wait
        </button>
      </div>
    </Screen>
  )
}
