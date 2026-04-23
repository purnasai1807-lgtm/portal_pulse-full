import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
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
                <a href="/dashboard">Dashboard</a>
                <a href="/billing">Billing</a>
                {user.is_admin && <a href="/admin">Admin</a>}
                <a href="/settings">Settings</a>
                <button onClick={handleLogout} className="btn-link">Logout</button>
              </>
            ) : (
              <>
                <a href="/">Home</a>
                <a href="/pricing">Pricing</a>
                <a href="/login">Login</a>
                <a href="/register">Register</a>
              </>
            )}
          </nav>
        </div>
      </header>

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
          <Route path="/settings" element={<Settings />} />
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
