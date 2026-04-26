import { useState } from 'react'
import Api from '../api.js'

function Pricing() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubscribe = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await Api.createCheckoutSession()
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pricing">
      <div className="container">
        <h1 className="text-center mb-3">Choose Your Plan</h1>
        
        <div className="grid grid-2">
          <div className="card">
            <h2>Free Plan</h2>
            <div className="price">$0<span>/month</span></div>
            <p>Perfect for individual users getting started</p>
            <ul>
              <li>2 portal monitors</li>
              <li>Email alerts only</li>
              <li>Basic AI insights</li>
              <li>No credit card required</li>
            </ul>
            <p className="text-center">Sign up and start monitoring right away</p>
          </div>

          <div className="card featured">
            <h2>Pro Plan</h2>
            <div className="price">$29<span>/month</span></div>
            <p>Full access to all features</p>
            <ul>
              <li>50 portal monitors</li>
              <li>Telegram, WhatsApp & Email alerts</li>
              <li>Advanced AI insights</li>
              <li>Admin dashboard</li>
              <li>Priority support</li>
            </ul>
            <button 
              onClick={handleSubscribe} 
              disabled={loading}
              className="btn btn-primary btn-block"
            >
              {loading ? 'Processing...' : 'Subscribe Now'}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="text-center mt-3">
          <p>All plans include secure hosting, automatic updates, and 99.9% uptime SLA.</p>
        </div>
      </div>
    </div>
  )
}

export default Pricing
