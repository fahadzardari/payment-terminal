
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  // Create a test brand
  const brand = await prisma.brand.createMany({
    data: [
      {
        name: 'Test Brand',
        logoUrl: '/brand-logos/nixxon-publisher.png',
        description: 'A brand for content publishers',
      }
    ]
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@payment-terminal.com",
      password: bcrypt.hashSync("aDMin@54321!", 10),
      name: "Admin User",
      role: "admin"
    },
  });

  console.log('Created brand:', admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });