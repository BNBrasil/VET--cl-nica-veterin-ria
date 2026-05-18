import { Router } from 'express';
import { 
  createPrescription, 
  generatePrescriptionPDF, 
  listPrescriptions, 
  getPrescriptionById 
} from '../controllers/prescriptionController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, listPrescriptions);
router.get('/:id', authMiddleware, getPrescriptionById);
router.post('/', authMiddleware, roleMiddleware(['MEDICO', 'ADMIN']), createPrescription);
router.get('/:id/pdf', authMiddleware, generatePrescriptionPDF);

export default router;