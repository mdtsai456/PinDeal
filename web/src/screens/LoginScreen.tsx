import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { loginWithUsername, readSessionUsername } from '../auth'
import { BrandMark, Screen } from '../components/Shell'
import { cloneRider } from '../data'
import { USERNAME_TO_RIDER } from '../engine/match'
import { useTrip } from '../TripContext'

export function LoginScreen() {
  const navigate = useNavigate()
  const { setYou } = useTrip()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (readSessionUsername()) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    const result = await loginWithUsername(username)
    setPending(false)
    switch (result.ok) {
      case true:
        setYou(cloneRider(USERNAME_TO_RIDER[result.username]))
        navigate('/')
        return
      case false:
        setError('Unknown user')
        return
      default: {
        const _exhaustive: never = result
        return _exhaustive
      }
    }
  }

  return (
    <Screen withTabs>
      <form className="page-pad" onSubmit={(event) => void onSubmit(event)}>
        <BrandMark />
        <h2 className="page-title">Log in</h2>
        <label className="field">
          <span>Username</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="cta" disabled={pending || username.trim() === ''}>
          Log in
        </button>
      </form>
    </Screen>
  )
}
