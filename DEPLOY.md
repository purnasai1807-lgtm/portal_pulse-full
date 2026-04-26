i# 🚀 Deploy PortalPulse to Production
**GitHub:** `purnasai1807-lgtm`

---

## Option 1: PowerShell Script (Easiest)

Open PowerShell and run:
```powershell
cd c:/Users/LIKHITHA/OneDrive/Desktop/PortalSprint/portalpulse_full
.\PUSH_TO_GITHUB.ps1
```

If it says you're not logged in, run:
```powershell
gh auth login
```
Then run the script again.

---

## Option 2: Manual Steps

### Step 1: Push to GitHub
```powershell
cd c:/Users/LIKHITHA/OneDrive/Desktop/PortalSprint/portalpulse_full

# Login to GitHub (opens browser - no password needed if already logged in!)
gh auth login

# Create repo and push
gh repo create PortalPulse --public --source=. --remote=origin --push
```

Your repo will be at: **https://github.com/purnasai1807-Igtm/PortalPulse**

### Step 2: Deploy to Render
Click this button:
[Deploy to Render](https://render.com/deploy?repo=https://github.com/purnasai1807-Igtm/PortalPulse)

Or manually:
1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Blueprint**
3. Connect GitHub repo `purnasai1807-Igtm/PortalPulse`
4. Render auto-reads `render.yaml` and creates everything

### Step 3: Set Environment Variables
After deploy, in Render Dashboard:
- `STRIPE_SECRET_KEY` (from Stripe dashboard)
- `STRIPE_PRICE_PRO` (Stripe price ID)
- `STRIPE_PRICE_ENTERPRISE` (Stripe price ID)
- `FRONTEND_URL` (your frontend URL)

### Step 4: Stripe Webhook
Stripe Dashboard → Developers → Webhooks:
- Endpoint: `https://your-api.onrender.com/api/webhook/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

---

## If You Forgot Your GitHub Password

1. Go to [github.com/password_reset](https://github.com/password_reset)
2. Enter your email
3. Check email and reset password
4. Come back and run `gh auth login`

---

## After Deploy

| Service | URL Pattern |
|---------|-------------|
| Frontend | `https://portalpulse-frontend.onrender.com` |
| API | `https://portalpulse-api.onrender.com` |
| Login | `demo@portalpulse.com` / `demo123` |
