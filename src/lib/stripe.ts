// Source: Stripe server client placeholder
import Stripe from 'stripe';

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is missing');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

