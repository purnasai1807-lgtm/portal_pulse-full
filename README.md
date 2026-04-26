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
   - `ADMIN_EMAIL`: Email address that should become the owner/admin account
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
- `ADMIN_EMAIL`: Email address that should receive admin access in production
- `DATABASE_URL`: PostgreSQL connection string
- `STRIPE_SECRET_KEY`: Stripe API key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `STRIPE_PRICE_ID`: Stripe product price ID
- `STRIPE_PRICE_PRO`: Stripe Pro plan price ID
- `STRIPE_PRICE_ENTERPRISE`: Stripe Enterprise plan price ID
- `FRONTEND_URL`: Frontend URL for CORS
- `EMAIL_HOST/PORT/USER/PASS/FROM`: Email configuration

### Frontend
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key (for future payment UI)

## Payment Setup

**Important**: To enable subscription payments and monetize your app, you must set up Stripe.

See [STRIPE_SETUP.md](./STRIPE_SETUP.md) for detailed instructions:
1. Create a Stripe account
2. Get API keys
3. Create products and pricing
4. Configure webhooks (for production)
5. Set environment variables

### Subscription Tiers
- **Free**: 2 portals
- **Pro**: 50 portals - $29/month
- **Enterprise**: 500 portals - $99/month

Users cannot create portals beyond their plan limit. Portal limits are enforced in the `/api/portals` POST endpoint.

## API Documentation

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Billing
- `GET /api/billing/plans` - Get available plans
- `GET /api/billing/status` - Get subscription status
- `POST /api/billing/create-checkout-session` - Create Stripe checkout
- `POST /api/billing/portal` - Open Stripe billing portal
- `POST /api/billing/cancel-subscription` - Cancel subscription
- `POST /api/webhook/stripe` - Stripe webhook endpoint

### Portals
- `GET /api/portals` - List portals
- `POST /api/portals` - Create portal (respects plan limits)
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
