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

export const billingController = {
  /** POST /api/billing/checkout { plan: 'basic' | 'pro' | 'ultimate' } */
  async createCheckoutSession(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      if (!user)
        return res
          .status(401)
          .json({ status: 'fail', message: 'Unauthorized' });

      const { plan } = req.body as { plan?: 'basic' | 'pro' | 'ultimate' };
      if (!plan || !['basic', 'pro', 'ultimate'].includes(plan)) {
        return res
          .status(400)
          .json({ status: 'fail', message: 'Invalid plan' });
      }

      // Always produce a valid price id
      const priceId = await resolveMonthlyPriceId(plan);

      const customerId = await getOrCreateStripeCustomerId({
        userId: user.id ?? null,
        clerkId: user.clerkId ?? null,
        email: user.email ?? null,
        name: user.displayName ?? user.name ?? null
      });

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        // IMPORTANT: include session_id so FE can call /finalize
        success_url: `${env.CORS_ORIGIN}/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.CORS_ORIGIN}/pricing?canceled=1`,
        // Help identify the user/plan even without webhooks
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
      if (!user)
        return res
          .status(401)
          .json({ status: 'fail', message: 'Unauthorized' });

      const sessionId = (req.query.session_id as string | undefined)?.trim();
      if (!sessionId)
        return res
          .status(400)
          .json({ status: 'fail', message: 'Missing session_id' });

      // Retrieve the checkout session + subscription expanded
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'subscription.items.data.price']
      });

      // Nothing to do if no subscription (e.g. canceled at checkout)
      const sub = session.subscription as Stripe.Subscription | null;
      if (!sub) {
        return res.json({
          status: 'ok',
          message: 'No active subscription on session'
        });
      }

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
        appUserId = user.id;
      }

      // Figure out which plan this subscription maps to
      const item = sub.items.data[0];
      const price = item?.price;

      // (1) Prefer lookup_key, (2) metadata.plan, (3) env fallback by id
      let plan: 'basic' | 'pro' | 'ultimate' | null = null;

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

      // Upsert subscription row (optional but nice to have in your DB)
      await prisma.subscription.upsert({
        where: { stripeSubId: sub.id },
        create: {
          stripeSubId: sub.id,
          userId: appUserId,
          stripePriceId: price?.id ?? '',
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000)
        },
        update: {
          stripePriceId: price?.id ?? '',
          status: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000)
        }
      });

      // Update the user plan + status
      await prisma.user.update({
        where: { id: appUserId },
        data: {
          plan: plan ?? undefined,
          subscriptionStatus: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000)
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
      if (!user)
        return res
          .status(401)
          .json({ status: 'fail', message: 'Unauthorized' });

      const customerId = await getOrCreateStripeCustomerId({
        userId: user.id ?? null,
        clerkId: user.clerkId ?? null,
        email: user.email ?? null,
        name: user.displayName ?? user.name ?? null
      });

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: env.STRIPE_PORTAL_RETURN_URL
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
      if (!user)
        return res
          .status(401)
          .json({ status: 'fail', message: 'Unauthorized' });

      const customerId =
        user.stripeCustomerId ||
        (await getOrCreateStripeCustomerId({
          userId: user.id ?? null,
          clerkId: user.clerkId ?? null,
          email: user.email ?? null,
          name: user.displayName ?? user.name ?? null
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
