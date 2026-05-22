import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const categories = [
  { nameEn: 'Errands & Pickups', nameAr: 'مشاوير وتوصيل', icon: 'bag', basePriceFils: 3000 },
  { nameEn: 'Government Services', nameAr: 'خدمات حكومية', icon: 'building', basePriceFils: 5000 },
  { nameEn: 'Home Cleaning', nameAr: 'تنظيف منزلي', icon: 'broom', basePriceFils: 15000 },
  { nameEn: 'Handyman & Repairs', nameAr: 'صيانة وإصلاح', icon: 'wrench', basePriceFils: 8000 },
  { nameEn: 'Grocery Shopping', nameAr: 'تسوق بقالة', icon: 'cart', basePriceFils: 2000 },
  { nameEn: 'Personal Shopping', nameAr: 'تسوق شخصي', icon: 'shopping-bag', basePriceFils: 5000 },
  { nameEn: 'Moving & Assembly', nameAr: 'نقل وتجميع', icon: 'box', basePriceFils: 20000 },
  { nameEn: 'Car Services', nameAr: 'خدمات سيارة', icon: 'car', basePriceFils: 4000 },
  { nameEn: 'Pet Services', nameAr: 'خدمات حيوانات', icon: 'paw', basePriceFils: 3000 },
  { nameEn: 'Beauty at Home', nameAr: 'تجميل بالمنزل', icon: 'sparkles', basePriceFils: 8000 },
  { nameEn: 'Tech Support', nameAr: 'دعم تقني', icon: 'laptop', basePriceFils: 5000 },
  { nameEn: 'Event Help', nameAr: 'مساعدة فعاليات', icon: 'star', basePriceFils: 10000 }
];

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

  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { nameEn: cat.nameEn },
      update: cat,
      create: cat,
    });
    console.log(`Created/updated category: ${category.nameEn}`);
  }

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
