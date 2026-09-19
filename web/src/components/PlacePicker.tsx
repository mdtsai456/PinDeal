import { useEffect, useState } from 'react'
import { fillGooglePlace, searchAddresses } from '../maps'
import { rememberPlace, searchLocal } from '../geo'
import { useTrip } from '../TripContext'
import type { Place, SavedSlotId } from '../types'

type PlacePickerProps = {
  picking: 'origin' | 'destination'
  origin: Place
  destination: Place
  onPick: (field: 'origin' | 'destination', place: Place) => void
  onConfirm: () => void
  onClose: () => void
}

export function PlacePicker({
  picking,
  origin,
  destination,
  onPick,
  onConfirm,
  onClose,
}: PlacePickerProps) {
  const { savedSlots, recents, setSavedPlace, pushRecent } = useTrip()
  const [focus, setFocus] = useState<'origin' | 'destination'>(picking)
  const [query, setQuery] = useState(picking === 'origin' ? origin.name : destination.name)
  const [hits, setHits] = useState<Place[]>([])
  const [savingSlot, setSavingSlot] = useState<SavedSlotId | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 1) {
      setHits([])
      return
    }
    setHits(searchLocal(trimmed))
    let cancelled = false
    const timer = window.setTimeout(() => {
      void searchAddresses(trimmed).then((places) => {
        if (!cancelled) setHits(places)
      })
    }, 160)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  function showField(field: 'origin' | 'destination') {
    setFocus(field)
    setQuery(field === 'origin' ? origin.name : destination.name)
    setHits([])
  }

  async function choose(place: Place) {
    const filled =
      place.lat === 0 && place.lng === 0 ? await fillGooglePlace(place.id) : rememberPlace(place)
    if (!filled) return
    onPick(focus, filled)
    pushRecent(filled)
    if (savingSlot) {
      setSavedPlace(savingSlot, filled)
      setSavingSlot(null)
    }
    setQuery(filled.name)
    setHits([])
  }

  function applySaved(place: Place) {
    void choose(place)
  }

  const title = focus === 'origin' ? 'Set pickup' : 'Set dropoff'
  const openDropdown = hits.length > 0 && query.trim().length > 0

  return (
    <div className="place-editor" role="dialog" aria-label={title}>
      <header className="ride-head">
        <button type="button" className="back" onClick={onClose} aria-label="Back">
          ←
        </button>
        <div className="ride-head-copy">
          <h2>{title}</h2>
        </div>
      </header>

      <div className="stops-card">
        <label className={`stop-row ${focus === 'origin' ? 'stop-on' : ''}`}>
          <i className="stop-dot stop-dot-pickup" />
          <span>Pickup</span>
          <input
            value={focus === 'origin' ? query : origin.name}
            placeholder="Pickup address"
            onFocus={() => showField('origin')}
            onChange={(event) => {
              setFocus('origin')
              setQuery(event.target.value)
            }}
          />
          {focus === 'origin' && query ? (
            <button type="button" className="clear-x" onClick={() => setQuery('')} aria-label="Clear">
              ×
            </button>
          ) : null}
        </label>
        <label className={`stop-row ${focus === 'destination' ? 'stop-on' : ''}`}>
          <i className="stop-dot stop-dot-dropoff" />
          <span>Dropoff</span>
          <input
            value={focus === 'destination' ? query : destination.name}
            placeholder="Dropoff address"
            onFocus={() => showField('destination')}
            onChange={(event) => {
              setFocus('destination')
              setQuery(event.target.value)
            }}
          />
          {focus === 'destination' && query ? (
            <button type="button" className="clear-x" onClick={() => setQuery('')} aria-label="Clear">
              ×
            </button>
          ) : null}
        </label>
        {openDropdown ? (
          <ul className="place-list place-list-inline">
            {hits.map((place) => (
              <li key={place.id}>
                <button type="button" onClick={() => void choose(place)}>
                  <b>{place.name}</b>
                  <small>{place.address}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="shortcut-row">
        {savedSlots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            className={`chip ${savingSlot === slot.id ? 'chip-on' : ''}`}
            onClick={() => {
              if (slot.place) {
                applySaved(slot.place)
                return
              }
              setSavingSlot(slot.id)
            }}
          >
            + {slot.place ? slot.label : `Add ${slot.label.toLowerCase()}`}
          </button>
        ))}
      </div>

      {recents.length > 0 && !openDropdown ? (
        <section className="history">
          <h3 className="section-label">Recent</h3>
          <ul className="history-list">
            {recents.map((place) => (
              <li key={place.id}>
                <button type="button" onClick={() => applySaved(place)}>
                  <b>{place.name}</b>
                  <small>{place.address}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="dock">
        <button type="button" className="cta" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </div>
  )
}
