import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Api from '../api.js'

function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chatQuery, setChatQuery] = useState('')
  const [chatResponse, setChatResponse] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const result = await Api.dashboard()
      setData(result)
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      if (err.message === 'Unauthorized') {
        navigate('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleChat = async (e) => {
    e.preventDefault()
    if (!chatQuery.trim()) return

    setChatLoading(true)
    try {
      const result = await Api.chatbot(chatQuery)
      setChatResponse(result.response)
    } catch (err) {
      setChatResponse('Sorry, I could not process your query.')
    } finally {
      setChatLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await Api.logout()
      navigate('/')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const handlePortalTest = async (portalId) => {
    setActionMessage('')
    try {
      const result = await Api.testPortal(portalId)
      setActionMessage(result.status_text || result.message || 'Portal test completed.')
      await loadDashboard()
    } catch (err) {
      setActionMessage(err.message)
    }
  }

  const handleBillingPortal = async () => {
    setActionMessage('')
    try {
      const result = await Api.billingPortal()
      window.location.href = result.url
    } catch (err) {
      setActionMessage(err.message)
    }
  }

  if (loading) {
    return <div className='loading'>Loading dashboard...</div>
  }

  if (!data) {
    return <div className='container'>Failed to load dashboard</div>
  }

  return (
    <div className='dashboard'>
      <nav className='navbar'>
        <div className='container flex-between'>
          <h1>PortalPulse</h1>
          <div className='flex'>
            <Link to='/dashboard' className='btn btn-secondary'>Dashboard</Link>
            {data.user.is_admin && (
              <Link to='/settings' className='btn btn-secondary'>Settings</Link>
            )}
            {data.user.is_admin && (
              <Link to='/admin' className='btn btn-secondary'>Admin</Link>
            )}
            <button onClick={handleLogout} className='btn btn-outline'>Logout</button>
          </div>
        </div>
      </nav>

      <div className='container'>
        <div className='mb-3'>
          <h2>Welcome, {data.user.name}!</h2>
          <p>Plan: {data.user.plan} ({data.user.subscription_status})</p>
        </div>

        {actionMessage && (
          <div className='alert alert-success mb-3'>{actionMessage}</div>
        )}

        <div className='grid grid-3 mb-3'>
          <div className='card'>
            <h3>{data.totals.portals}</h3>
            <p>Total Portals</p>
          </div>
          <div className='card'>
            <h3>{data.totals.checks}</h3>
            <p>Total Checks</p>
          </div>
          <div className='card'>
            <h3>{data.totals.alerts}</h3>
            <p>Total Alerts</p>
          </div>
        </div>

        <div className='mb-3'>
          <div className='flex-between mb-2'>
            <h2>Your Portals</h2>
            <Link to='/portal/new' className='btn btn-primary'>Add Portal</Link>
          </div>

          {data.portals.length === 0 ? (
            <div className='card'>
              <p>No portals yet. <Link to='/portal/new'>Create your first portal</Link> to start monitoring.</p>
            </div>
          ) : (
            <div className='grid grid-1'>
              {data.portals.map(item => (
                <div key={item.portal.id} className='card'>
                  <div className='flex-between mb-2'>
                    <h3>{item.portal.name}</h3>
                  <div>
                      <span className='badge'>
                        {item.portal.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {item.portal.fast_mode && (
                        <span className='badge badge-warning ml-1'>Fast</span>
                      )}
                      <span className={`badge badge-${item.portal.priority_level} ml-1`}>
                        {item.portal.priority_level}
                      </span>
                    </div>
                  </div>

                  <p className='mb-1'><strong>URL:</strong> {item.portal.url}</p>
                  <p className='mb-1'><strong>Mode:</strong> {item.portal.mode}</p>

                  {item.latest_check && (
                    <div className='mb-2'>
                      <p className='mb-1'><strong>Last Check:</strong> {item.latest_check.status_text}</p>
                      {item.latest_check.match_text && (
                        <p className='mb-1'><strong>Match:</strong> {item.latest_check.match_text}</p>
                      )}
                      <small>Checked: {new Date(item.latest_check.checked_at).toLocaleString()}</small>
                    </div>
                  )}

                  <div className='mb-2'>
                    <p><strong>AI Insights:</strong></p>
                    <ul>
                      <li>Success Rate: {item.ai.success_rate}%</li>
                      <li>Best Hour: {item.ai.best_hour ?? 'Not enough data yet'}</li>
                      <li>Recommendation: {item.ai.recommendation}</li>
                      <li>Insight: {item.ai.insight}</li>
                    </ul>
                  </div>

                  <div className='flex'>
                    <Link to={`/portal/${item.portal.id}/edit`} className='btn btn-sm'>Edit</Link>
                    <Link to={`/portal/${item.portal.id}/history`} className='btn btn-sm btn-secondary'>History</Link>
                    <button
                      className='btn btn-sm btn-outline'
                      onClick={() => handlePortalTest(item.portal.id)}
                    >
                      Test
                    </button>
                  </div>

                  <div className='mt-2'>
                    <small>{item.checks_count} checks, {item.alerts_count} alerts</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='grid grid-2 mb-3'>
          <div className='card'>
            <h2>AI Chat Assistant</h2>
            <form onSubmit={handleChat}>
              <div className='mb-2'>
                <textarea
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  placeholder='Ask about your portal performance...'
                  rows='3'
                  className='form-control'
                />
              </div>
              <button type='submit' className='btn btn-primary' disabled={chatLoading}>
                {chatLoading ? 'Thinking...' : 'Ask AI'}
              </button>
            </form>
            {chatResponse && (
              <div className='mt-2'>
                <strong>AI Response:</strong>
                <p>{chatResponse}</p>
              </div>
            )}
          </div>

          <div className='card'>
            <h2>Billing</h2>
            {data.user.subscription_status === 'active' && data.user.plan !== 'free' ? (
              <div>
                <p className='text-success'>Active subscription</p>
                <button className='btn btn-secondary' onClick={handleBillingPortal}>
                  Manage Billing
                </button>
              </div>
            ) : (
              <div>
                <p>Free plan available with upgrade options.</p>
                <Link to='/pricing' className='btn btn-primary'>Upgrade Now</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
