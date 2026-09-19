import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readSessionUsername } from '../auth'
import { Screen, StepHeader } from '../components/Shell'
import { MapCanvas } from '../components/MapCanvas'
import { fetchDrivingRoute, straightRoute, type DrivingRoute } from '../directions'
import { riderCircles } from '../engine/corridor'
import { usernameForRider } from '../engine/match'
import { snapshotRoutePage } from '../engine/routePage'
import { placeById, userBookingView } from '../geo'
import { useTrip } from '../TripContext'
import type { RiderDemand } from '../types'

function onScreenDistanceKm(distanceKm: number): number {
  return distanceKm < 10 ? Number(distanceKm.toFixed(1)) : Math.round(distanceKm)
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
      <StepHeader title="Your route" onBack={() => navigate('/ride/demand')} />
      <div className="scroll">
        <div className="map-wrap tall">
          <MapCanvas
            stops={booking.stops}
            polyline={drive.polyline}
            variant="direct"
            interactive
            walkCircles={walkCircles}
          />
        </div>
        <article className="eta-card">
          <p className="ticket-kicker">Solo taxi</p>
          <strong className="fare-xl">{drive.durationMin} min</strong>
          <p>
            Best driving path · {drive.distanceKm < 10 ? drive.distanceKm.toFixed(1) : Math.round(drive.distanceKm)} km
          </p>
        </article>
        <label className="field">
          <span>Extra time vs solo · {you.maxDetourMin} min</span>
          <input
            type="range"
            min={0}
            max={30}
            value={you.maxDetourMin}
            onChange={(event) => patch({ maxDetourMin: Number(event.target.value) })}
          />
          <small className="fine">
            A shared ride may take up to {sharedCap} min ({drive.durationMin} + {you.maxDetourMin}).
          </small>
        </label>
        <label className="field">
          <span>Max walk {you.maxWalkMin} min</span>
          <input
            type="range"
            min={0}
            max={20}
            value={you.maxWalkMin}
            onChange={(event) => patch({ maxWalkMin: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Bags {you.luggageCount}</span>
          <input
            type="range"
            min={0}
            max={4}
            value={you.luggageCount}
            onChange={(event) => patch({ luggageCount: Number(event.target.value) })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={you.accessibility}
            onChange={(event) => patch({ accessibility: event.target.checked })}
          />
          Accessible vehicle
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={you.extraPay}
            onChange={(event) => patch({ extraPay: event.target.checked })}
          />
          Pay extra to stay on time
        </label>
        <label className="field">
          <span>Notes for matching</span>
          <textarea
            rows={3}
            value={you.rawText}
            onChange={(event) => patch({ rawText: event.target.value, extraDemand: event.target.value })}
          />
        </label>
      </div>
      <div className="dock">
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="button" className="cta" disabled={pending} onClick={() => void onMatch()}>
          Match nearby riders
        </button>
      </div>
    </Screen>
  )
}
