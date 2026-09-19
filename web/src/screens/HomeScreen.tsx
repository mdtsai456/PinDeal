import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { readSessionUsername } from '../auth'
import { BrandMark, Screen } from '../components/Shell'
import { PlacePicker } from '../components/PlacePicker'
import { placeById, rememberPlace } from '../geo'
import { useTrip } from '../TripContext'
import type { Place, SavedSlotId } from '../types'

export function HomeScreen() {
  const navigate = useNavigate()
  const { resetTrip, you, setYou, savedSlots, setSavedPlace } = useTrip()
  const [editing, setEditing] = useState<SavedSlotId | null>(null)

  const origin = placeById(you.originId)
  const destination = placeById(you.destinationId)

  function applyPlace(_field: 'origin' | 'destination', place: Place) {
    const saved = rememberPlace(place)
    if (!editing) return
    setSavedPlace(editing, saved)
    setYou({ ...you, destinationId: saved.id })
  }

  return (
    <Screen withTabs>
      <div className="home-hero">
        <BrandMark />
        <p className="home-tag">Turn different pickups and dropoffs into one shared taxi with a split fare.</p>
        <button
          type="button"
          className="cta"
          onClick={() => {
            if (!readSessionUsername()) {
              navigate('/login')
              return
            }
            resetTrip()
            navigate('/ride/demand')
          }}
        >
          Share a ride
        </button>
        <p className="fine">A NT$40 cancel fee applies after the trip is confirmed.</p>
      </div>

      <section className="panel">
        <h3 className="section-label">Saved places</h3>
        <div className="saved-list">
          {savedSlots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className="quick"
              onClick={() => {
                if (slot.place) {
                  if (!readSessionUsername()) {
                    navigate('/login')
                    return
                  }
                  setYou({ ...you, destinationId: slot.place.id })
                  navigate('/ride/demand')
                  return
                }
                setEditing(slot.id)
              }}
            >
              {slot.place ? (
                <>
                  <b>{slot.label}</b>
                  <small>{slot.place.name}</small>
                </>
              ) : (
                `+ Add ${slot.label.toLowerCase()}`
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="panel chips-row">
        <article className="mini-card">
          <p>Designated driver</p>
          <span>Safe ride home</span>
        </article>
        <article className="mini-card">
          <p>Airport transfer</p>
          <span>On-time first</span>
        </article>
      </section>

      {editing ? (
        <PlacePicker
          picking="destination"
          origin={origin}
          destination={destination}
          onPick={applyPlace}
          onConfirm={() => setEditing(null)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  )
}
