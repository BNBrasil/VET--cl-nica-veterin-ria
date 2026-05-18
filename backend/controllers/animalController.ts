import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { logAction } from '../utils/audit';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Validator
const animalSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  species: z.string().min(1, 'Espécie é obrigatória'),
  breed: z.string().min(1, 'Raça é obrigatória'),
  birth_date: z.string().transform((val) => new Date(val)),
  weight: z.preprocess((val) => parseFloat(val as string), z.number().positive('Peso inválido')),
  allergies: z.string().optional(),
  tutorId: z.string().optional(), // Enforced for admin/recepcionist, or auto-filled for pacients
});

export const createAnimal = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    const data = animalSchema.parse(req.body);
    let tutorId: string;

    if (req.user.role === 'PACIENTE') {
      // Look up current logged user's tutor entry
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user.id } });
      if (!tutor) {
        res.status(400).json({ error: 'Perfil do tutor associado não localizado.' });
        return;
      }
      tutorId = tutor.id;
    } else {
      // Staff registering an animal
      if (!data.tutorId) {
        res.status(400).json({ error: 'ID do Tutor é obrigatório para cadastros via recepção/admin.' });
        return;
      }
      tutorId = data.tutorId;
    }

    const photoUrl = req.file ? req.file.path : null; // Injected by sharp middleware

    const animal = await prisma.animal.create({
      data: {
        name: data.name,
        species: data.species,
        breed: data.breed,
        birth_date: data.birth_date,
        weight: data.weight,
        allergies: data.allergies || null,
        photo_url: photoUrl,
        tutorId: tutorId,
      },
    });

    await logAction(req.user.id, 'CADASTRAR_ANIMAL', 'animals', animal.id);

    res.status(201).json({
      message: 'Animal cadastrado com sucesso.',
      animal,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[CREATE ANIMAL ERROR]:', error);
    res.status(500).json({ error: 'Falha ao cadastrar animal no sistema.' });
  }
};

export const listAnimals = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    let filter: any = {};

    if (req.user.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user.id } });
      if (!tutor) {
        res.json({ animals: [] });
        return;
      }
      filter.tutorId = tutor.id;
    } else if (req.query.tutorId) {
      // Receptionist or Admin filtering by tutorId
      filter.tutorId = String(req.query.tutorId);
    }

    // Optional Search filter by Name
    if (req.query.search) {
      filter.name = {
        contains: String(req.query.search),
      };
    }

    const animals = await prisma.animal.findMany({
      where: filter,
      include: {
        tutor: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    res.json({ animals });
  } catch (error) {
    console.error('[LIST ANIMALS ERROR]:', error);
    res.status(500).json({ error: 'Erro ao carregar lista de animais.' });
  }
};

export const getAnimalById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        tutor: {
          include: { user: { select: { name: true, email: true, role: true } } },
        },
      },
    });

    if (!animal) {
      res.status(404).json({ error: 'Animal não encontrado.' });
      return;
    }

    // Enforce ACL for patients
    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor || animal.tutorId !== tutor.id) {
        res.status(403).json({ error: 'Acesso proibido. Esse animal não pertence a você.' });
        return;
      }
    }

    res.json({ animal });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao recuperar dados do animal.' });
  }
};

export const updateAnimal = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const animal = await prisma.animal.findUnique({ where: { id } });

    if (!animal) {
      res.status(404).json({ error: 'Animal não localizado.' });
      return;
    }

    // Enforce ACL
    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor || animal.tutorId !== tutor.id) {
        res.status(403).json({ error: 'Você não possui permissão para alterar este animal.' });
        return;
      }
    }

    // Schema allows partial updates here
    const updateSchema = animalSchema.partial();
    const parsedBody = updateSchema.parse(req.body);

    let updateData: any = { ...parsedBody };

    // Handle new photo replacement
    if (req.file) {
      updateData.photo_url = req.file.path;

      // Optionally delete old photo to save space
      if (animal.photo_url) {
        const oldPath = path.join(process.cwd(), animal.photo_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    const updated = await prisma.animal.update({
      where: { id },
      data: updateData,
    });

    await logAction(req.user!.id, 'ATUALIZAR_ANIMAL', 'animals', updated.id);

    res.json({ message: 'Dados do animal atualizados com sucesso.', animal: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[UPDATE ANIMAL ERROR]:', error);
    res.status(500).json({ error: 'Falha ao modificar cadastro do animal.' });
  }
};

export const deleteAnimal = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const animal = await prisma.animal.findUnique({ where: { id } });

    if (!animal) {
      res.status(404).json({ error: 'Animal não encontrado.' });
      return;
    }

    // Only Recepcionists and Admins (or Tutors of own animal) can delete
    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor || animal.tutorId !== tutor.id) {
        res.status(403).json({ error: 'Ação proibida.' });
        return;
      }
    }

    // Delete referenced files
    if (animal.photo_url) {
      const filePath = path.join(process.cwd(), animal.photo_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.animal.delete({ where: { id } });

    await logAction(req.user!.id, 'EXCLUIR_ANIMAL', 'animals', id);

    res.json({ success: true, message: 'Animal excluído com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar cadastro. Talvez contenha vínculos com consultas ativas.' });
  }
};
