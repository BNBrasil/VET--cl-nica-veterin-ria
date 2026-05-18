import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
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

// Load envs
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable static directory for uploaded files automatically
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'animais'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'exames'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'receitas'), { recursive: true });
}

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Static files lookup (Serves compressed pictures & PDFs)
app.use('/uploads', express.static(uploadsDir));

// Basic healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'VET CRM API está operando normalmente.' });
});

// Route mapping
app.use('/api/auth', authRoutes);
app.use('/api/animals', animalRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/vaccines', vaccineRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/users', userRoutes);
app.use('/api/catalog', catalogRoutes);

// Global Error Handlers
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNCAUGHT ERROR]:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Erro desconhecido no servidor.' });
  }
});

// Initializing Listener
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 VET CRM API Servidor rodando na porta ${PORT}`);
  console.log(`📂 Pasta de Uploads mapeada: ${uploadsDir}`);
  console.log(`===================================================`);
});
