import { Router } from 'express';
import { 
  createExamType,
  listExamTypes,
  requestExam, 
  listExams, 
  getExamById, 
  updateExamResult,
  deleteExam
} from '../controllers/examController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';
import { upload, saveExamPdf } from '../middlewares/uploadMiddleware';

const router = Router();

router.get('/types', listExamTypes);
router.post('/types', authMiddleware, roleMiddleware(['ADMIN']), createExamType);

router.get('/', authMiddleware, listExams);
router.get('/:id', authMiddleware, getExamById);
router.post('/', authMiddleware, roleMiddleware(['MEDICO', 'ADMIN', 'RECEPCIONISTA']), requestExam);
router.put('/:id', authMiddleware, roleMiddleware(['MEDICO', 'ADMIN']), upload.single('file'), saveExamPdf, updateExamResult);
router.delete('/:id', authMiddleware, roleMiddleware(['ADMIN']), deleteExam);

export default router;