const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emails = ['nicolasbds.2000@gmail.com', 'nicolasbds,2000@gmail.com'];
  
  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (user) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' }
      });
      console.log(`User ${email} updated to ADMIN.`);
    } else {
      console.log(`User ${email} not found.`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
