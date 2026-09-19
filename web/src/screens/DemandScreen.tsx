import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, StepHeader } from '../components/Shell'
import { PlacePicker } from '../components/PlacePicker'
import { placeById, rememberPlace } from '../geo'
import { useTrip } from '../TripContext'
import type { Place, RiderDemand } from '../types'

export function DemandScreen() {
  const navigate = useNavigate()
  const { you, setYou } = useTrip()
  const [picking, setPicking] = useState<'origin' | 'destination' | null>(null)

  const origin = placeById(you.originId)
  const destination = placeById(you.destinationId)
  const patch = (partial: Partial<RiderDemand>) => setYou({ ...you, ...partial })

  function applyPlace(field: 'origin' | 'destination', place: Place) {
    const saved = rememberPlace(place)
    patch(field === 'origin' ? { originId: saved.id } : { destinationId: saved.id })
  }

  function goDetails() {
    setPicking(null)
    navigate('/ride/details')
  }

  return (
    <Screen>
      <StepHeader title="Your trip" onBack={() => navigate('/')} />
      <div className="scroll">
        <label className="field">
          <span>Pickup</span>
          <button type="button" className="place-btn" onClick={() => setPicking('origin')}>
            {origin.name}
            <small>{origin.address}</small>
          </button>
        </label>
        <label className="field">
          <span>Dropoff</span>
          <button type="button" className="place-btn" onClick={() => setPicking('destination')}>
            {destination.name}
            <small>{destination.address}</small>
          </button>
        </label>
      </div>
      <div className="dock">
        <button type="button" className="cta" onClick={goDetails}>
          Confirm
        </button>
      </div>

      {picking ? (
        <PlacePicker
          picking={picking}
          origin={origin}
          destination={destination}
          onPick={applyPlace}
          onConfirm={goDetails}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </Screen>
  )
}
