import { Router } from 'express';
import { 
  registerVaccine, 
  listVaccines, 
  getVaccineById, 
  updateVaccine, 
  deleteVaccine,
  getUpcomingVaccines
} from '../controllers/vaccineController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, listVaccines);
router.get('/upcoming', authMiddleware, roleMiddleware(['MEDICO', 'ADMIN', 'RECEPCIONISTA']), getUpcomingVaccines);
router.get('/:id', authMiddleware, getVaccineById);
router.post('/', authMiddleware, roleMiddleware(['MEDICO', 'ADMIN', 'RECEPCIONISTA']), registerVaccine);
router.put('/:id', authMiddleware, roleMiddleware(['MEDICO', 'ADMIN', 'RECEPCIONISTA']), updateVaccine);
router.delete('/:id', authMiddleware, roleMiddleware(['MEDICO', 'ADMIN']), deleteVaccine);

export default router;