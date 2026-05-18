import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logAction } from '../utils/audit';

const bulkVaccineSchema = z.object({
  animalId: z.string().uuid('ID do animal inválido'),
  vaccinations: z.array(z.object({
    vaccineTypeId: z.string().uuid('ID do tipo de vacina inválido'),
    dosage: z.string().optional(),
    application_date: z.string().optional().nullable().transform((val) => {
      if (!val) return new Date();
      const d = new Date(val);
      return isNaN(d.getTime()) ? new Date() : d;
    }),
    next_dose_date: z.string().optional().nullable().transform((val) => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }),
    batch: z.string().optional(),
  })).min(1, 'Selecione pelo menos uma vacina'),
});

export const registerVaccine = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'MEDICO' && req.user!.role !== 'ADMIN' && req.user!.role !== 'RECEPCIONISTA') {
      res.status(403).json({ error: 'Apenas profissionais podem registrar vacinas.' });
      return;
    }

    const { animalId, vaccinations } = bulkVaccineSchema.parse(req.body);

    const animal = await prisma.animal.findUnique({ where: { id: animalId } });
    if (!animal) {
      res.status(404).json({ error: 'Animal não encontrado.' });
      return;
    }

    // Process all vaccinations in a single transaction
    const results = await prisma.$transaction(async (tx) => {
      const createdVaccines = [];

      for (const v of vaccinations) {
        const vaccineType = await tx.vaccineType.findUnique({ where: { id: v.vaccineTypeId } });
        if (!vaccineType) throw new Error(`Vacina com ID ${v.vaccineTypeId} não encontrada.`);
        if (vaccineType.stock <= 0) throw new Error(`Vacina ${vaccineType.name} está sem estoque.`);

        const created = await tx.vaccine.create({
          data: {
            animalId,
            vaccineTypeId: v.vaccineTypeId,
            name: vaccineType.name,
            dosage: v.dosage || vaccineType.default_dosage || null,
            application_date: v.application_date || new Date(),
            next_dose_date: v.next_dose_date || null,
            batch: v.batch || null,
          }
        });

        await tx.vaccineType.update({
          where: { id: v.vaccineTypeId },
          data: { stock: { decrement: 1 } }
        });

        createdVaccines.push(created);
      }

      return createdVaccines;
    });

    await logAction(req.user!.id, 'REGISTRAR_VACINA_EM_LOTE', 'vaccines', results[0].id);

    res.status(201).json({
      message: `${results.length} vacinas registradas e estoque atualizado.`,
      vaccines: results
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[REGISTER VACCINE ERROR]:', error);
    res.status(500).json({ error: error.message || 'Falha ao registrar vacinas.' });
  }
};

export const listVaccines = async (req: Request, res: Response): Promise<void> => {
  try {
    const animalId = req.query.animalId as string | undefined;

    let filter: any = {};

    if (animalId) {
      filter.animalId = animalId;
    } else if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor) {
        res.json({ vaccines: [] });
        return;
      }
      filter.animal = { tutorId: tutor.id };
    }

    const vaccines = await prisma.vaccine.findMany({
      where: filter,
      include: {
        animal: { select: { id: true, name: true, species: true, breed: true } }
      },
      orderBy: { application_date: 'desc' }
    });

    res.json({ vaccines });
  } catch (error) {
    console.error('[LIST VACCINES ERROR]:', error);
    res.status(500).json({ error: 'Falha ao listar vacunas.' });
  }
};

export const getVaccineById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const vaccine = await prisma.vaccine.findUnique({
      where: { id },
      include: { animal: true }
    });

    if (!vaccine) {
      res.status(404).json({ error: 'Vacina não encontrada.' });
      return;
    }

    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor || vaccine.animal.tutorId !== tutor.id) {
        res.status(403).json({ error: 'Acesso negado.' });
        return;
      }
    }

    res.json({ vaccine });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar vaccine.' });
  }
};

export const updateVaccine = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.vaccine.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Vacina não encontrada.' });
      return;
    }

    const updateSchema = vaccineSchema.partial();
    const data = updateSchema.parse(req.body);

    const updated = await prisma.vaccine.update({
      where: { id },
      data: {
        name: data.name || undefined,
        application_date: data.application_date || undefined,
        next_dose_date: data.next_dose_date || undefined,
        batch: data.batch || undefined,
      }
    });

    await logAction(req.user!.id, 'ATUALIZAR_VACINA', 'vaccines', id);

    res.json({ message: 'Vacina atualizada.', vaccine: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    res.status(500).json({ error: 'Falha ao atualizar vacina.' });
  }
};

export const deleteVaccine = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Apenas administradores podem excluir registros de vacinas.' });
      return;
    }

    const existing = await prisma.vaccine.findUnique({ 
      where: { id },
      include: { vaccine_type: true }
    });

    if (!existing) {
      res.status(404).json({ error: 'Vacina não encontrada.' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete the record
      await tx.vaccine.delete({ where: { id } });

      // 2. Refund stock if it was linked to a catalog item
      if (existing.vaccineTypeId) {
        await tx.vaccineType.update({
          where: { id: existing.vaccineTypeId },
          data: { stock: { increment: 1 } }
        });
      }
    });

    await logAction(req.user!.id, 'EXCLUIR_VACINA', 'vaccines', id);

    res.json({ success: true, message: 'Vacina excluída e estoque estornado.' });
  } catch (error) {
    console.error('[DELETE VACCINE ERROR]:', error);
    res.status(500).json({ error: 'Falha ao excluir vacina.' });
  }
};

export const getUpcomingVaccines = async (req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const vaccines = await prisma.vaccine.findMany({
      where: {
        next_dose_date: {
          lte: thirtyDaysFromNow,
          gte: new Date()
        }
      },
      include: {
        animal: {
          include: {
            tutor: {
              include: { user: { select: { name: true, email: true } } }
            }
          }
        }
      },
      orderBy: { next_dose_date: 'asc' }
    });

    res.json({ vaccines });
  } catch (error) {
    console.error('[UPCOMING VACCINES ERROR]:', error);
    res.status(500).json({ error: 'Erro ao buscar próximas vacinas.' });
  }
};