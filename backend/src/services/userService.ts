import { prisma } from '../config/prisma.js';
import type { User } from '@prisma/client';

/**
 * Create user on first login.
 * On subsequent logins, only refresh Clerk-owned fields (email, displayName, avatarUrl).
 * Never overwrite user-managed fields (username, country, phone, religion) unless they're empty AND we have a non-empty incoming value.
 */
export async function upsertUserFromClerk(input: {
  clerkId: string;
  username?: string | null;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  country?: string | null;
  phone?: string | null;
  religion?: string | null;
}): Promise<User> {
  // See if user exists first
  const existing = await prisma.user.findUnique({
    where: { clerkId: input.clerkId }
  });

  if (!existing) {
    // FIRST LOGIN → create minimal row. Use only values we actually have.
    return prisma.user.create({
      data: {
        clerkId: input.clerkId,
        // treat empty strings / nulls as undefined so we don't write nulls unnecessarily
        username: input.username ?? undefined,
        email: input.email ?? undefined,
        displayName: input.displayName || 'User',
        avatarUrl: input.avatarUrl ?? undefined,
        country: input.country ?? undefined,
        phone: input.phone ?? undefined,
        religion: input.religion ?? undefined
      }
    });
  }

  // SUBSEQUENT LOGINS → refresh only Clerk-owned fields if provided.
  // Never force nulls. Using `?? undefined` tells Prisma "leave it alone" when not provided.
  const data: Partial<User> = {
    email: input.email ?? undefined,
    displayName: input.displayName ?? undefined,
    avatarUrl: input.avatarUrl ?? undefined
  };

  // Optional “fill once” logic for user-managed fields:
  // Only set these if DB is empty and incoming has a non-empty value.
  if (!existing.username && input.username) data.username = input.username;
  if (!existing.country && input.country) data.country = input.country;
  if (!existing.phone && input.phone) data.phone = input.phone;
  if (!existing.religion && input.religion) data.religion = input.religion;

  return prisma.user.update({
    where: { id: existing.id },
    data
  });
}
