// src/services/stripeService.ts
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// ---- Create/resolve recurring monthly prices if needed ----
const PLAN_AMOUNTS_USD: Record<'basic' | 'pro' | 'ultimate', number> = {
  basic: 799, // $7.99
  pro: 1199, // $11.99
  ultimate: 1499 // $14.99
};

const PLAN_NAMES: Record<'basic' | 'pro' | 'ultimate', string> = {
  basic: 'Streakling Basic',
  pro: 'Streakling Pro',
  ultimate: 'Streakling Ultimate'
};

const PLAN_LOOKUP_KEYS: Record<'basic' | 'pro' | 'ultimate', string> = {
  basic: 'basic_monthly',
  pro: 'pro_monthly',
  ultimate: 'ultimate_monthly'
};

async function ensurePriceExists(priceId: string): Promise<boolean> {
  try {
    const p = await stripe.prices.retrieve(priceId);
    return !!p?.id;
  } catch {
    return false;
  }
}

/** Returns a valid recurring monthly price id for the plan.
 *  Order: (1) env if valid in this account/mode, (2) lookup_key, (3) create.
 */
export async function resolveMonthlyPriceId(
  plan: 'basic' | 'pro' | 'ultimate'
): Promise<string> {
  const envMap: Record<'basic' | 'pro' | 'ultimate', string | undefined> = {
    basic: env.STRIPE_PRICE_BASIC,
    pro: env.STRIPE_PRICE_PRO,
    ultimate: env.STRIPE_PRICE_ULTIMATE
  };
  const envPrice = envMap[plan];
  if (envPrice && envPrice.startsWith('price_')) {
    const ok = await ensurePriceExists(envPrice);
    if (ok) return envPrice;
    console.warn(
      `[stripe] Env price ${envPrice} for "${plan}" not found in this account/mode, falling back to lookup/create.`
    );
  }

  const lookupKey = PLAN_LOOKUP_KEYS[plan];
  const listed = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
    expand: ['data.product']
  });
  if (listed.data.length > 0) {
    return listed.data[0].id;
  }

  const created = await stripe.prices.create({
    currency: 'usd',
    unit_amount: PLAN_AMOUNTS_USD[plan],
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
    product_data: { name: PLAN_NAMES[plan], metadata: { plan } },
    metadata: { plan }
  });

  return created.id;
}

// ---- Customer helper ----
type Lookup = {
  userId?: string | null;
  clerkId?: string | null;
  email?: string | null;
  name?: string | null;
};

export async function getOrCreateStripeCustomerId({
  userId,
  clerkId,
  email,
  name
}: Lookup): Promise<string> {
  let user = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;

  if (userId) user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user && clerkId)
    user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user && email) user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new Error('User not found for Stripe customer');

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email ?? email ?? undefined,
    name: user.displayName ?? name ?? undefined,
    metadata: { appUserId: user.id, clerkId: user.clerkId ?? '' }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id }
  });

  return customer.id;
}
