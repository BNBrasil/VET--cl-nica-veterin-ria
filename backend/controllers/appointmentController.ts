import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logAction } from '../utils/audit';

const bookingSchema = z.object({
  animalId: z.string().uuid('ID do animal inválido'),
  doctorId: z.string().uuid('ID do médico inválido'),
  roomId: z.string().uuid('ID da sala inválida').optional(),
  appointment_datetime: z.string().transform((val) => new Date(val)),
  observation: z.string().min(3, 'Preencha o motivo do agendamento'),
});

// Helper for generating slots
const generateSlots = (start: string, end: string, interval: number) => {
  const slots = [];
  let current = new Date(`1970-01-01T${start}:00Z`);
  const stop = new Date(`1970-01-01T${end}:00Z`);
  
  while (current < stop) {
    slots.push(current.toISOString().substr(11, 5));
    current.setMinutes(current.getMinutes() + interval);
  }
  return slots;
};

export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = bookingSchema.parse(req.body);

    // Check if animal belongs to logged user if PACIENTE
    if (req.user!.role === 'PACIENTE') {
      const animal = await prisma.animal.findUnique({
        where: { id: data.animalId },
        include: { tutor: true }
      });
      
      if (!animal || animal.tutor.userId !== req.user!.id) {
        res.status(403).json({ error: 'O animal fornecido não está sob sua guarda.' });
        return;
      }
    }

    // Optional: Assign default doctor room if one exists, but don't fail if it doesn't
    let resolvedRoomId = data.roomId;
    if (!resolvedRoomId) {
      const docRoom = await prisma.doctorRoom.findFirst({
        where: { doctorId: data.doctorId },
      });
      resolvedRoomId = docRoom?.roomId || null;
    }

    // Double-booking check: check if doctor already has a matching appointment slot
    const conflict = await prisma.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        appointment_datetime: data.appointment_datetime,
        status: { notIn: ['CANCELADA', 'FALTOU'] }
      }
    });

    if (conflict) {
      res.status(409).json({ error: 'Horário indisponível para este profissional médico.' });
      return;
    }

    const appointment = await prisma.appointment.create({
      data: {
        animalId: data.animalId,
        doctorId: data.doctorId,
        roomId: resolvedRoomId,
        appointment_datetime: data.appointment_datetime,
        observation: data.observation,
        status: 'AGENDADA',
      }
    });

    await logAction(req.user!.id, 'AGENDAR_CONSULTA', 'appointments', appointment.id);

    res.status(201).json({
      message: 'Consulta agendada com sucesso.',
      appointment
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[CREATE APPOINTMENT ERROR]:', error);
    res.status(500).json({ error: 'Falha técnica ao criar agendamento.' });
  }
};

export const listAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const date = req.query.date ? String(req.query.date) : undefined; // format YYYY-MM-DD
    const doctorId = req.query.doctorId ? String(req.query.doctorId) : undefined;

    let filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (doctorId) {
      filter.doctorId = doctorId;
    }

    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor) {
        res.json({ appointments: [] });
        return;
      }
      filter.animal = { tutorId: tutor.id };
    }

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      filter.appointment_datetime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const appointments = await prisma.appointment.findMany({
      where: filter,
      include: {
        animal: {
          select: { id: true, name: true, photo_url: true, species: true, breed: true }
        },
        doctor: {
          include: { user: { select: { name: true } } }
        },
        room: true,
      },
      orderBy: { appointment_datetime: 'asc' }
    });

    res.json({ appointments });
  } catch (error) {
    console.error('[LIST APPOINTMENTS ERROR]:', error);
    res.status(500).json({ error: 'Falha ao carregar agendamentos.' });
  }
};

export const updateAppointmentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const statusSchema = z.object({
      status: z.enum(['AGENDADA', 'EM_ATENDIMENTO', 'CONCLUIDA', 'FALTOU', 'CANCELADA']),
      observation: z.string().optional(),
    });

    const { status, observation } = statusSchema.parse(req.body);

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      res.status(404).json({ error: 'Consulta não encontrada.' });
      return;
    }

    // Restrict transition if Paciente tries to manipulate staff status
    if (req.user!.role === 'PACIENTE' && status !== 'CANCELADA') {
      res.status(403).json({ error: 'Sem permissão para realizar essa transição de status.' });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        observation: observation || undefined,
      }
    });

    await logAction(req.user!.id, `ALTERAR_STATUS_CONSULTA_${status}`, 'appointments', id);

    res.json({ message: `Status da consulta atualizado para ${status}.`, appointment: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    res.status(500).json({ error: 'Falha ao atualizar status.' });
  }
};

export const moveAppointmentRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { roomId } = z.object({ roomId: z.string().uuid() }).parse(req.body);

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      res.status(404).json({ error: 'Consulta não encontrada.' });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { roomId }
    });

    await logAction(req.user!.id, 'MOVER_SALA_CONSULTA', 'appointments', id);

    res.json({ message: 'Sala da consulta atualizada.', appointment: updated });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao transferir sala da consulta.' });
  }
};
export const getSpecialties = async (req: Request, res: Response): Promise<void> => {
  try {
    const specialties = await prisma.doctor.findMany({
      select: { specialty: true },
      distinct: ['specialty'],
    });
    res.json({ specialties: specialties.map(s => s.specialty) });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao carregar especialidades.' });
  }
};

export const getDoctorsBySpecialty = async (req: Request, res: Response): Promise<void> => {
  try {
    const { specialty } = req.query;
    const doctors = await prisma.doctor.findMany({
      where: { specialty: String(specialty) },
      include: { user: { select: { name: true } } },
    });
    res.json({ doctors });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao carregar médicos.' });
  }
};

export const getAvailableSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const { doctorId, examTypeId, date } = req.query; // date in YYYY-MM-DD
    if ((!doctorId && !examTypeId) || !date) {
      res.status(400).json({ error: 'Profissional/Exame e data são obrigatórios.' });
      return;
    }

    let scheduleConfig: string | null = null;
    
    if (doctorId) {
      const doctor = await prisma.doctor.findUnique({ where: { id: String(doctorId) } });
      if (!doctor || !doctor.schedule_config) {
        res.status(404).json({ error: 'Escala do médico não configurada.' });
        return;
      }
      scheduleConfig = doctor.schedule_config;
    } else if (examTypeId) {
      const examType = await prisma.examType.findUnique({ where: { id: String(examTypeId) } });
      if (!examType || !(examType as any).schedule_config) {
        res.status(404).json({ error: 'Escala deste exame não configurada.' });
        return;
      }
      scheduleConfig = (examType as any).schedule_config;
    }

    if (!scheduleConfig) {
      res.json({ slots: [] });
      return;
    }

    const config = await prisma.clinicConfig.findUnique({ where: { id: 'global' } });
    const interval = config?.consultation_interval || 30;

    const schedule = JSON.parse(scheduleConfig);
    const dayOfWeek = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    
    const daySchedule = schedule[dayOfWeek];
    if (!daySchedule || daySchedule.length === 0) {
      res.json({ slots: [] });
      return;
    }

    // Existing appointments/exams on that day
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    let busySlots: string[] = [];

    if (doctorId) {
      const appointments = await prisma.appointment.findMany({
        where: {
          doctorId: String(doctorId),
          appointment_datetime: { gte: startOfDay, lte: endOfDay },
          status: { notIn: ['CANCELADA', 'FALTOU'] }
        },
        select: { appointment_datetime: true }
      });
      busySlots = appointments.map(a => a.appointment_datetime.toISOString().substr(11, 5));
    } else if (examTypeId) {
      const exams = await prisma.requestedExam.findMany({
        where: {
          examTypeId: String(examTypeId),
          execution_date: { gte: startOfDay, lte: endOfDay },
        },
        select: { execution_date: true }
      });
      busySlots = exams
        .filter(e => e.execution_date)
        .map(e => e.execution_date!.toISOString().substr(11, 5));
    }
    
    let allSlots: string[] = [];
    daySchedule.forEach((range: string) => {
      const [start, end] = range.split('-');
      allSlots = [...allSlots, ...generateSlots(start, end, interval)];
    });

    const availableSlots = allSlots.filter(slot => !busySlots.includes(slot));
    res.json({ slots: availableSlots });
  } catch (error) {
    console.error('[GET SLOTS ERROR]:', error);
    res.status(500).json({ error: 'Erro ao calcular horários disponíveis.' });
  }
};
