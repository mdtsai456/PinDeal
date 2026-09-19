import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import accessIcon from '../assets/icon-pref-access.png'
import timeIcon from '../assets/icon-pref-time.png'
import walkIcon from '../assets/icon-pref-walk.png'
import arrowRightIcon from '../assets/arrow-sm-right-svgrepo-com.svg?url'
import taxiCtaIcon from '../assets/taxi-svgrepo-com.svg?url'
import taxiArt from '../assets/taxicartoon.png'
import bagIcon from '../assets/bag-svgrepo-com.svg?url'
import { readSessionUsername } from '../auth'
import { MapCanvas } from '../components/MapCanvas'
import { Screen } from '../components/Shell'
import { fetchDrivingRoute, straightRoute, type DrivingRoute } from '../directions'
import { riderCircles } from '../engine/corridor'
import { usernameForRider } from '../engine/match'
import { snapshotRoutePage } from '../engine/routePage'
import { placeById, userBookingView } from '../geo'
import { useTrip } from '../TripContext'
import type { RiderDemand } from '../types'

const NOTES_MAX = 300

function onScreenDistanceKm(distanceKm: number): number {
  return distanceKm < 10 ? Number(distanceKm.toFixed(1)) : Math.round(distanceKm)
}

function formatEta(durationMin: number): string {
  const when = new Date(Date.now() + durationMin * 60_000)
  const hours = when.getHours()
  const minutes = String(when.getMinutes()).padStart(2, '0')
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes} ${suffix}`
}

function formatDistance(distanceKm: number): string {
  return distanceKm < 10 ? distanceKm.toFixed(1) : String(Math.round(distanceKm))
}

export function DetailsScreen() {
  const navigate = useNavigate()
  const { you, setYou, joinCurrentMatch } = useTrip()
  const origin = placeById(you.originId)
  const destination = placeById(you.destinationId)
  const booking = useMemo(
    () => userBookingView(you.originId, you.destinationId, 0),
    [you.destinationId, you.originId],
  )
  const [drive, setDrive] = useState<DrivingRoute>(() => straightRoute(origin, destination))
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fallback = straightRoute(origin, destination)
    setDrive(fallback)
    void fetchDrivingRoute(origin, destination).then((route) => {
      if (!cancelled) setDrive(route)
    })
    return () => {
      cancelled = true
    }
  }, [destination, origin])

  const patch = (partial: Partial<RiderDemand>) => setYou({ ...you, ...partial })
  const sharedCap = drive.durationMin + you.maxDetourMin
  const walkCircles = useMemo(
    () => riderCircles(origin, destination, you.maxWalkMin),
    [destination, origin, you.maxWalkMin],
  )
  const notes = you.rawText.slice(0, NOTES_MAX)

  async function onMatch() {
    setError('')
    setPending(true)
    const routePage = snapshotRoutePage({
      pickup: origin,
      dropoff: destination,
      soloDurationMin: drive.durationMin,
      soloDistanceKm: onScreenDistanceKm(drive.distanceKm),
      extraTimeMin: you.maxDetourMin,
      maxWalkMin: you.maxWalkMin,
      bags: you.luggageCount,
      accessible: you.accessibility,
      extraPay: you.extraPay,
      notes: you.rawText,
    })
    const username = readSessionUsername() ?? usernameForRider(you.id)
    const result = await joinCurrentMatch({ username, demand: you, routePage })
    setPending(false)
    switch (result.ok) {
      case true:
        navigate('/ride/negotiate')
        return
      case false:
        setError(result.message)
        return
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  }

  return (
    <Screen>
      <div className="route-page">
        <header className="route-head">
          <button type="button" className="route-back" onClick={() => navigate('/ride/demand')} aria-label="Back">
            ←
          </button>
          <div className="route-head-copy">
            <h2>Your route</h2>
            <p>Review your trip details and matching preferences</p>
          </div>
          <img className="route-taxi" src={taxiArt} alt="" />
        </header>

        <div className="scroll">
          <div className="map-wrap tall route-map">
            <MapCanvas
              stops={booking.stops}
              polyline={drive.polyline}
              variant="direct"
              interactive
              walkCircles={walkCircles}
            />
          </div>

          <article className="route-eta">
            <div>
              <p className="route-kicker">Solo taxi</p>
              <strong>{drive.durationMin} min</strong>
              <p>Best driving path · {formatDistance(drive.distanceKm)} km</p>
            </div>
            <div className="route-eta-right">
              <img src={taxiCtaIcon} alt="" />
              <p className="route-kicker">Estimated arrival</p>
              <strong>{formatEta(drive.durationMin)}</strong>
            </div>
          </article>

          <section className="route-prefs">
            <h3>Matching preferences</h3>
            <p className="route-prefs-lead">Adjust your preferences to find the best match</p>

            <label className="route-pref">
              <span className="route-pref-top route-pref-extra">
                <img src={timeIcon} alt="" />
                Extra time vs solo
                <b>{you.maxDetourMin} min</b>
                <small>
                  A shared ride may take up to {sharedCap} min ({drive.durationMin} + {you.maxDetourMin}).
                </small>
              </span>
              <input
                type="range"
                min={0}
                max={30}
                value={you.maxDetourMin}
                onChange={(event) => patch({ maxDetourMin: Number(event.target.value) })}
              />
            </label>

            <label className="route-pref">
              <span className="route-pref-top">
                <img src={walkIcon} alt="" />
                Max walk time
                <b>{you.maxWalkMin} min</b>
              </span>
              <input
                type="range"
                min={0}
                max={20}
                value={you.maxWalkMin}
                onChange={(event) => patch({ maxWalkMin: Number(event.target.value) })}
              />
            </label>

            <label className="route-pref">
              <span className="route-pref-top">
                <img src={bagIcon} alt="" />
                Bags
                <b>{you.luggageCount}</b>
              </span>
              <input
                type="range"
                min={0}
                max={4}
                value={you.luggageCount}
                onChange={(event) => patch({ luggageCount: Number(event.target.value) })}
              />
            </label>

            <div className="route-checks">
              <label className={`route-check ${you.accessibility ? 'route-check-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={you.accessibility}
                  onChange={(event) => patch({ accessibility: event.target.checked })}
                />
                <span className="route-check-box" aria-hidden />
                <img src={accessIcon} alt="" />
                <span>
                  <b>Accessible vehicle</b>
                  Request a wheelchair accessible taxi
                </span>
              </label>
              <label className={`route-check ${you.extraPay ? 'route-check-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={you.extraPay}
                  onChange={(event) => patch({ extraPay: event.target.checked })}
                />
                <span className="route-check-box" aria-hidden />
                <img src={timeIcon} alt="" />
                <span>
                  <b>Pay extra to stay on time</b>
                  I can pay extra to reduce waiting time
                </span>
              </label>
            </div>

            <label className="route-notes">
              <span className="route-pref-top">
                Notes for matching (optional)
                <b>
                  {notes.length}/{NOTES_MAX}
                </b>
              </span>
              <span className="route-notes-box">
                <svg className="route-notes-clip" viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M8 12.5V7.8A3.3 3.3 0 0 1 14.6 7.8v8.2a2.4 2.4 0 0 1-4.8 0V9.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                <textarea
                  rows={2}
                  maxLength={NOTES_MAX}
                  value={notes}
                  onChange={(event) =>
                    patch({ rawText: event.target.value, extraDemand: event.target.value })
                  }
                />
              </span>
            </label>
          </section>
        </div>

        <div className="route-dock">
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="button" className="route-dock-main" disabled={pending} onClick={() => void onMatch()}>
            Match nearby riders
            <img src={arrowRightIcon} alt="" />
          </button>
        </div>
      </div>
    </Screen>
  )
}
