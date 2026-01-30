import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

export const authRouter = Router();
const controller = new AuthController();

authRouter.post('/register', controller.register);
authRouter.post('/register/invite', controller.registerWithInvitation);
authRouter.post('/login', controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', authenticate, controller.logout);
authRouter.get('/me', authenticate, controller.me);
authRouter.patch('/profile', authenticate, controller.updateProfile);
authRouter.post('/change-password', authenticate, controller.changePassword);
