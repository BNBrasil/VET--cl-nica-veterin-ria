import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logAction } from '../utils/audit';

const ticketSchema = z.object({
  classification: z.enum(['GERAL', 'PREFERENCIAL', 'URGENTE']),
  animalId: z.string().uuid().optional(),
});

export const generateTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classification, animalId } = ticketSchema.parse(req.body);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const countToday = await prisma.queueNumber.count({
      where: {
        generation_datetime: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    });

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomChar1 = alphabet[Math.floor(Math.random() * alphabet.length)];
    const randomChar2 = alphabet[Math.floor(Math.random() * alphabet.length)];
    const sequenceNumber = String(countToday + 1).padStart(4, '0');
    
    const generatedCode = `${randomChar1}${randomChar2}${sequenceNumber} - [${classification}]`;

    const ticket = await prisma.queueNumber.create({
      data: {
        code: generatedCode,
        classification,
        status: 'AGUARDANDO',
        animalId: animalId || null,
      }
    });

    const actor = req.user ? req.user.id : 'TOTEM';
    await logAction(actor, 'GERAR_SENHA', 'queue_numbers', ticket.id);

    res.status(201).json({
      message: 'Senha gerada com sucesso.',
      ticket
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[QUEUE GENERATION ERROR]:', error);
    res.status(500).json({ error: 'Falha ao emitir nova senha da fila.' });
  }
};

export const listActiveQueue = async (req: Request, res: Response): Promise<void> => {
  try {
    const queue = await prisma.queueNumber.findMany({
      where: {
        status: { in: ['AGUARDANDO', 'CHAMADA'] }
      },
      include: {
        animal: {
          select: { name: true, tutor: { include: { user: { select: { name: true } } } } }
        }
      },
      orderBy: [
        { classification: 'desc' },
        { generation_datetime: 'asc' }
      ]
    });

    const priorityMap: { [key: string]: number } = {
      'URGENTE': 1,
      'PREFERENCIAL': 2,
      'GERAL': 3,
    };

    const sortedQueue = queue.sort((a, b) => {
      const weightA = priorityMap[a.classification] || 3;
      const weightB = priorityMap[b.classification] || 3;

      if (weightA !== weightB) {
        return weightA - weightB;
      }
      return a.generation_datetime.getTime() - b.generation_datetime.getTime();
    });

    res.json({ queue: sortedQueue });
  } catch (error) {
    console.error('[QUEUE RETRIEVAL ERROR]:', error);
    res.status(500).json({ error: 'Erro ao rescatar fila de senhas.' });
  }
};

export const callNextTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Auto-complete current "CHAMADA" tickets if any
    await prisma.queueNumber.updateMany({
      where: { status: 'CHAMADA' },
      data: { status: 'ATENDIDA' }
    });

    // 2. Find next in line
    const nextTicket = await prisma.queueNumber.findFirst({
      where: { status: 'AGUARDANDO' },
      orderBy: [
        { classification: 'desc' }, // URGENTE > PREFERENCIAL > GERAL
        { generation_datetime: 'asc' }
      ]
    });

    if (!nextTicket) {
      res.status(404).json({ message: 'Nenhuma senha aguardando chamada no momento.' });
      return;
    }

    const updated = await prisma.queueNumber.update({
      where: { id: nextTicket.id },
      data: { status: 'CHAMADA' }
    });

    await logAction(req.user!.id, 'CHAMAR_SENHA', 'queue_numbers', updated.id);

    res.json({ message: `Chamando senha ${updated.code}`, ticket: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao chamar próximo da fila.' });
  }
};

export const updateTicketStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status } = z.object({
      status: z.enum(['AGUARDANDO', 'CHAMADA', 'ATENDIDA', 'CANCELADA'])
    }).parse(req.body);

    const updated = await prisma.queueNumber.update({
      where: { id },
      data: { status }
    });

    res.json({ message: 'Status da senha alterado.', ticket: updated });
  } catch (error) {
    res.status(500).json({ error: 'Falha ao atualizar senha da fila.' });
  }
};
