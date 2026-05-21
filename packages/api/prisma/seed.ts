import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  const passwordHash = await bcrypt.hash('Admin@1234', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@aidea.ae' },
    update: {
      password: passwordHash,
      role: 'ADMIN',
    },
    create: {
      email: 'admin@aidea.ae',
      phone: '+971000000000',
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      password: passwordHash,
    },
  });

  console.log(`Created admin user with id: ${admin.id}`);
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
