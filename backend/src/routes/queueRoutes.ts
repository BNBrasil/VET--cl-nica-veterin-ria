import { Router } from 'express';
import {
  generateTicket,
  listActiveQueue,
  callNextTicket,
  updateTicketStatus
} from '../controllers/queueController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Public/Anonymous endpoint: generating a ticket from Totem console
router.post('/', generateTicket);

// Public/Protected Display viewing endpoint
router.get('/', listActiveQueue);

// Restricted Staff Actions
router.post('/call-next', authMiddleware, roleMiddleware(['RECEPCIONISTA', 'ADMIN']), callNextTicket);
router.patch('/:id', authMiddleware, roleMiddleware(['RECEPCIONISTA', 'ADMIN']), updateTicketStatus);

export default router;
