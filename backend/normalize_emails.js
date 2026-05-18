const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const lowerEmail = user.email.toLowerCase();
    if (user.email !== lowerEmail) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: lowerEmail }
      });
      console.log(`Updated ${user.email} to ${lowerEmail}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
