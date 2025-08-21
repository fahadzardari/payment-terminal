import express from 'express';
import authController from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', authController.login);

// Protected routes
router.post('/register', authenticate, authController.register);
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/update', authenticate, authController.updateUser);
router.post('/change-password', authenticate, authController.changePassword);

export default router;