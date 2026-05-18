import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { logAction } from '../utils/audit';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const medicationSchema = z.object({
  medication_name: z.string().min(1, 'Nome do medicamento é obrigatório'),
  dosage: z.string().min(1, 'Dosagem é obrigatória'),
  frequency: z.string().min(1, 'Frequência é obrigatória'),
  duration: z.string().optional(),
});

const prescriptionSchema = z.object({
  animalId: z.string().uuid('ID do animal inválido'),
  appointmentId: z.string().uuid().optional(),
  notes: z.string().optional(),
  medications: z.array(medicationSchema).min(1, 'Ao menos um medicamento é necessário'),
});

export const createPrescription = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'MEDICO' && req.user!.role !== 'ADMIN') {
      res.status(403).json({ error: 'Apenas médicos podem emitir receitas.' });
      return;
    }

    const data = prescriptionSchema.parse(req.body);

    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
    if (!doctor) {
      res.status(400).json({ error: 'Perfil médico não localizado.' });
      return;
    }

    const animal = await prisma.animal.findUnique({
      where: { id: data.animalId },
      include: { tutor: { include: { user: true } } }
    });

    if (!animal) {
      res.status(404).json({ error: 'Animal não encontrado.' });
      return;
    }

    const prescription = await prisma.$transaction(async (tx) => {
      const rx = await tx.prescription.create({
        data: {
          animalId: data.animalId,
          appointmentId: data.appointmentId || null,
          doctorId: doctor.id,
          notes: data.notes || null,
        }
      });

      await tx.prescriptionMedication.createMany({
        data: data.medications.map(med => ({
          prescriptionId: rx.id,
          medication_name: med.medication_name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration || null,
        }))
      });

      return rx;
    });

    await logAction(req.user!.id, 'EMITIR_RECEITA', 'prescriptions', prescription.id);

    res.status(201).json({
      message: 'Receita Emitida!',
      prescription: { id: prescription.id }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues[0].message });
      return;
    }
    console.error('[CREATE PRESCRIPTION ERROR]:', error);
    res.status(500).json({ error: 'Falha ao criar receita.' });
  }
};

export const generatePrescriptionPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        medications: true,
        animal: {
          include: { tutor: { include: { user: true } } }
        },
        doctor: {
          include: { user: true }
        }
      }
    });

    if (!prescription) {
      res.status(404).json({ error: 'Receita não encontrada.' });
      return;
    }

    const doc = new PDFDocument({ margin: 50 });
    const filename = `receita_${prescription.id}.pdf`;
    const filepath = path.join(process.cwd(), 'uploads', 'receitas', filename);
    
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.fontSize(20).text('VET - Clínica Veterinária', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('Receituário Médico', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text('Dados do Paciente:', { underline: true });
    doc.fontSize(12);
    doc.text(`Nome: ${prescription.animal.name}`);
    doc.text(`Espécie: ${prescription.animal.species} | Raça: ${prescription.animal.breed}`);
    doc.text(`Tutor: ${prescription.animal.tutor.user.name}`);
    doc.moveDown();

    doc.fontSize(14).text('Dados do Médico:', { underline: true });
    doc.fontSize(12);
    doc.text(`Dr(a). ${prescription.doctor.user.name}`);
    doc.text(`CRM: ${prescription.doctor.crm} | Especialidade: ${prescription.doctor.specialty}`);
    doc.moveDown();

    doc.fontSize(14).text('Prescrição:', { underline: true });
    doc.moveDown(0.5);

    prescription.medications.forEach((med, index) => {
      doc.fontSize(12).text(`${index + 1}. ${med.medication_name}`, { continued: false });
      doc.fontSize(11).text(`   Dosagem: ${med.dosage} | Frequência: ${med.frequency}`);
      if (med.duration) {
        doc.text(`   Duração: ${med.duration}`);
      }
      doc.moveDown(0.5);
    });

    if (prescription.notes) {
      doc.moveDown();
      doc.fontSize(14).text('Observações:', { underline: true });
      doc.fontSize(11).text(prescription.notes);
    }

    doc.moveDown(2);
    doc.fontSize(10).text(`Data: ${prescription.prescription_date.toLocaleDateString('pt-BR')}`, { align: 'right' });
    doc.text('Assinatura do Veterinário: _________________________', { align: 'right' });

    doc.end();

    stream.on('finish', async () => {
      await prisma.prescription.update({
        where: { id },
        data: { file_path: `uploads/receitas/${filename}` }
      });

      await logAction(req.user!.id, 'GERAR_PDF_RECEITA', 'prescriptions', id);

      res.download(filepath, filename, (err) => {
        if (err) {
          console.error('[DOWNLOAD ERROR]:', err);
        }
      });
    });

  } catch (error) {
    console.error('[GENERATE PDF ERROR]:', error);
    res.status(500).json({ error: 'Falha ao gerar PDF da receita.' });
  }
};

export const listPrescriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const animalId = req.query.animalId as string | undefined;
    const doctorId = req.query.doctorId as string | undefined;

    let filter: any = {};

    if (animalId) filter.animalId = animalId;
    if (doctorId) filter.doctorId = doctorId;

    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor) {
        res.json({ prescriptions: [] });
        return;
      }
      filter.animal = { tutorId: tutor.id };
    } else if (req.user!.role === 'MEDICO') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user!.id } });
      if (doctor) filter.doctorId = doctor.id;
    }

    const prescriptions = await prisma.prescription.findMany({
      where: filter,
      include: {
        animal: { select: { id: true, name: true, species: true, breed: true, photo_url: true } },
        doctor: { include: { user: { select: { name: true } } } },
        medications: true,
      },
      orderBy: { prescription_date: 'desc' }
    });

    res.json({ prescriptions });
  } catch (error) {
    console.error('[LIST PRESCRIPTIONS ERROR]:', error);
    res.status(500).json({ error: 'Falha ao listar receitas.' });
  }
};

export const getPrescriptionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        medications: true,
        animal: { include: { tutor: { include: { user: true } } } },
        doctor: { include: { user: true } },
        appointment: true,
      }
    });

    if (!prescription) {
      res.status(404).json({ error: 'Receita não encontrada.' });
      return;
    }

    if (req.user!.role === 'PACIENTE') {
      const tutor = await prisma.tutor.findUnique({ where: { userId: req.user!.id } });
      if (!tutor || prescription.animal.tutorId !== tutor.id) {
        res.status(403).json({ error: 'Acesso negado.' });
        return;
      }
    }

    res.json({ prescription });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar receita.' });
  }
};