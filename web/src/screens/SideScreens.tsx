import { Navigate, useNavigate } from 'react-router-dom'
import profileIcon from '../assets/profile-svgrepo-com.svg?url'
import accessIcon from '../assets/icon-pref-access.png'
import timeIcon from '../assets/icon-pref-time.png'
import walkIcon from '../assets/icon-pref-walk.png'
import walletMark from '../assets/wallet.png'
import { readSessionUsername } from '../auth'
import { Screen } from '../components/Shell'
import { useTrip } from '../TripContext'

const WALK_MAX = 15

const PREF_ICONS = {
  time: timeIcon,
  access: accessIcon,
  walk: walkIcon,
} as const

function PrefIcon({ kind }: { kind: keyof typeof PREF_ICONS }) {
  return <img className="pref-ico-img" src={PREF_ICONS[kind]} alt="" />
}

function PrefSwitch({
  on,
  onToggle,
  label,
}: {
  on: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      className={`pref-switch ${on ? 'pref-switch-on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
    />
  )
}

export function PrefsScreen() {
  const { you, setYou } = useTrip()
  const walkMin = Math.min(WALK_MAX, you.maxWalkMin)

  return (
    <Screen withTabs>
      <div className="page-pad prefs-page">
        <h2 className="prefs-title">Preferences</h2>
        <p className="prefs-lead">Set your ride preferences for a better experience.</p>

        <article className="pref-card">
          <div className="pref-row">
            <span className="pref-ico">
              <PrefIcon kind="time" />
            </span>
            <div className="pref-copy">
              <h3>Pay extra to stay on time</h3>
              <p>Get matched with riders who are more likely to arrive on time.</p>
            </div>
            <PrefSwitch
              label="Pay extra to stay on time"
              on={you.extraPay}
              onToggle={() => setYou({ ...you, extraPay: !you.extraPay })}
            />
          </div>
        </article>

        <article className="pref-card">
          <div className="pref-row">
            <span className="pref-ico">
              <PrefIcon kind="access" />
            </span>
            <div className="pref-copy">
              <h3>Accessible vehicle</h3>
              <p>Prefer rides with wheelchair accessible vehicles.</p>
            </div>
            <PrefSwitch
              label="Accessible vehicle"
              on={you.accessibility}
              onToggle={() => setYou({ ...you, accessibility: !you.accessibility })}
            />
          </div>
        </article>

        <article className="pref-card">
          <div className="pref-row">
            <span className="pref-ico">
              <PrefIcon kind="walk" />
            </span>
            <div className="pref-copy">
              <h3>Max walking time</h3>
            </div>
            <strong className="pref-walk-val">{walkMin} min</strong>
          </div>
          <label className="pref-slider">
            <input
              type="range"
              min={0}
              max={WALK_MAX}
              value={walkMin}
              onChange={(event) => setYou({ ...you, maxWalkMin: Number(event.target.value) })}
            />
            <span className="pref-slider-ends">
              <span>0 min</span>
              <span>15 min</span>
            </span>
          </label>
          <p className="pref-note">These prefs fill the next trip form. Other riders never see them.</p>
        </article>
      </div>
    </Screen>
  )
}

export function WalletScreen() {
  return (
    <Screen withTabs>
      <div className="page-pad wallet-page">
        <header className="wallet-head">
          <div>
            <h2 className="wallet-title">Wallet</h2>
            <p className="wallet-lead">Your ride credits and payment details.</p>
          </div>
          <img className="wallet-mark" src={walletMark} alt="" />
        </header>

        <article className="wallet-credit">
          <div>
            <p className="wallet-credit-kicker">Ride credit</p>
            <strong className="wallet-credit-amt">NT$120</strong>
            <p>Use this toward your share of a split fare.</p>
          </div>
          <span className="wallet-coin" aria-hidden>
            <svg viewBox="0 0 64 64" width="56" height="56">
              <circle cx="32" cy="32" r="24" fill="#f5c84a" />
              <circle cx="32" cy="32" r="18" fill="#ffe27a" />
              <text x="32" y="39" textAnchor="middle" fontSize="22" fontWeight="700" fill="#c9a227">
                $
              </text>
            </svg>
          </span>
        </article>

        <div className="wallet-list">
          <div className="wallet-row">
            <span className="wallet-row-ico" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  d="M10 13a3.5 3.5 0 0 1 0-5l2.1-2.1a3.5 3.5 0 0 1 5 5L15.8 12M14 11a3.5 3.5 0 0 1 0 5l-2.1 2.1a3.5 3.5 0 1 1-5-5L10.2 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="wallet-row-copy">
              <h3>LINE Pay is linked</h3>
              <p>You can use LINE Pay for payment.</p>
            </div>
            <span className="wallet-ok" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22">
                <circle cx="12" cy="12" r="10" fill="#e7f6ea" />
                <path
                  d="m8 12 3 3 5-6"
                  fill="none"
                  stroke="#3caf5a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
          <div className="wallet-row">
            <span className="wallet-row-ico" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm0 0 2-4h12l2 4M8 13h.01M12 13h4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="wallet-row-copy">
              <h3>NT$40 cancel fee</h3>
              <p>after a trip is confirmed.</p>
            </div>
            <span className="wallet-chevron" aria-hidden>
              ›
            </span>
          </div>
        </div>
      </div>
    </Screen>
  )
}

function AccountRowIcon({ kind }: { kind: 'trip' | 'book' | 'pay' | 'acct' }) {
  switch (kind) {
    case 'trip':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'book':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'pay':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <rect x="3" y="7" width="18" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 13h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'acct':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 19c1.4-3.2 4-5 7-5s5.6 1.8 7 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function AccountScreen() {
  const navigate = useNavigate()
  const { logout } = useTrip()
  const username = readSessionUsername()
  if (!username) {
    return <Navigate to="/login" replace />
  }

  const rows = [
    { kind: 'trip' as const, title: 'Trip history', detail: 'View your past trips' },
    { kind: 'book' as const, title: 'My bookings', detail: 'Manage upcoming and past bookings' },
    { kind: 'pay' as const, title: 'Payments', detail: 'Manage your payment methods' },
    { kind: 'acct' as const, title: 'Account', detail: 'Profile, settings, and more' },
  ]

  return (
    <Screen withTabs>
      <div className="page-pad account-page">
        <header className="account-head">
          <img className="account-avatar" src={profileIcon} alt="" />
          <div className="account-who">
            <p className="account-kicker">Member</p>
            <h2 className="account-name">{username}</h2>
            <p className="account-thanks">Thanks for being part of PinDeal!</p>
          </div>
          <button type="button" className="account-edit">
            Edit profile <span aria-hidden>›</span>
          </button>
        </header>

        <article className="account-member">
          <div className="account-member-top">
            <div>
              <p className="account-kicker">Share member</p>
              <h3>Membership never expires</h3>
              <p>Keep sharing rides for a better tomorrow.</p>
            </div>
            <span className="account-crown" aria-hidden>
              <svg viewBox="0 0 48 40" width="40" height="34">
                <path d="M6 28 12 10l12 10L36 8l6 20H6Z" fill="#ffd000" />
                <rect x="8" y="28" width="32" height="5" rx="2" fill="#ffe56a" />
              </svg>
            </span>
          </div>
          <div className="account-progress">
            <span>Upgrade progress</span>
            <span>0 / 5 trips</span>
          </div>
          <div className="account-bar" aria-hidden>
            <span />
          </div>
        </article>

        <div className="account-list">
          {rows.map((row) => (
            <div className="account-row" key={row.title}>
              <span className="account-row-ico">
                <AccountRowIcon kind={row.kind} />
              </span>
              <div className="account-row-copy">
                <h3>{row.title}</h3>
                <p>{row.detail}</p>
              </div>
              <span className="wallet-chevron" aria-hidden>
                ›
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="account-logout"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path
              d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2M4 12h10M12 9l3 3-3 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Log out
        </button>
      </div>
    </Screen>
  )
}
