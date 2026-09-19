import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import accountIcon from '../assets/icon-account.png'
import homeIcon from '../assets/icon-home.png'
import prefsIcon from '../assets/icon-prefs.png'
import walletIcon from '../assets/icon-wallet.png'
import logoUrl from '../assets/logo.png'

const TABS = [
  { to: '/', label: 'Home', icon: homeIcon, large: false },
  { to: '/prefs', label: 'Prefs', icon: prefsIcon, large: true },
  { to: '/wallet', label: 'Wallet', icon: walletIcon, large: false },
  { to: '/account', label: 'Account', icon: accountIcon, large: false },
] as const

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      <div className="phone">
        <div className="status-bar">
          <span>1:23</span>
          <span className="status-mid">
            <img className="status-logo" src={logoUrl} alt="" />
            PinDeal
          </span>
          <span>4G  84%</span>
        </div>
        {children}
      </div>
    </div>
  )
}

export function BrandMark() {
  return (
    <div className="brand">
      <img className="brand-logo" src={logoUrl} alt="" />
      <div>
        <p className="brand-kicker">Different starts. One meter.</p>
        <h1 className="brand-name">PinDeal</h1>
      </div>
    </div>
  )
}

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `tab ${isActive ? 'tab-on' : ''}`}
        >
          <span className="tab-icon-slot">
            <img
              className={`tab-icon ${item.large ? 'tab-icon-lg' : ''}`}
              src={item.icon}
              alt=""
            />
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function StepHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="ride-head">
      <button type="button" className="back" onClick={onBack} aria-label="Back">
        ←
      </button>
      <div className="ride-head-copy">
        <h2>{title}</h2>
      </div>
    </header>
  )
}

export function Screen({
  children,
  withTabs,
}: {
  children: ReactNode
  withTabs?: boolean
}) {
  return (
    <div className={`screen ${withTabs ? 'screen-tabs' : ''}`}>
      {children}
      {withTabs ? <TabBar /> : null}
    </div>
  )
}
