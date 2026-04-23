import { Link } from 'react-router-dom'

function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="container text-center">
          <h1>Monitor Ticket Portals Like a Pro</h1>
          <p>Get instant alerts when tickets become available. Never miss another event again.</p>
          <div className="mt-3">
            <Link to="/register" className="btn btn-primary">Get Started Free</Link>
            <Link to="/pricing" className="btn btn-secondary ml-2">View Pricing</Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2 className="text-center mb-3">Why Choose PortalPulse Pro?</h2>
          <div className="grid grid-3">
            <div className="card">
              <h3>Real-time Monitoring</h3>
              <p>Continuous checking of ticket portals with intelligent intervals based on availability patterns.</p>
            </div>
            <div className="card">
              <h3>Multi-channel Alerts</h3>
              <p>Receive notifications via Telegram, WhatsApp, and email when tickets become available.</p>
            </div>
            <div className="card">
              <h3>AI-Powered Insights</h3>
              <p>Get smart recommendations on when to check portals based on historical data analysis.</p>
            </div>
            <div className="card">
              <h3>Flexible Configuration</h3>
              <p>Support for HTML and JSON APIs with custom trigger words, block words, and JSON rules.</p>
            </div>
            <div className="card">
              <h3>Admin Dashboard</h3>
              <p>Comprehensive analytics and user management for administrators.</p>
            </div>
            <div className="card">
              <h3>Secure & Reliable</h3>
              <p>Built with security in mind, hosted on reliable infrastructure with data encryption.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container text-center">
          <h2>Ready to Never Miss Tickets Again?</h2>
          <p>Join thousands of users who trust PortalPulse Pro for their ticket monitoring needs.</p>
          <Link to="/register" className="btn btn-primary btn-lg">Start Monitoring Now</Link>
        </div>
      </section>
    </div>
  )
}

export default Landing
