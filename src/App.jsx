import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Explore from './pages/Explore'
import BeatPage from './pages/BeatPage'
import EditBeat from './pages/EditBeat'
import Profile from './pages/Profile'
import ProducerProfile from './pages/ProducerProfile'
import Wallet from './pages/Wallet'
import Upload from './pages/Upload'
import Auth from './pages/Auth'
import Terms from './pages/Terms'
import Settings from './pages/Settings'
import Purchases from './pages/Purchases'
import Admin from './pages/Admin'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="beat/:id" element={<BeatPage />} />
        <Route path="beat/:id/edit" element={<EditBeat />} />
        <Route path="profile" element={<Profile />} />
        <Route path="producer/:id" element={<ProducerProfile />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="upload" element={<Upload />} />
        <Route path="auth" element={<Auth />} />
        <Route path="terms" element={<Terms />} />
        <Route path="settings" element={<Settings />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  )
}
