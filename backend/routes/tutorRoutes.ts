import { Router } from 'express';
import { listTutors, getTutorById, updateTutorProfile } from '../controllers/tutorController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

// Only Recepcionist or Admin or Medico can search across all Tutors
router.get('/', roleMiddleware(['RECEPCIONISTA', 'MEDICO', 'ADMIN']), listTutors);

router.get('/:id', getTutorById);
router.put('/:id', updateTutorProfile);

export default router;
