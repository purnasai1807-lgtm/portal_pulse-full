import { useEffect, useState } from 'react'
import Api from '../api.js'

function Settings() {
  const [settings, setSettings] = useState({
    telegram_bot_token: '',
    telegram_chat_id: '',
    whatsapp_graph_api_version: 'v23.0',
    whatsapp_phone_number_id: '',
    whatsapp_access_token: '',
    whatsapp_recipient_phone_number: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await Api.getSettings()
      setSettings(data)
    } catch (err) {
      setError('Failed to load settings')
    }
  }

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      await Api.updateSettings(settings)
      setSuccess('Settings saved successfully!')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTestEmail = async () => {
    try {
      await Api.testEmail()
      alert('Test email sent successfully!')
    } catch (err) {
      alert('Test email failed: ' + err.message)
    }
  }

  return (
    <div className="settings">
      <div className="container">
        <div className="card">
          <h1 className="mb-3">Global Settings</h1>
          <p className="mb-3">Configure notification channels for all users.</p>
          
          <form onSubmit={handleSubmit}>
            <h2>Telegram Settings</h2>
            <div className="form-group">
              <label>Bot Token</label>
              <input
                type="text"
                name="telegram_bot_token"
                value={settings.telegram_bot_token}
                onChange={handleChange}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              />
            </div>
            
            <div className="form-group">
              <label>Chat ID</label>
              <input
                type="text"
                name="telegram_chat_id"
                value={settings.telegram_chat_id}
                onChange={handleChange}
                placeholder="-1001234567890"
              />
            </div>
            
            <h2 className="mt-3">WhatsApp Settings</h2>
            <div className="form-group">
              <label>Graph API Version</label>
              <input
                type="text"
                name="whatsapp_graph_api_version"
                value={settings.whatsapp_graph_api_version}
                onChange={handleChange}
                placeholder="v23.0"
              />
            </div>
            
            <div className="form-group">
              <label>Phone Number ID</label>
              <input
                type="text"
                name="whatsapp_phone_number_id"
                value={settings.whatsapp_phone_number_id}
                onChange={handleChange}
                placeholder="123456789012345"
              />
            </div>
            
            <div className="form-group">
              <label>Access Token</label>
              <input
                type="password"
                name="whatsapp_access_token"
                value={settings.whatsapp_access_token}
                onChange={handleChange}
                placeholder="EAA..."
              />
            </div>
            
            <div className="form-group">
              <label>Recipient Phone Number</label>
              <input
                type="text"
                name="whatsapp_recipient_phone_number"
                value={settings.whatsapp_recipient_phone_number}
                onChange={handleChange}
                placeholder="+1234567890"
              />
            </div>
            
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            
            <div className="flex gap-1">
              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
              <button 
                type="button" 
                onClick={handleTestEmail}
                className="btn btn-secondary"
              >
                Test Email
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Settings
