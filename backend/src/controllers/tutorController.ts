import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logAction } from '../utils/audit';

export const listTutors = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search ? String(req.query.search) : '';

    const tutors = await prisma.tutor.findMany({
      where: {
        OR: [
          { user: { name: { contains: search } } },
          { user: { email: { contains: search } } },
          { phone: { contains: search } },
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        animals: {
          select: { id: true, name: true, photo_url: true, species: true, breed: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    res.json({ tutors });
  } catch (error) {
    console.error('[LIST TUTORS ERROR]:', error);
    res.status(500).json({ error: 'Erro ao carregar listagem de tutores.' });
  }
};

export const getTutorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Enforce that tutors can only fetch their own data
    if (req.user!.role === 'PACIENTE') {
      const selfTutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!selfTutor || selfTutor.id !== id) {
        res.status(403).json({ error: 'Permissão negada.' });
        return;
      }
    }

    const tutor = await prisma.tutor.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        animals: true,
      },
    });

    if (!tutor) {
      res.status(404).json({ error: 'Tutor não encontrado.' });
      return;
    }

    res.json({ tutor });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao pesquisar dados do tutor.' });
  }
};

export const updateTutorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // ACL check
    if (req.user!.role === 'PACIENTE') {
      const selfTutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!selfTutor || selfTutor.id !== id) {
        res.status(403).json({ error: 'Permissão negada.' });
        return;
      }
    }

    const tutorUpdateSchema = z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    });

    const { name, phone, address } = tutorUpdateSchema.parse(req.body);

    const currentTutor = await prisma.tutor.findUnique({ where: { id } });
    if (!currentTutor) {
      res.status(404).json({ error: 'Tutor não localizado.' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (name) {
        await tx.user.update({
          where: { id: currentTutor.userId },
          data: { name },
        });
      }

      return tx.tutor.update({
        where: { id },
        data: {
          phone: phone || undefined,
          address: address || undefined,
        },
      });
    });

    await logAction(req.user!.id, 'ATUALIZAR_TUTOR', 'tutors', updated.id);

    res.json({ message: 'Perfil atualizado com sucesso.', tutor: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao modificar perfil do tutor.' });
  }
};
