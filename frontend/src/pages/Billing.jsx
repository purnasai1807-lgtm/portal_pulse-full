import React, { useState, useEffect } from 'react';
import './Billing.css';

export default function Billing() {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPlans();
    fetchSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/billing/plans`);
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  const fetchSubscription = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/billing/status`, {
        credentials: 'include'
      });
      const data = await res.json();
      setSubscription(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setLoading(false);
    }
  };

  const handleCheckout = async (planId) => {
    if (planId === 'free') {
      setError('Free plan is already active');
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      setError('Error creating checkout session');
      console.error(err);
    }
  };

  const handleBillingPortal = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/billing/portal`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to open billing portal');
      }
    } catch (err) {
      setError('Error accessing billing portal');
      console.error(err);
    }
  };

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel your subscription?')) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/billing/cancel-subscription`, {
          method: 'POST',
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          setError(null);
          fetchSubscription();
        } else {
          setError(data.error || 'Failed to cancel subscription');
        }
      } catch (err) {
        setError('Error canceling subscription');
        console.error(err);
      }
    }
  };

  if (loading) {
    return <div className="billing-container"><p>Loading...</p></div>;
  }

  return (
    <div className="billing-container">
      <h1>Billing & Plans</h1>

      {error && <div className="error-message">{error}</div>}

      {subscription && (
        <div className="current-subscription">
          <h3>Current Subscription</h3>
          <p><strong>Plan:</strong> {subscription.subscription.plan.toUpperCase()}</p>
          <p><strong>Status:</strong> {subscription.subscription.status}</p>
          <p><strong>Portals:</strong> {subscription.portal_count} / {subscription.portal_limit}</p>
          {subscription.subscription.status === 'active' && (
            <>
              <button onClick={handleBillingPortal} className="btn-secondary">
                Manage Subscription
              </button>
              <button onClick={handleCancel} className="btn-danger">
                Cancel Subscription
              </button>
            </>
          )}
        </div>
      )}

      <div className="plans-grid">
        {plans.map((plan) => (
          <div key={plan.id} className="plan-card">
            <h3>{plan.name}</h3>
            <p className="price">${plan.price}/month</p>
            <p className="features">
              <strong>Portals:</strong> {plan.portals}
            </p>
            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={subscription?.subscription.plan === plan.id}
              className={subscription?.subscription.plan === plan.id ? 'btn-disabled' : 'btn-primary'}
            >
              {subscription?.subscription.plan === plan.id ? 'Current Plan' : 'Select Plan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
