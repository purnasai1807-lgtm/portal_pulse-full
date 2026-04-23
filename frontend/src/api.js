const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const Api = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`
    const config = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }
    const response = await fetch(url, config)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(error.error || 'Request failed')
    }
    return response.json()
  },

  async me() {
    return this.request('/api/auth/me')
  },

  async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  },

  async register(name, email, password) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    })
  },

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST'
    })
  },

  async dashboard() {
    return this.request('/api/dashboard')
  },

  async chatbot(query) {
    return this.request('/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({ query })
    })
  },

  async listPortals() {
    return this.request('/api/portals')
  },

  async createPortal(portal) {
    return this.request('/api/portals', {
      method: 'POST',
      body: JSON.stringify(portal)
    })
  },

  async updatePortal(id, portal) {
    return this.request(`/api/portals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(portal)
    })
  },

  async deletePortal(id) {
    return this.request(`/api/portals/${id}`, {
      method: 'DELETE'
    })
  },

  async testPortal(id) {
    return this.request(`/api/portals/${id}/test`, {
      method: 'POST'
    })
  },

  async portalHistory(id) {
    return this.request(`/api/portals/${id}/history`)
  },

  async getSettings() {
    return this.request('/api/settings')
  },

  async updateSettings(settings) {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
  },

  async testEmail() {
    return this.request('/api/settings/test-email', {
      method: 'POST'
    })
  },

  async admin() {
    return this.request('/api/admin')
  },

  async createCheckoutSession() {
    return this.request('/api/billing/create-checkout-session', {
      method: 'POST'
    })
  },

  async billingPortal() {
    return this.request('/api/billing/portal', {
      method: 'POST'
    })
  }
}

export default Api
