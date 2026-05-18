import { Router } from 'express';
import {
  createAppointment,
  listAppointments,
  updateAppointmentStatus,
  moveAppointmentRoom,
  getSpecialties,
  getDoctorsBySpecialty,
  getAvailableSlots
} from '../controllers/appointmentController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', listAppointments);
router.post('/', createAppointment);
router.get('/specialties', getSpecialties);
router.get('/doctors-by-specialty', getDoctorsBySpecialty);
router.get('/available-slots', getAvailableSlots);

// Status update can be performed by doctor, admin, or patient (cancellation only checked in controller logic)
router.patch('/:id/status', updateAppointmentStatus);

// Room change (Kanban move) restricted to receptionist, admin or doctor
router.patch('/:id/room', roleMiddleware(['RECEPCIONISTA', 'MEDICO', 'ADMIN']), moveAppointmentRoom);

export default router;
