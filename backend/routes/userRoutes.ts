import { Router } from 'express';
import { getAllUsers, updateUserRole } from '../controllers/userController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Only Admins can manage users
router.use(authMiddleware);
router.use(roleMiddleware(['ADMIN']));

router.get('/', getAllUsers);
router.patch('/:id/role', updateUserRole);

export default router;
