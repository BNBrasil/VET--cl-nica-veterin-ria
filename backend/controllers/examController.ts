import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logAction } from '../utils/audit';
import fs from 'fs';
import path from 'path';

const examRequestSchema = z.object({
  animalId: z.string().uuid('ID do animal inválido'),
  examTypeId: z.string().uuid('ID do tipo de exame inválido'),
  doctorId: z.string().uuid('ID do médico inválido'),
  result_text: z.string().optional(),
  execution_date: z.string().optional().transform((val) => val ? new Date(val) : undefined),
});

const examTypeSchema = z.object({
  name: z.string().min(1, 'Nome do exame é obrigatório'),
  description: z.string().optional(),
});

export const createExamType = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = examTypeSchema.parse(req.body);

    const examType = await prisma.examType.create({
      data: {
        name: data.name,
        description: data.description || null,
      }
    });

    await logAction(req.user!.id, 'CADASTRAR_TIPO_EXAME', 'exam_types', examType.id);

    res.status(201).json({ message: 'Tipo de exame criado.', examType });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    res.status(500).json({ error: 'Falha ao criar tipo de exame.' });
  }
};

export const listExamTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const examTypes = await prisma.examType.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ examTypes });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar tipos de exame.' });
  }
};

export const requestExam = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = examRequestSchema.parse(req.body);

    const animal = await prisma.animal.findUnique({ where: { id: data.animalId } });
    if (!animal) {
      res.status(404).json({ error: 'Animal não encontrado.' });
      return;
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: data.doctorId } });
    if (!doctor) {
      res.status(404).json({ error: 'Médico não encontrado.' });
      return;
    }

    const examType = await prisma.examType.findUnique({ where: { id: data.examTypeId } });
    if (!examType) {
      res.status(404).json({ error: 'Tipo de exame não encontrado.' });
      return;
    }

    const exam = await prisma.requestedExam.create({
      data: {
        animalId: data.animalId,
        doctorId: data.doctorId,
        examTypeId: data.examTypeId,
        status: 'SOLICITADO',
        result_text: data.result_text || null,
        execution_date: data.execution_date || null,
      }
    });

    await logAction(req.user!.id, 'SOLICITAR_EXAME', 'requested_exams', exam.id);

    res.status(201).json({
      message: 'Exame solicitado com sucesso.',
      exam
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[REQUEST EXAM ERROR]:', error);
    res.status(500).json({ error: 'Falha ao solicitar exame.' });
  }
};

export const listExams = async (req: Request, res: Response): Promise<void> => {
  try {
    const animalId = req.query.animalId as string | undefined;
    const status = req.query.status as string | undefined;

    let filter: any = {};

    if (animalId) filter.animalId = animalId;
    if (status) filter.status = status;

    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor) {
        res.json({ exams: [] });
        return;
      }
      filter.animal = { tutorId: tutor.id };
    }

    const exams = await prisma.requestedExam.findMany({
      where: filter,
      include: {
        animal: { select: { id: true, name: true, species: true, breed: true, photo_url: true } },
        doctor: { include: { user: { select: { name: true } } } },
        exam_type: true,
      },
      orderBy: { request_date: 'desc' }
    });

    res.json({ exams });
  } catch (error) {
    console.error('[LIST EXAMS ERROR]:', error);
    res.status(500).json({ error: 'Falha ao listar exames.' });
  }
};

export const getExamById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const exam = await prisma.requestedExam.findUnique({
      where: { id },
      include: {
        animal: { include: { tutor: { include: { user: true } } } },
        doctor: { include: { user: true } },
        exam_type: true,
      }
    });

    if (!exam) {
      res.status(404).json({ error: 'Exame não encontrado.' });
      return;
    }

    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor || exam.animal.tutorId !== tutor.id) {
        res.status(403).json({ error: 'Acesso negado.' });
        return;
      }
    }

    res.json({ exam });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar exame.' });
  }
};

export const updateExamResult = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const exam = await prisma.requestedExam.findUnique({ where: { id } });
    if (!exam) {
      res.status(404).json({ error: 'Exame não encontrado.' });
      return;
    }

    const updateSchema = z.object({
      status: z.enum(['SOLICITADO', 'REALIZADO']).optional(),
      result_text: z.string().optional(),
      execution_date: z.string().transform((val) => new Date(val)).optional(),
    });

    const data = updateSchema.parse(req.body);

    const filePath = req.file ? req.file.path : undefined;

    const updated = await prisma.requestedExam.update({
      where: { id },
      data: {
        status: data.status || undefined,
        result_text: data.result_text || undefined,
        execution_date: data.execution_date || undefined,
        file_path: filePath || undefined,
      }
    });

    await logAction(req.user!.id, 'ATUALIZAR_RESULTADO_EXAME', 'requested_exams', id);

    res.json({ message: 'Resultado do exame atualizado.', exam: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[UPDATE EXAM ERROR]:', error);
    res.status(500).json({ error: 'Falha ao atualizar exame.' });
  }
};

export const deleteExam = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const exam = await prisma.requestedExam.findUnique({ where: { id } });
    if (!exam) {
      res.status(404).json({ error: 'Exame não encontrado.' });
      return;
    }

    if (exam.file_path) {
      const fullPath = path.join(process.cwd(), exam.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await prisma.requestedExam.delete({ where: { id } });

    await logAction(req.user!.id, 'EXCLUIR_EXAME', 'requested_exams', id);

    res.json({ success: true, message: 'Exame excluído.' });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao excluir exame.' });
  }
};