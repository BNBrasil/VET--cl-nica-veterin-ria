const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = 'nicolasbds.2000@gmail.com';
  const password = 'admin123';
  const password_hash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { email },
    data: { password_hash }
  });
  console.log(`Senha de ${email} resetada para ${password}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
