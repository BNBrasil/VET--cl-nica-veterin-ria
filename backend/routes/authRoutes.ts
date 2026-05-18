import { Router } from 'express';
import { login, registerTutor, adminCreateUser, listUsers, logout, getMe, verify2FA, forgotPassword, resetPassword } from '../controllers/authController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Public routes
router.post('/register', registerTutor);
router.post('/login', login);
router.post('/logout', logout);
router.post('/verify-2fa', verify2FA);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', authMiddleware, getMe);

// Admin only
router.get('/users', authMiddleware, roleMiddleware(['ADMIN']), listUsers);
router.get('/patients', authMiddleware, roleMiddleware(['ADMIN', 'RECEPCIONISTA']), listUsers); // For now uses listUsers but could filter
router.post('/register-staff', authMiddleware, roleMiddleware(['ADMIN', 'RECEPCIONISTA']), adminCreateUser);

export default router;
