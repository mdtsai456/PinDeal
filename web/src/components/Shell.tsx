import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

function RoofLamp({ live }: { live?: boolean }) {
  return (
    <span className={`lamp ${live ? 'lamp-live' : ''}`} aria-hidden>
      <span className="lamp-cap" />
      <span className="lamp-body" />
    </span>
  )
}

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      <div className="phone">
        <div className="status-bar">
          <span>1:23</span>
          <span className="status-mid">ShareMeter</span>
          <span>4G  84%</span>
        </div>
        {children}
      </div>
    </div>
  )
}

export function BrandMark({ live }: { live?: boolean }) {
  return (
    <div className="brand">
      <RoofLamp live={live} />
      <div>
        <p className="brand-kicker">Different starts. One meter.</p>
        <h1 className="brand-name">ShareMeter</h1>
      </div>
    </div>
  )
}

export function TabBar() {
  const items = [
    { to: '/', label: 'Home', icon: '⌂' },
    { to: '/prefs', label: 'Prefs', icon: '☰' },
    { to: '/wallet', label: 'Wallet', icon: '❒' },
    { to: '/account', label: 'Account', icon: '☺' },
  ]
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `tab ${isActive ? 'tab-on' : ''}`}
        >
          <span className="tab-icon">{item.icon}</span>
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
