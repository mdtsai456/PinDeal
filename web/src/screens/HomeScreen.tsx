import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import driverIcon from '../assets/Driver.png'
import favoriteSlotIcon from '../assets/Favorite.png'
import homeSlotIcon from '../assets/Home.png'
import planeIcon from '../assets/Plan.png'
import arrowRightIcon from '../assets/arrow-sm-right-svgrepo-com.svg?url'
import taxiArt from '../assets/taxicartoon.png'
import taxiCtaIcon from '../assets/taxi-svgrepo-com.svg?url'
import workSlotIcon from '../assets/Work.png'
import { readSessionUsername } from '../auth'
import { BrandMark, Screen } from '../components/Shell'
import { PlacePicker } from '../components/PlacePicker'
import { placeById, rememberPlace } from '../geo'
import { useTrip } from '../TripContext'
import type { Place, SavedSlotId } from '../types'

const SLOT_ICONS: Record<SavedSlotId, string> = {
  home: homeSlotIcon,
  work: workSlotIcon,
  favorite: favoriteSlotIcon,
}

function SlotIcon({ id }: { id: SavedSlotId }) {
  return <img src={SLOT_ICONS[id]} alt="" />
}

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

  function startRide() {
    if (!readSessionUsername()) {
      navigate('/login')
      return
    }
    resetTrip()
    navigate('/ride/demand')
  }

  return (
    <Screen withTabs>
      <div className="home-page">
        <BrandMark />
        <div className="home-hero-row">
          <h2 className="home-headline">
            Share the ride,
            <br />
            share the city.
          </h2>
          <img className="home-taxi" src={taxiArt} alt="" />
        </div>
        <p className="home-tag">Turn different pickups and dropoffs into one shared taxi with a split fare.</p>
        <button type="button" className="home-cta" onClick={startRide}>
          <img className="home-cta-ico" src={taxiCtaIcon} alt="" />
          Share a ride
          <img className="home-arrow" src={arrowRightIcon} alt="" />
        </button>
        <p className="home-fine">A NT$40 cancel fee applies after the trip is confirmed.</p>

        <section className="home-saved">
          <div className="home-saved-head">
            <h3>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path
                  d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle cx="12" cy="10" r="2" fill="currentColor" />
              </svg>
              Saved places
            </h3>
            <span>See all ›</span>
          </div>
          <div className="home-slots">
            {savedSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className="home-slot"
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
                <span className="home-slot-ico">
                  <SlotIcon id={slot.id} />
                </span>
                <span className="home-slot-copy">
                  {slot.place ? (
                    <>
                      <b>{slot.label}</b>
                      <small>{slot.place.name}</small>
                    </>
                  ) : (
                    <>
                      Add {slot.label.toLowerCase()} <b>+</b>
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="home-promos">
          <article className="home-promo home-promo-dark">
            <span className="home-promo-ico" aria-hidden>
              <img src={driverIcon} alt="" />
            </span>
            <div>
              <h3>Designated driver</h3>
              <p>A safer way home.</p>
            </div>
            <img className="home-arrow" src={arrowRightIcon} alt="" />
          </article>
          <article className="home-promo home-promo-light">
            <span className="home-promo-ico" aria-hidden>
              <img src={planeIcon} alt="" />
            </span>
            <div>
              <h3>Airport transfer</h3>
              <p>Hassle-free to the airport.</p>
            </div>
            <img className="home-arrow" src={arrowRightIcon} alt="" />
          </article>
        </div>
      </div>

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
