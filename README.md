# PortalPulse Full-Stack Application

A comprehensive portal monitoring and management system with AI-powered features.

## Features
- Portal status monitoring
- AI chatbot integration
- User authentication and billing
- Admin dashboard
- Real-time alerts

## Tech Stack
- **Backend**: Flask (Python) with SQLAlchemy, PostgreSQL
- **Frontend**: React with Vite
- **Deployment**: Render (backend), Netlify (frontend)
- **CI/CD**: GitHub Actions

## Local Development

### Prerequisites
- Python 3.8+
- Node.js 18+
- PostgreSQL (or use SQLite for dev)

### Setup
1. Clone the repo
2. Backend setup:
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```
3. Frontend setup:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Deployment

### Automatic Deployment (Recommended)
The app is configured for automatic deployment using GitHub Actions.

#### 1. Deploy Backend to Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" > "Blueprint"
3. Connect GitHub repo: `purnasai1807-lgtm/portal_pulse-full`
4. Render auto-detects `render.yaml` and creates services
5. Add environment variables:
   - `SECRET_KEY`: Random string
   - `STRIPE_SECRET_KEY`: Your Stripe key
   - `STRIPE_PRICE_ID`: Your Stripe price ID
   - `DATABASE_URL`: Auto-provided by Render
6. Deploy

#### 2. Set Up Frontend on Netlify
1. Go to [Netlify](https://app.netlify.com/)
2. "Add new site" > "Import existing project"
3. Connect GitHub repo
4. Build settings:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Deploy

#### 3. Configure GitHub Secrets
Go to repo Settings > Secrets and variables > Actions:
- `NETLIFY_AUTH_TOKEN`: Netlify access token
- `NETLIFY_SITE_ID`: Netlify site ID
- `VITE_API_BASE_URL`: Render backend URL
- `RENDER_DEPLOY_HOOK_URL` (optional): Render deploy hook

Every push to `master` now auto-deploys!

## Environment Variables

### Backend
- `SECRET_KEY`: Flask secret key
- `DATABASE_URL`: PostgreSQL connection string
- `STRIPE_SECRET_KEY`: Stripe API key
- `STRIPE_PRICE_ID`: Stripe product price ID
- `FRONTEND_URL`: Frontend URL for CORS
- `EMAIL_HOST/PORT/USER/PASS/FROM`: Email configuration

### Frontend
- `VITE_API_BASE_URL`: Backend API URL

## API Documentation

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Portals
- `GET /api/portals` - List portals
- `POST /api/portals` - Create portal
- `PUT /api/portals/:id` - Update portal
- `DELETE /api/portals/:id` - Delete portal
- `POST /api/portals/:id/test` - Test portal

### Other
- `GET /api/dashboard` - Dashboard data
- `POST /api/chatbot` - AI chatbot
- `GET /api/settings` - App settings
- `PUT /api/settings` - Update settings

## License
MIT