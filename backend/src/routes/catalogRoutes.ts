import { Router } from 'express';
import {
  listExamTypes,
  createExamType,
  deleteExamType,
  listVaccineTypes,
  createVaccineType,
  deleteVaccineType,
  updateVaccineStock
} from '../controllers/catalogController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

// Publicly readable for all staff/patients
router.get('/exams', listExamTypes);
router.get('/vaccines', listVaccineTypes);

// Administrative modification
router.post('/exams', roleMiddleware(['ADMIN']), createExamType);
router.delete('/exams/:id', roleMiddleware(['ADMIN']), deleteExamType);

router.post('/vaccines', roleMiddleware(['ADMIN']), createVaccineType);
router.delete('/vaccines/:id', roleMiddleware(['ADMIN']), deleteVaccineType);
router.patch('/vaccines/:id/stock', roleMiddleware(['ADMIN']), updateVaccineStock);

export default router;
