import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logAction } from '../utils/audit';

// Validators
const roomSchema = z.object({
  name: z.string().min(1, 'Nome da sala é obrigatório'),
  sector: z.enum(['TRIAGEM', 'CONSULTORIO', 'INTERNACAO', 'EXAMES']),
});

// --- Rooms ---
export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = roomSchema.parse(req.body);

    const room = await prisma.room.create({ data });

    await logAction(req.user!.id, 'CADASTRAR_SALA', 'rooms', room.id);

    res.status(201).json({ message: 'Sala criada com sucesso.', room });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    res.status(500).json({ error: 'Erro ao cadastrar sala no sistema.' });
  }
};

export const listRooms = async (req: Request, res: Response): Promise<void> => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { name: 'asc' },
    });
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao recuperar salas.' });
  }
};

export const deleteRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.room.delete({ where: { id } });
    await logAction(req.user!.id, 'DELETAR_SALA', 'rooms', id);
    res.json({ success: true, message: 'Sala excluída.' });
  } catch (error) {
    res.status(500).json({ error: 'Não é possível deletar uma sala vinculada a atendimentos.' });
  }
};

// --- Doctors & Schedule ---
export const listDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        doctor_rooms: { include: { room: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    res.json({ doctors });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar médicos.' });
  }
};

export const updateDoctorSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string; // Doctor ID
    const { schedule_config } = req.body; // JSON format hours

    // Optional validation: ensure user is admin or the doctor themselves
    if (req.user!.role === 'MEDICO') {
      const selfDoc = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (!selfDoc || selfDoc.id !== id) {
        res.status(403).json({ error: 'Permissão negada para alterar agenda alheia.' });
        return;
      }
    }

    const updated = await prisma.doctor.update({
      where: { id },
      data: { schedule_config },
    });

    await logAction(req.user!.id, 'ATUALIZAR_AGENDA_MEDICO', 'doctors', updated.id);

    res.json({ message: 'Horários de atendimento configurados com sucesso.', doctor: updated });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao configurar agenda do médico.' });
  }
};

// --- Linking ---
export const linkDoctorToRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const linkSchema = z.object({
      doctorId: z.string().uuid(),
      roomId: z.string().uuid(),
    });

    const { doctorId, roomId } = linkSchema.parse(req.body);

    // Check if link already exists
    const existing = await prisma.doctorRoom.findUnique({
      where: {
        doctorId_roomId: { doctorId, roomId },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Este médico já está vinculado a esta sala.' });
      return;
    }

    const docRoom = await prisma.doctorRoom.create({
      data: { doctorId, roomId },
    });

    await logAction(req.user!.id, 'VINCULAR_MEDICO_SALA', 'doctor_rooms', docRoom.id);

    res.status(201).json({ message: 'Médico vinculado à sala com sucesso.', docRoom });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    res.status(500).json({ error: 'Falha ao associar médico à sala.' });
  }
};

export const unlinkDoctorFromRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.params.doctorId as string;
    const roomId = req.params.roomId as string;

    await prisma.doctorRoom.delete({
      where: {
        doctorId_roomId: { doctorId, roomId },
      },
    });

    await logAction(req.user!.id, 'DESVINCULAR_MEDICO_SALA', 'doctor_rooms', `${doctorId}_${roomId}`);

    res.json({ success: true, message: 'Vínculo removido.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desvincular médico da sala.' });
  }
};
export const getClinicConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    let config = await prisma.clinicConfig.findUnique({ where: { id: 'global' } });
    if (!config) {
      config = await prisma.clinicConfig.create({ data: { id: 'global', consultation_interval: 30 } });
    }
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar configurações da clínica.' });
  }
};

export const updateClinicConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { consultation_interval } = z.object({ consultation_interval: z.number().min(5).max(120) }).parse(req.body);
    const config = await prisma.clinicConfig.upsert({
      where: { id: 'global' },
      update: { consultation_interval },
      create: { id: 'global', consultation_interval }
    });
    await logAction(req.user!.id, 'ATUALIZAR_CONFIG_CLINICA', 'clinic_configs', 'global');
    res.json({ message: 'Configurações atualizadas.', config });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar configurações.' });
  }
};
