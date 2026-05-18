import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const catalogSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  description: z.string().optional(),
  default_dosage: z.string().optional(),
  stock: z.number().int().min(0).optional().default(0),
});

// EXAMS
export const listExamTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const exams = await prisma.examType.findMany({ orderBy: { name: 'asc' } });
    res.json({ exams });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar tipos de exames.' });
  }
};

export const createExamType = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = catalogSchema.parse(req.body);
    const exam = await prisma.examType.create({ data });
    res.status(201).json({ exam });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Este tipo de exame já existe.' });
      return;
    }
    res.status(500).json({ error: 'Erro ao criar tipo de exame.' });
  }
};

export const deleteExamType = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.examType.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover tipo de exame.' });
  }
};

export const updateExamSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { schedule_config } = z.object({ schedule_config: z.string() }).parse(req.body);

    const exam = await prisma.examType.update({
      where: { id },
      data: { schedule_config } as any
    });

    res.json({ message: 'Agenda do exame atualizada.', exam });
  } catch (error) {
    console.error('[UPDATE EXAM SCHEDULE ERROR]:', error);
    res.status(500).json({ error: 'Erro ao atualizar agenda do exame.' });
  }
};

// VACCINES
export const listVaccineTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const vaccines = await prisma.vaccineType.findMany({ orderBy: { name: 'asc' } });
    res.json({ vaccines });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar tipos de vacinas.' });
  }
};

export const createVaccineType = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = catalogSchema.parse(req.body);
    const vaccine = await prisma.vaccineType.create({ data });
    res.status(201).json({ vaccine });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Este tipo de vacina já existe.' });
      return;
    }
    res.status(500).json({ error: 'Erro ao criar tipo de vacina.' });
  }
};

export const deleteVaccineType = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.vaccineType.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover tipo de vacina.' });
  }
};

export const updateVaccineStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { quantity } = z.object({ quantity: z.number().int() }).parse(req.body);

    const vaccine = await prisma.vaccineType.update({
      where: { id },
      data: { stock: { increment: quantity } }
    });

    res.json({ message: 'Estoque atualizado.', stock: vaccine.stock });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar estoque.' });
  }
};
