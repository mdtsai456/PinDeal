import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readSessionUsername } from '../auth'
import { MapCanvas } from '../components/MapCanvas'
import { Screen, StepHeader } from '../components/Shell'
import { fetchDrivingRoute, straightRoute } from '../directions'
import { bookingMapView, sliceShareDrive } from '../engine/bookingMap'
import { usernameForRider } from '../engine/match'
import { fetchMatch } from '../engine/matchApi'
import { ownWalkCircles, payView, trackFare } from '../engine/matchView'
import { soloFareFromDemand } from '../engine/taxiTariff'
import { interpolate, placeById } from '../geo'
import { youBoardCopy } from '../labels'
import { useTrip } from '../TripContext'
import type { LatLng } from '../types'

export function TrackScreen() {
  const navigate = useNavigate()
  const { you, resetTrip, match, absorbMatch } = useTrip()
  const username = readSessionUsername() ?? usernameForRider(you.id)
  const view = match ? payView(match, username) : null
  const fare = trackFare(match, username, soloFareFromDemand(you))
  const [t, setT] = useState(0)
  const [eta, setEta] = useState(6)
  const booking = useMemo(
    () => bookingMapView(match, username, placeById(you.originId), placeById(you.destinationId)),
    [match, username, you.destinationId, you.originId],
  )
  const walkCircles = ownWalkCircles(match, username, you)
  const ownPickup = placeById(you.originId)
  const boardLine = youBoardCopy(booking.boardOrder)
  const [driveLine, setDriveLine] = useState(() =>
    sliceShareDrive(straightRoute(booking.origin, booking.dest, booking.vias).polyline, booking),
  )

  useEffect(() => {
    let cancelled = false
    setDriveLine(sliceShareDrive(straightRoute(booking.origin, booking.dest, booking.vias).polyline, booking))
    void fetchDrivingRoute(booking.origin, booking.dest, booking.vias).then((route) => {
      if (!cancelled) setDriveLine(sliceShareDrive(route.polyline, booking))
    })
    return () => {
      cancelled = true
    }
  }, [booking])

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
    const move = window.setInterval(() => {
      setT((prev) => Math.min(1, prev + 0.006))
    }, 400)
    const clock = window.setInterval(() => {
      setEta((prev) => Math.max(1, prev - 1))
    }, 8000)
    return () => {
      window.clearInterval(move)
      window.clearInterval(clock)
    }
  }, [])

  const taxi: LatLng = interpolate(driveLine, t)

  return (
    <Screen>
      <StepHeader title="Live trip" onBack={() => navigate('/ride/pay')} />
      <div className="scroll">
        <div className="eta-bar">
          <div>
            <p className="eyebrow">Taxi ETA</p>
            <strong>{eta} min</strong>
          </div>
          <div>
            <p className="eyebrow">Your fare</p>
            <strong>NT${fare}</strong>
          </div>
        </div>
        <div className="map-wrap tall">
          <MapCanvas
            stops={booking.stops}
            polyline={driveLine}
            taxi={taxi}
            you={{ lat: ownPickup.lat, lng: ownPickup.lng }}
            variant="booking"
            walkCircles={walkCircles}
            walkPolylines={booking.walkPolylines}
          />
        </div>
        <p className="status-line">Your taxi is on the way. Only your fare and route are shown.</p>
        <p className="status-line">{boardLine}</p>
      </div>
      <div className="dock">
        <button
          type="button"
          className="cta"
          onClick={() => {
            resetTrip()
            navigate('/')
          }}
        >
          End demo
        </button>
      </div>
    </Screen>
  )
}
