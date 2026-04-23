import { useEffect, useState } from 'react'
import Api from '../api.js'

function Admin() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      const result = await Api.admin()
      setData(result)
    } catch (err) {
      console.error('Failed to load admin data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className='loading'>Loading admin dashboard...</div>
  }

  if (!data) {
    return <div className='container'>Failed to load admin data</div>
  }

  const checksMax = Math.max(...data.checks_series, 1)
  const alertsMax = Math.max(...data.alerts_series, 1)
  const topPortalMax = Math.max(...data.top_portal_values, 1)

  return (
    <div className='admin'>
      <div className='container'>
        <h1 className='mb-3'>Admin Dashboard</h1>

        <div className='grid grid-3 mb-3'>
          <div className='card'>
            <h3>{data.totals.users}</h3>
            <p>Total Users</p>
          </div>
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
          <h2>Activity (Last 7 Days)</h2>
          <div className='card'>
            <div style={{ height: '200px', display: 'flex', alignItems: 'end', gap: '2px' }}>
              {data.days.map((day, i) => (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '100%',
                      background: '#10b981',
                      height: `${(data.checks_series[i] / checksMax) * 150}px`,
                      borderRadius: '2px 2px 0 0'
                    }}
                  ></div>
                  <div
                    style={{
                      width: '100%',
                      background: '#f59e0b',
                      height: `${(data.alerts_series[i] / alertsMax) * 150}px`,
                      borderRadius: '0 0 2px 2px'
                    }}
                  ></div>
                  <small style={{ marginTop: '4px', fontSize: '10px' }}>{day}</small>
                </div>
              ))}
            </div>
            <div className='text-center mt-2'>
              <span style={{ color: '#10b981' }}>Checks</span>
              <span style={{ color: '#f59e0b', marginLeft: '1rem' }}>Alerts</span>
            </div>
          </div>
        </div>

        <div className='mb-3'>
          <h2>Top Portals</h2>
          <div className='card'>
            {data.top_portal_labels.length === 0 ? (
              <p>No portal activity yet</p>
            ) : (
              <div style={{ height: '200px', display: 'flex', alignItems: 'end', gap: '4px' }}>
                {data.top_portal_labels.map((label, i) => (
                  <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '100%',
                        background: '#2563eb',
                        height: `${(data.top_portal_values[i] / topPortalMax) * 150}px`,
                        borderRadius: '2px'
                      }}
                    ></div>
                    <small style={{ marginTop: '4px', fontSize: '10px', textAlign: 'center' }}>{label}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className='grid grid-2 mb-3'>
          <div className='card'>
            <h3>Recent Users</h3>
            {data.recent_users.length === 0 ? (
              <p>No users yet</p>
            ) : (
              <ul>
                {data.recent_users.map(user => (
                  <li key={user.id}>
                    {user.name} ({user.email}) - {new Date(user.created_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className='card'>
            <h3>Recent Alerts</h3>
            {data.recent_alerts.length === 0 ? (
              <p>No alerts yet</p>
            ) : (
              <ul>
                {data.recent_alerts.map(alert => (
                  <li key={alert.id}>
                    {alert.message} - {new Date(alert.alerted_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Admin
