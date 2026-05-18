const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('1234', 10);
  
  const user = await prisma.user.create({
    data: {
      name: 'Teste',
      email: 'teste@teste.com',
      password_hash: hash,
      role: 'ADMIN'
    }
  });
  
  console.log('Usuário criado:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());