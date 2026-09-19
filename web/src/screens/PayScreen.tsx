import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readSessionUsername } from '../auth'
import { MapCanvas } from '../components/MapCanvas'
import { Screen } from '../components/Shell'
import { fetchDrivingRoute, straightRoute, type DrivingRoute } from '../directions'
import { bookingMapView } from '../engine/bookingMap'
import { usernameForRider } from '../engine/match'
import { fetchMatch } from '../engine/matchApi'
import { ownRider, payView } from '../engine/matchView'
import { placeById } from '../geo'
import { useTrip } from '../TripContext'

function driveSummary(drive: DrivingRoute): string {
  const km = drive.distanceKm < 10 ? drive.distanceKm.toFixed(1) : String(Math.round(drive.distanceKm))
  return `Est. ride ${drive.durationMin} min · ${km} km`
}

function PaxBadge({ count }: { count: number }) {
  return (
    <span className="pax-badge" aria-label={`${count} passengers`}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"
        />
      </svg>
      <b>{count}</b>
    </span>
  )
}

export function PayScreen() {
  const navigate = useNavigate()
  const { match, absorbMatch, pay, paid, you } = useTrip()
  const username = readSessionUsername() ?? usernameForRider(you.id)
  const booking = useMemo(
    () => bookingMapView(match, username, placeById(you.originId), placeById(you.destinationId)),
    [match, username, you.destinationId, you.originId],
  )
  const [drive, setDrive] = useState<DrivingRoute>(() =>
    straightRoute(booking.origin, booking.dest, booking.vias),
  )
  const view = match ? payView(match, username) : null
  const me = match ? ownRider(match, username) : undefined
  const walkCircles = me
    ? { origin: me.routePage.originCircle, dest: me.routePage.destCircle }
    : undefined

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

  useEffect(() => {
    let cancelled = false
    const fallback = straightRoute(booking.origin, booking.dest, booking.vias)
    setDrive(fallback)
    void fetchDrivingRoute(booking.origin, booking.dest, booking.vias).then((route) => {
      if (!cancelled) setDrive(route)
    })
    return () => {
      cancelled = true
    }
  }, [booking.dest, booking.origin, booking.vias])

  return (
    <Screen>
      <div className="booking">
        <button type="button" className="booking-back" onClick={() => navigate('/ride/details')} aria-label="Back">
          ←
        </button>
        <div className="map-wrap booking-map">
          <MapCanvas
            stops={booking.stops}
            polyline={drive.polyline}
            variant="booking"
            interactive
            walkCircles={walkCircles}
            walkPolylines={booking.walkPolylines}
          />
        </div>
        <div className="booking-sheet">
          <article className="taxi-card">
            <div className="taxi-copy">
              <p className="taxi-emoji" aria-hidden>
                🚕
              </p>
              <div>
                <h3>
                  {view?.title ?? 'Negotiation result'}
                  <PaxBadge count={view?.shareCount ?? 0} />
                </h3>
                <p className="taxi-eta">{driveSummary(drive)}</p>
                {view?.plan && view.plan !== view.title ? <p>{view.plan}</p> : null}
                <p className="taxi-ok">If no car is nearby, search expands to more taxis.</p>
              </div>
            </div>
            {view ? <strong className="taxi-fare">NT${view.fare}</strong> : null}
          </article>
          <div className="pay-row">
            <span>LINE Pay (****)</span>
            <span>No coupon</span>
          </div>
          <button
            type="button"
            className="cta"
            onClick={() => {
              pay()
              navigate('/ride/track')
            }}
          >
            {paid ? 'Track your taxi' : 'Call taxi now'}
          </button>
        </div>
      </div>
    </Screen>
  )
}
