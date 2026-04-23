# Stripe Configuration Guide

## 1. Create a Stripe Account
- Go to https://stripe.com
- Sign up for a free account
- Complete the onboarding process

## 2. Get API Keys
- Go to Dashboard → API Keys
- Copy both **Publishable Key** and **Secret Key**

## 3. Set Up Products & Pricing
- Go to Products → Add Product
- Create three products:
  - **Pro Plan**: $29/month
  - **Enterprise Plan**: $99/month
  - **Free Plan**: No product needed (free tier)

- For each paid product, copy the **Price ID**

## 4. Configure Stripe Webhooks (for production)
- Go to Webhooks → Add Endpoint
- Set endpoint URL: `https://your-backend.com/api/webhook/stripe`
- Select events:
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `checkout.session.completed`
- Copy the **Signing Secret**

## 5. Set Environment Variables

### Backend (Render)
```
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_... (for the checkout button)
STRIPE_PRICE_PRO=price_... (Pro plan)
STRIPE_PRICE_ENTERPRISE=price_... (Enterprise plan)
```

### Frontend (Netlify)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_... for production)
```

## 6. Update .env Files Locally

**backend/.env**:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

**frontend/.env**:
```
VITE_API_BASE_URL=http://localhost:5000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 7. Test Locally
1. Start backend: `python app.py`
2. Start frontend: `npm run dev`
3. Create account → Go to `/billing`
4. Test checkout with Stripe test card: `4242 4242 4242 4242`

## 8. Deploy to Production
- Update environment variables on Render and Netlify dashboards
- Use live keys (pk_live_, sk_live_) instead of test keys
- Update webhook signing secret for production endpoint
