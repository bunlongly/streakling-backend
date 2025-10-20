// src/services/userService.ts
import { prisma } from '../config/prisma.js';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';

function clean(s?: string | null): string | undefined {
  const v = (s ?? '').trim();
  return v.length ? v : undefined;
}

/**
 * Create user on first login.
 * On subsequent logins, only refresh Clerk-owned fields (email, displayName, avatarUrl).
 * Username is managed exclusively by our /username flow (not here).
 */
export async function upsertUserFromClerk(input: {
  clerkId: string;
  // username is ignored here by design to avoid collisions
  username?: string | null;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  country?: string | null;
  phone?: string | null;
  religion?: string | null;
}): Promise<User> {
  const existing = await prisma.user.findUnique({
    where: { clerkId: input.clerkId }
  });

  if (!existing) {
    // FIRST LOGIN → do NOT set username. Create a minimal row.
    return prisma.user.create({
      data: {
        clerkId: input.clerkId,
        email: clean(input.email),
        displayName: clean(input.displayName) ?? 'User',
        avatarUrl: clean(input.avatarUrl),
        country: clean(input.country),
        phone: clean(input.phone),
        religion: clean(input.religion)
        // username intentionally omitted here
      }
    });
  }

  // SUBSEQUENT LOGINS → refresh only Clerk-owned fields.
  // Username remains untouched here (set via /username API).
  return prisma.user.update({
    where: { id: existing.id },
    data: {
      email: clean(input.email),
      displayName: clean(input.displayName) ?? existing.displayName,
      avatarUrl: clean(input.avatarUrl)
      // no username changes here
    }
  });
}
