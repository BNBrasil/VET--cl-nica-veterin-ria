import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ['PACIENTE', 'RECEPCIONISTA', 'MEDICO', 'ADMIN'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Role inválida.' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role },
    });
    res.json({ message: `Role do usuário ${user.name} atualizada para ${role}.`, user });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar role do usuário.' });
  }
};
