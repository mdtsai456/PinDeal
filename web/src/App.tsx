import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { readSessionUsername } from './auth'
import { PhoneShell } from './components/Shell'
import { TripProvider } from './TripContext'
import { HomeScreen } from './screens/HomeScreen'
import { LoginScreen } from './screens/LoginScreen'
import { DemandScreen } from './screens/DemandScreen'
import { DetailsScreen } from './screens/DetailsScreen'
import { NegotiateScreen } from './screens/NegotiateScreen'
import { PayScreen } from './screens/PayScreen'
import { TrackScreen } from './screens/TrackScreen'
import { AccountScreen, PrefsScreen, WalletScreen } from './screens/SideScreens'

function RequireSession() {
  if (!readSessionUsername()) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <TripProvider>
      <PhoneShell>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/prefs" element={<PrefsScreen />} />
          <Route path="/wallet" element={<WalletScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<RequireSession />}>
            <Route path="/account" element={<AccountScreen />} />
            <Route path="/ride/demand" element={<DemandScreen />} />
            <Route path="/ride/details" element={<DetailsScreen />} />
            <Route path="/ride/negotiate" element={<NegotiateScreen />} />
            <Route path="/ride/pay" element={<PayScreen />} />
            <Route path="/ride/track" element={<TrackScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PhoneShell>
    </TripProvider>
  )
}
