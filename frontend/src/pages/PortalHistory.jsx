import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Api from '../api.js'

function PortalHistory() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const result = await Api.portalHistory(id)
        setData(result)
      } catch (err) {
        setError(err.message)
        if (err.message === 'Unauthorized') {
          navigate('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [id, navigate])

  if (loading) {
    return <div className='loading'>Loading portal history...</div>
  }

  if (error) {
    return <div className='container'>{error}</div>
  }

  return (
    <div className='container'>
      <div className='mb-3'>
        <Link to='/dashboard' className='btn btn-secondary'>Back to Dashboard</Link>
      </div>

      <div className='card mb-3'>
        <h1>{data.portal.name}</h1>
        <p>{data.portal.url}</p>
      </div>

      <div className='grid grid-2'>
        <div className='card'>
          <h2 className='mb-2'>Recent Checks</h2>
          {data.history.length === 0 ? (
            <p>No checks yet.</p>
          ) : (
            <ul>
              {data.history.map(entry => (
                <li key={entry.id} className='mb-2'>
                  <strong>{entry.status_text}</strong>
                  <div>{new Date(entry.checked_at).toLocaleString()}</div>
                  {entry.match_text && <div>Match: {entry.match_text}</div>}
                  <div>{entry.is_triggered ? 'Triggered' : 'No trigger'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='card'>
          <h2 className='mb-2'>Recent Alerts</h2>
          {data.alerts.length === 0 ? (
            <p>No alerts yet.</p>
          ) : (
            <ul>
              {data.alerts.map(alert => (
                <li key={alert.id} className='mb-2'>
                  <strong>{new Date(alert.alerted_at).toLocaleString()}</strong>
                  <div>{alert.message}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default PortalHistory
