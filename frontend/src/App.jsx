import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, Link } from 'react-router-dom'
import Api from './api.js'
import Landing from './pages/Landing.jsx'
import Pricing from './pages/Pricing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import PortalForm from './pages/PortalForm.jsx'
import PortalHistory from './pages/PortalHistory.jsx'
import Settings from './pages/Settings.jsx'
import Billing from './pages/Billing.jsx'
import Admin from './pages/Admin.jsx'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const apiConfigured = Api.isConfigured()
  const navigate = useNavigate()

  useEffect(() => {
    Api.me().then(data => {
      setUser(data.user)
      setLoading(false)
    }).catch(() => {
      setUser(null)
      setLoading(false)
    })
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    navigate('/dashboard')
  }

  const handleLogout = () => {
    Api.logout().then(() => {
      setUser(null)
      navigate('/')
    })
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <h1 className="logo">PortalPulse Pro</h1>
          <nav>
            {user ? (
              <>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/billing">Billing</Link>
                {user.is_admin && <Link to="/admin">Admin</Link>}
                {user.is_admin && <Link to="/settings">Settings</Link>}
                <button onClick={handleLogout} className="btn-link">Logout</button>
              </>
            ) : (
              <>
                <Link to="/">Home</Link>
                <Link to="/pricing">Pricing</Link>
                <Link to="/login">Login</Link>
                <Link to="/register">Register</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {!apiConfigured && (
        <div className="public-notice">
          Public site is live. Sign in and live monitoring will work after the backend is connected.
        </div>
      )}

      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard user={user} onLogout={handleLogout} />} />
          <Route path="/portal/new" element={<PortalForm />} />
          <Route path="/portal/:id/edit" element={<PortalForm />} />
          <Route path="/portal/:id/history" element={<PortalHistory />} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>

      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 PortalPulse Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
