import { prisma } from '../config/prisma.js';
import type { User } from '@prisma/client';

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
  return prisma.user.upsert({
    where: { clerkId: input.clerkId },
    create: {
      clerkId: input.clerkId,
      username: input.username ?? null,
      email: input.email ?? null,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      country: input.country ?? null,
      phone: input.phone ?? null,
      religion: input.religion ?? null
    },
    update: {
      username: input.username ?? null,
      email: input.email ?? null,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      country: input.country ?? null,
      phone: input.phone ?? null,
      religion: input.religion ?? null
    }
  });
}
