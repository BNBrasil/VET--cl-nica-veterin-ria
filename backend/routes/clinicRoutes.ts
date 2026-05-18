import { Router } from 'express';
import {
  createRoom,
  listRooms,
  deleteRoom,
  listDoctors,
  updateDoctorSchedule,
  linkDoctorToRoom,
  unlinkDoctorFromRoom,
  getClinicConfig,
  updateClinicConfig
} from '../controllers/clinicController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

// Common protected views
router.get('/rooms', listRooms);
router.get('/doctors', listDoctors);

// Doctor Specific / Admin
router.patch('/doctors/:id/schedule', roleMiddleware(['MEDICO', 'ADMIN']), updateDoctorSchedule);

// Administrative Controls
router.post('/rooms', roleMiddleware(['ADMIN']), createRoom);
router.delete('/rooms/:id', roleMiddleware(['ADMIN']), deleteRoom);

router.post('/doctor-rooms', roleMiddleware(['ADMIN']), linkDoctorToRoom);
router.delete('/doctor-rooms/:doctorId/:roomId', roleMiddleware(['ADMIN']), unlinkDoctorFromRoom);

router.get('/config', getClinicConfig);
router.patch('/config', roleMiddleware(['ADMIN']), updateClinicConfig);

export default router;
