import express from 'express';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/authRoutes';
import animalRoutes from './routes/animalRoutes';
import tutorRoutes from './routes/tutorRoutes';
import clinicRoutes from './routes/clinicRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import queueRoutes from './routes/queueRoutes';
import prescriptionRoutes from './routes/prescriptionRoutes';
import vaccineRoutes from './routes/vaccineRoutes';
import examRoutes from './routes/examRoutes';
import userRoutes from './routes/userRoutes';
import catalogRoutes from './routes/catalogRoutes';

const router = express.Router();

// Garante que as pastas de uploads existam na raiz do monorepo
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const subdirs = ['animais', 'exames', 'receitas'];
subdirs.forEach(dir => {
  const fullPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Rota de verificação de status básica do Vet
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'VET CRM API está operando normalmente no servidor central.' });
});

// Registro das subrotas internas do Vet CRM
router.use('/auth', authRoutes);
router.use('/animals', animalRoutes);
router.use('/tutors', tutorRoutes);
router.use('/clinic', clinicRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/queue', queueRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/vaccines', vaccineRoutes);
router.use('/exams', examRoutes);
router.use('/users', userRoutes);
router.use('/catalog', catalogRoutes);

export default router;
