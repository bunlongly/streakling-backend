// src/controllers/billingController.ts
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import {
  stripe,
  getOrCreateStripeCustomerId,
  resolveMonthlyPriceId
} from '../services/stripeService.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

// Type guard to ensure we truly have a Stripe.Subscription at runtime
function isStripeSubscription(x: unknown): x is Stripe.Subscription {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' &&
    typeof o['status'] === 'string' &&
    !!o['items'] &&
    typeof o['current_period_end'] === 'number'
  );
}

export const billingController = {
  /** POST /api/billing/checkout { plan: 'basic' | 'pro' | 'ultimate' } */
  async createCheckoutSession(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res
          .status(401)
          .json({ status: 'fail', message: 'Unauthorized' });
      }

      const { plan } = req.body as { plan?: 'basic' | 'pro' | 'ultimate' };
      if (!plan || !['basic', 'pro', 'ultimate'].includes(plan)) {
        return res
          .status(400)
          .json({ status: 'fail', message: 'Invalid plan' });
      }

      // Always produce a valid price id
      const priceId = await resolveMonthlyPriceId(plan);

      // Use undefined (not null) for optional fields
      const customerId = await getOrCreateStripeCustomerId({
        userId: (user.id ?? undefined) as string | undefined,
        clerkId: (user.clerkId ?? undefined) as string | undefined,
        email: (user.email ?? undefined) as string | undefined,
        name: (user.displayName ?? user.name ?? undefined) as string | undefined
      });

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${env.CORS_ORIGIN}/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.CORS_ORIGIN}/pricing?canceled=1`,
        subscription_data: { metadata: { appUserId: user.id ?? '', plan } },
        metadata: { appUserId: user.id ?? '', plan }
      });

      if (!session.url) throw new Error('Stripe did not return a Checkout URL');
      return res.json({ status: 'ok', url: session.url });
    } catch (err: any) {
      console.error('checkout error:', err);
      return res
        .status(500)
        .json({ status: 'error', message: err?.message ?? 'Internal error' });
    }
  },

  /** GET /api/billing/finalize?session_id=cs_test_... */
  async finalizeFromCheckout(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res
          .status(401)
          .json({ status: 'fail', message: 'Unauthorized' });
      }

      const sessionId = (req.query.session_id as string | undefined)?.trim();
      if (!sessionId) {
        return res
          .status(400)
          .json({ status: 'fail', message: 'Missing session_id' });
      }

      // Expand subscription so we can read price + period
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'subscription.items.data.price']
      });

      const maybeSub = session.subscription; // string | Stripe.Subscription | null
      if (!maybeSub || typeof maybeSub === 'string') {
        return res.json({
          status: 'ok',
          message: 'No active subscription on session'
        });
      }

      // Strong runtime-narrowing
      if (!isStripeSubscription(maybeSub)) {
        return res
          .status(500)
          .json({ status: 'error', message: 'Unexpected subscription shape' });
      }
      const sub = maybeSub; // Stripe.Subscription

      // Determine the appUserId
      let appUserId: string | null =
        (sub.metadata?.appUserId as string | undefined) ??
        (session.metadata?.appUserId as string | undefined) ??
        null;

      // Fallback: find by customer id
      if (!appUserId && typeof sub.customer === 'string') {
        const owner = await prisma.user.findFirst({
          where: { stripeCustomerId: sub.customer },
          select: { id: true }
        });
        appUserId = owner?.id ?? null;
      }

      if (!appUserId) {
        // As a last fallback, use the current requester
        appUserId = user.id as string;
      }

      // Determine plan from lookup_key / metadata / env fallback
      const item = sub.items.data[0];
      const price = item?.price;
      let plan: 'basic' | 'pro' | 'ultimate' | undefined;

      const lookup = (price as any)?.lookup_key as string | undefined;
      if (lookup === 'basic_monthly') plan = 'basic';
      else if (lookup === 'pro_monthly') plan = 'pro';
      else if (lookup === 'ultimate_monthly') plan = 'ultimate';
      else {
        const metaPlan = (sub.metadata?.plan || session.metadata?.plan) as any;
        if (
          metaPlan === 'basic' ||
          metaPlan === 'pro' ||
          metaPlan === 'ultimate'
        ) {
          plan = metaPlan;
        } else {
          const priceId = price?.id;
          if (priceId === env.STRIPE_PRICE_BASIC) plan = 'basic';
          else if (priceId === env.STRIPE_PRICE_PRO) plan = 'pro';
          else if (priceId === env.STRIPE_PRICE_ULTIMATE) plan = 'ultimate';
        }
      }

      // ⚠️ Cast only at the access site to avoid Prisma Subscription collisions
      const currentPeriodEndSec = (
        sub as unknown as { current_period_end: number }
      ).current_period_end;
      const periodEnd = new Date(currentPeriodEndSec * 1000);

      await prisma.subscription.upsert({
        where: { stripeSubId: sub.id },
        create: {
          stripeSubId: sub.id,
          userId: appUserId,
          stripePriceId: price?.id ?? '',
          status: sub.status,
          currentPeriodEnd: periodEnd
        },
        update: {
          stripePriceId: price?.id ?? '',
          status: sub.status,
          currentPeriodEnd: periodEnd
        }
      });

      await prisma.user.update({
        where: { id: appUserId },
        data: {
          plan: plan ?? undefined,
          subscriptionStatus: sub.status,
          currentPeriodEnd: periodEnd
        }
      });

      return res.json({ status: 'ok', message: 'Subscription persisted' });
    } catch (err: any) {
      console.error('finalize error:', err);
      return res
        .status(500)
        .json({ status: 'error', message: err?.message ?? 'Internal error' });
    }
  },

  /** POST /api/billing/portal */
  async createBillingPortal(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res
          .status(401)
          .json({ status: 'fail', message: 'Unauthorized' });
      }

      const customerId = await getOrCreateStripeCustomerId({
        userId: (user.id ?? undefined) as string | undefined,
        clerkId: (user.clerkId ?? undefined) as string | undefined,
        email: (user.email ?? undefined) as string | undefined,
        name: (user.displayName ?? user.name ?? undefined) as string | undefined
      });

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: env.STRIPE_PORTAL_RETURN_URL as string
      });

      return res.json({ status: 'ok', url: portal.url });
    } catch (err: any) {
      console.error('portal error:', err);
      return res
        .status(500)
        .json({ status: 'error', message: err?.message ?? 'Internal error' });
    }
  },

  /** GET /api/billing/invoices — list last 20 invoices */
  async listInvoices(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res
          .status(401)
          .json({ status: 'fail', message: 'Unauthorized' });
      }

      const customerId =
        user.stripeCustomerId ||
        (await getOrCreateStripeCustomerId({
          userId: (user.id ?? undefined) as string | undefined,
          clerkId: (user.clerkId ?? undefined) as string | undefined,
          email: (user.email ?? undefined) as string | undefined,
          name: (user.displayName ?? user.name ?? undefined) as
            | string
            | undefined
        }));

      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit: 20
      });

      const items = invoices.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        total: inv.total,
        currency: inv.currency,
        created: inv.created * 1000,
        hosted_invoice_url: inv.hosted_invoice_url ?? null,
        invoice_pdf: inv.invoice_pdf ?? null
      }));

      return res.json({ status: 'ok', items });
    } catch (err: any) {
      console.error('list invoices error:', err);
      return res
        .status(500)
        .json({ status: 'error', message: err?.message ?? 'Internal error' });
    }
  }
};
