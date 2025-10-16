import 'dotenv/config';
import { prisma } from '../src/config/prisma';
async function main() {
    const email = process.env.SEED_ADMIN_EMAIL?.trim();
    if (!email) {
        console.error('❌ Missing SEED_ADMIN_EMAIL in env');
        process.exit(1);
    }
    // Look up by email
    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() }
    });
    if (!user) {
        console.log(`⚠️  User with email ${email} not found yet.\n` +
            `   → Sign in with Clerk using this email once, then re-run:\n` +
            `   SEED_ADMIN_EMAIL=${email} pnpm prisma db seed`);
        return;
    }
    if (user.role === 'ADMIN') {
        console.log(`✅ ${email} is already ADMIN (id=${user.id})`);
        return;
    }
    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' }
    });
    console.log(`Promoted ${email} to ADMIN (id=${user.id})`);
}
main()
    .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
