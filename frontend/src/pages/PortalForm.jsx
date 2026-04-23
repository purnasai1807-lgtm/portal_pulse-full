import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Api from '../api.js'

function PortalForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [form, setForm] = useState({
    name: '',
    url: '',
    mode: 'html',
    headers_json: '{}',
    trigger_words_json: '[]',
    block_words_json: '[]',
    json_rules_json: '[]',
    is_active: true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (isEdit) {
      loadPortal()
    }
  }, [id])

  const loadPortal = async () => {
    try {
      const result = await Api.listPortals()
      const portal = result.portals.find(p => p.id == id)
      if (portal) {
        setForm({
          name: portal.name,
          url: portal.url,
          mode: portal.mode,
          headers_json: portal.headers_json,
          trigger_words_json: portal.trigger_words_json,
          block_words_json: portal.block_words_json,
          json_rules_json: portal.json_rules_json,
          is_active: portal.is_active
        })
      }
    } catch (err) {
      setError('Failed to load portal')
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      if (isEdit) {
        await Api.updatePortal(id, form)
        setSuccess('Portal updated successfully!')
      } else {
        await Api.createPortal(form)
        setSuccess('Portal created successfully!')
      }
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-form">
      <div className="container">
        <div className="card">
          <h1 className="mb-3">{isEdit ? 'Edit Portal' : 'Add New Portal'}</h1>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Portal Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g., Ticket Portal"
                required
              />
            </div>
            
            <div className="form-group">
              <label>URL to Monitor</label>
              <input
                type="url"
                name="url"
                value={form.url}
                onChange={handleChange}
                placeholder="https://example.com/tickets"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Monitoring Mode</label>
              <select name="mode" value={form.mode} onChange={handleChange}>
                <option value="html">HTML (Web Page)</option>
                <option value="json">JSON (API Response)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Custom Headers (JSON)</label>
              <textarea
                name="headers_json"
                value={form.headers_json}
                onChange={handleChange}
                placeholder='{"User-Agent": "Mozilla/5.0"}'
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label>Trigger Words (JSON Array)</label>
              <textarea
                name="trigger_words_json"
                value={form.trigger_words_json}
                onChange={handleChange}
                placeholder='["available", "book now", "open"]'
                rows="3"
              />
              <small>Words that indicate availability</small>
            </div>
            
            <div className="form-group">
              <label>Block Words (JSON Array)</label>
              <textarea
                name="block_words_json"
                value={form.block_words_json}
                onChange={handleChange}
                placeholder='["sold out", "unavailable", "login required"]'
                rows="3"
              />
              <small>Words that indicate unavailability</small>
            </div>
            
            {form.mode === 'json' && (
              <div className="form-group">
                <label>JSON Rules (JSON Array)</label>
                <textarea
                  name="json_rules_json"
                  value={form.json_rules_json}
                  onChange={handleChange}
                  placeholder='[{"path": "data.available", "mode": "equals", "value": true}]'
                  rows="5"
                />
                <small>Rules for JSON API responses. Modes: exists, equals, contains</small>
              </div>
            )}
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleChange}
                />
                Active (monitoring enabled)
              </label>
            </div>
            
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            
            <div className="flex gap-1">
              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Saving...' : (isEdit ? 'Update Portal' : 'Create Portal')}
              </button>
              <button 
                type="button" 
                onClick={() => navigate('/dashboard')}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default PortalForm
