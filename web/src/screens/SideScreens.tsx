import { Navigate, useNavigate } from 'react-router-dom'
import { readSessionUsername } from '../auth'
import { Screen, BrandMark } from '../components/Shell'
import { useTrip } from '../TripContext'

export function PrefsScreen() {
  const { you, setYou } = useTrip()
  return (
    <Screen withTabs>
      <div className="page-pad">
        <BrandMark />
        <h2 className="page-title">Prefs</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={you.extraPay}
            onChange={(event) => setYou({ ...you, extraPay: event.target.checked })}
          />
          Default: pay extra to stay on time
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={you.accessibility}
            onChange={(event) => setYou({ ...you, accessibility: event.target.checked })}
          />
          Default: accessible vehicle
        </label>
        <label className="field">
          <span>Default max walk {you.maxWalkMin} min</span>
          <input
            type="range"
            min={0}
            max={20}
            value={you.maxWalkMin}
            onChange={(event) => setYou({ ...you, maxWalkMin: Number(event.target.value) })}
          />
        </label>
        <p className="fine">These prefs fill the next trip form. Other riders never see them.</p>
      </div>
    </Screen>
  )
}

export function WalletScreen() {
  return (
    <Screen withTabs>
      <div className="page-pad">
        <h2 className="page-title">Wallet</h2>
        <article className="receipt">
          <p className="ticket-kicker">Ride credit</p>
          <strong className="fare-xl">NT$120</strong>
          <p>Use this toward your share of a split fare.</p>
        </article>
        <ul className="notes">
          <li>LINE Pay is linked</li>
          <li>NT$40 cancel fee after a trip is confirmed</li>
        </ul>
      </div>
    </Screen>
  )
}

export function AccountScreen() {
  const navigate = useNavigate()
  const { logout } = useTrip()
  const username = readSessionUsername()
  if (!username) {
    return <Navigate to="/login" replace />
  }

  return (
    <Screen withTabs>
      <div className="page-pad">
        <p className="eyebrow">Member</p>
        <h2 className="page-title">{username}</h2>
        <article className="dispatch-ticket">
          <p className="ticket-kicker">Share member</p>
          <strong>Membership never expires</strong>
          <p>Upgrade progress 0 / 5 trips</p>
        </article>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          Log out
        </button>
        <div className="quick-list">
          <div className="quick">Trip history</div>
          <div className="quick">My bookings</div>
          <div className="quick">Payments</div>
          <div className="quick">Account</div>
        </div>
      </div>
    </Screen>
  )
}
